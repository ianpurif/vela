import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";

// Chromium's documented ANGLE SwiftShader driver path; evidence is software-rendered.
// https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

type ObservedContext = {
  canvas: HTMLCanvasElement;
  context: WebGLRenderingContext | WebGL2RenderingContext;
  draws: number;
  losses: number;
};
type CinematicObservation = {
  contexts: ObservedContext[];
  shifts: { value: number; startTime: number }[];
  retiredStory?: HTMLElement;
};
type ObservedWindow = Window & {
  __velaCinematic?: CinematicObservation;
  __THREE__?: string;
};

async function observeRendering(page: Page, disableWebGL = false) {
  await page.addInitScript(
    ({ disableWebGL }) => {
      const observation: CinematicObservation = { contexts: [], shifts: [] };
      (window as ObservedWindow).__velaCinematic = observation;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...args: unknown[]
      ) {
        const isWebGL = ["webgl", "webgl2", "experimental-webgl"].includes(kind);
        if (disableWebGL && isWebGL) return null;
        const context = Reflect.apply(original, this, [kind, ...args]) as RenderingContext | null;
        if (isWebGL && context && !observation.contexts.some((item) => item.context === context)) {
          const entry: ObservedContext = {
            canvas: this,
            context: context as WebGLRenderingContext | WebGL2RenderingContext,
            draws: 0,
            losses: 0,
          };
          observation.contexts.push(entry);
          this.addEventListener("webglcontextlost", () => {
            entry.losses++;
          });
          const methods = context as unknown as Record<string, unknown>;
          for (const name of [
            "drawArrays",
            "drawElements",
            "drawArraysInstanced",
            "drawElementsInstanced",
          ]) {
            const method = methods[name];
            if (typeof method !== "function") continue;
            methods[name] = (...parameters: unknown[]) => {
              const result = Reflect.apply(method, context, parameters);
              entry.draws++;
              return result;
            };
          }
        }
        return context;
      } as typeof HTMLCanvasElement.prototype.getContext;
      if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!shift.hadRecentInput)
              observation.shifts.push({ value: shift.value, startTime: shift.startTime });
          }
        }).observe({ type: "layout-shift", buffered: true });
      }
    },
    { disableWebGL },
  );
}

function observeHeavyScripts(page: Page) {
  const requests: string[] = [];
  const loaded: { url: string; libraries: string[] }[] = [];
  const pending: Promise<void>[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") requests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.request().resourceType() !== "script") return;
    pending.push(
      (async () => {
        try {
          const source = await response.text();
          const libraries = [
            ...(source.includes("THREE.WebGLRenderer:") ||
            source.includes("Multiple instances of Three.js being imported")
              ? ["three"]
              : []),
            ...(source.includes("Missing plugin? gsap.registerPlugin()") ? ["gsap"] : []),
            ...(source.includes("Please gsap.registerPlugin(ScrollTrigger)")
              ? ["scroll-trigger"]
              : []),
          ];
          if (libraries.length) loaded.push({ url: response.url(), libraries });
        } catch {
          // A cancelled development request has no response body; its URL is still recorded.
        }
      })(),
    );
  });
  return {
    async snapshot() {
      let settled = -1;
      while (settled !== pending.length) {
        settled = pending.length;
        await Promise.all(pending);
      }
      return { requests: [...requests], loaded: [...loaded] };
    },
  };
}

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function animationFrames(page: Page, count = 30) {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let frames = 0;
        function frame() {
          if (++frames >= count) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
    count,
  );
}

async function layoutEvidence(page: Page) {
  return page.evaluate(() => {
    const shifts = (window as ObservedWindow).__velaCinematic?.shifts ?? [];
    return { total: shifts.reduce((sum, entry) => sum + entry.value, 0), entries: shifts };
  });
}

async function rendererEvidence(page: Page, index?: number) {
  return page.evaluate((requestedIndex) => {
    const observation = (window as ObservedWindow).__velaCinematic;
    const canvas = document.querySelector('[data-testid="product-story"] canvas');
    const contextIndex =
      requestedIndex ?? observation?.contexts.findIndex((item) => item.canvas === canvas) ?? -1;
    const entry = observation?.contexts[contextIndex];
    if (!entry) return null;
    const lost = entry.context.isContextLost();
    const debug = lost ? null : entry.context.getExtension("WEBGL_debug_renderer_info");
    return {
      index: contextIndex,
      connected: entry.canvas.isConnected,
      draws: entry.draws,
      losses: entry.losses,
      lost,
      width: entry.canvas.width,
      height: entry.canvas.height,
      renderer: debug
        ? String(entry.context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
        : "unavailable",
    };
  }, index);
}

async function idleEvidence(page: Page, index: number, frames = 45) {
  return page.evaluate(
    ({ index, frames }) =>
      new Promise<{
        frameSamples: number;
        elapsedMs: number;
        drawDelta: number;
        rendererFrameDelta: number;
      }>((resolve) => {
        const entry = (window as ObservedWindow).__velaCinematic!.contexts[index];
        const story = document.querySelector<HTMLElement>('[data-testid="product-story"]');
        const frameNumber = () => Number(story?.dataset.renderedFrame ?? 0);
        const initialDraws = entry.draws;
        const initialFrame = frameNumber();
        const started = performance.now();
        let samples = 0;
        function sample() {
          if (++samples >= frames)
            resolve({
              frameSamples: samples,
              elapsedMs: performance.now() - started,
              drawDelta: entry.draws - initialDraws,
              rendererFrameDelta: frameNumber() - initialFrame,
            });
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),
    { index, frames },
  );
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function scrollStory(page: Page, progress: number) {
  await page.evaluate((progress) => {
    const story = document.querySelector<HTMLElement>('[data-testid="product-story"]')!;
    const viewport = story.querySelector<HTMLElement>("[data-story-viewport]")!;
    const box = story.getBoundingClientRect();
    const top = box.top + window.scrollY;
    const start = top - Number.parseFloat(getComputedStyle(viewport).top);
    const end = top + box.height - window.innerHeight;
    if (!Number.isFinite(start) || end <= start)
      throw new Error("The product story has no active scroll range.");
    window.scrollTo({ top: start + (end - start) * progress, behavior: "instant" });
  }, progress);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("product-story").getAttribute("data-story-progress")),
    )
    .toBeCloseTo(progress, 1);
  await expect(page.getByTestId("product-story")).toHaveAttribute("data-story-active", "true");
}

async function staticStory(page: Page) {
  const story = page.getByTestId("product-story");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-story-state", /^(static|failed)$/);
  await expect(story).toHaveAttribute("data-story-enhanced", "false");
  await expect(story.locator("canvas")).toHaveCount(0);
  await expect(story.locator("[data-story-viewport]")).toHaveCSS("position", "relative");
  await expect(story.locator("img").first()).toBeVisible();
  await expect(story.locator('a[href="/products/first-light-serum"]').first()).toBeVisible();
  expect(
    await story.evaluate((element) => {
      const pinned = element.querySelector(
        '[style*="position: fixed"], [style*="position: sticky"]',
      );
      return !pinned && !element.closest(".pin-spacer") && !element.querySelector(".pin-spacer");
    }),
  ).toBe(true);
  await noOverflow(page);
}

async function usableDialogs(page: Page, mobile: boolean) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  if (mobile) {
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close navigation", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Search products", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /^Shopping bag/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close shopping bag", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
}

async function attachEvidence(testInfo: TestInfo, name: string, evidence: unknown) {
  await testInfo.attach(name, {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
}

test.describe("local cinematic storefront", () => {
  test.skip(process.env.VELA_E2E_EMULATOR !== "1", "Requires explicitly enabled local emulators.");
  test.beforeEach(() => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
    if (
      process.env.VERCEL ||
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname)
    ) {
      throw new Error("Cinematic browser probes are restricted to the local test storefront.");
    }
  });

  test("desktop renders real scroll poses, rests when idle, and disposes on navigation", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The WebGL enhancement is desktop-only.");
    test.setTimeout(150000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await observeRendering(page);
    const scripts = observeHeavyScripts(page);
    const errors = observeErrors(page);
    await page.goto("/");
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "active");
    const story = page.getByTestId("product-story");
    await expect(story).toBeAttached();
    await expect(story).toHaveAttribute("data-story-enhanced", "true");
    const initialLayout = await layoutEvidence(page);
    const before = await story.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top + window.scrollY, width: box.width, height: box.height };
    });
    await story.scrollIntoViewIfNeeded();
    try {
      await expect(story).toHaveAttribute("data-story-state", "ready", { timeout: 60000 });
    } catch (failure) {
      await attachEvidence(testInfo, "webgl-unavailable-or-scene-failure", {
        state: await story.getAttribute("data-story-state"),
        canvasCount: await story.locator("canvas").count(),
        renderer: await rendererEvidence(page),
        network: await scripts.snapshot(),
        errors,
      });
      throw failure;
    }
    await expect(story.locator("canvas")).toHaveCount(1);
    const canvasLayer = story
      .locator('div[aria-hidden="true"]')
      .filter({ has: page.locator("canvas") });
    await expect(canvasLayer).toHaveCSS("opacity", "1");
    await expect.poll(async () => (await rendererEvidence(page))?.draws ?? 0).toBeGreaterThan(0);
    await expect
      .poll(async () => Number(await story.getAttribute("data-rendered-frame")))
      .toBeGreaterThan(0);
    const firstRenderer = await rendererEvidence(page);
    expect(firstRenderer).not.toBeNull();
    expect(firstRenderer!.width).toBeGreaterThan(200);
    expect(firstRenderer!.height).toBeGreaterThan(200);

    await scrollStory(page, 0.15);
    await expect(canvasLayer).toHaveCSS("opacity", "1");
    const firstPose = await story.locator("canvas").screenshot();
    const firstPoseRenderer = await rendererEvidence(page);
    await page.screenshot({ path: ".local/cinematic-desktop-start.png" });
    await scrollStory(page, 0.8);
    await expect(canvasLayer).toHaveCSS("opacity", "1");
    const secondPose = await story.locator("canvas").screenshot();
    const secondPoseRenderer = await rendererEvidence(page);
    expect(createHash("sha256").update(secondPose).digest("hex")).not.toBe(
      createHash("sha256").update(firstPose).digest("hex"),
    );
    expect(secondPoseRenderer!.draws).toBeGreaterThan(firstPoseRenderer!.draws);
    await page.screenshot({ path: ".local/cinematic-desktop-finish.png" });
    await noOverflow(page);
    // Observe real browser frames until scene work settles, then take a longer idle sample.
    await expect
      .poll(async () => (await idleEvidence(page, firstRenderer!.index, 10)).drawDelta, {
        timeout: 15000,
      })
      .toBe(0);
    const idle = await idleEvidence(page, firstRenderer!.index);
    expect(idle.drawDelta).toBe(0);
    expect(idle.rendererFrameDelta).toBe(0);
    expect(idle.elapsedMs).toBeGreaterThan(200);
    const after = await story.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top + window.scrollY, width: box.width, height: box.height };
    });
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2);
    const enteredLayout = await layoutEvidence(page);
    expect(enteredLayout.total).toBeLessThanOrEqual(0.1);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(story).toHaveAttribute("data-story-active", "false");
    const offscreenIdle = await idleEvidence(page, firstRenderer!.index, 30);
    expect(offscreenIdle.drawDelta).toBe(0);
    await usableDialogs(page, false);

    await story.evaluate((element) => {
      (window as ObservedWindow).__velaCinematic!.retiredStory = element as HTMLElement;
    });
    await story.locator('a[href="/products/first-light-serum"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("First Light Serum");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect
      .poll(async () => (await rendererEvidence(page, firstRenderer!.index))?.lost)
      .toBe(true);
    const disposed = await rendererEvidence(page, firstRenderer!.index);
    expect(disposed!.connected).toBe(false);
    const retiredProgress = await page.evaluate(
      () => (window as ObservedWindow).__velaCinematic?.retiredStory?.dataset.storyProgress,
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await animationFrames(page, 10);
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await animationFrames(page, 10);
    expect(
      await page.evaluate(
        () => (window as ObservedWindow).__velaCinematic?.retiredStory?.dataset.storyProgress,
      ),
    ).toBe(retiredProgress);
    await page
      .getByRole("button", { name: /Add to bag/i })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText("First Light Serum", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close shopping bag", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await story.scrollIntoViewIfNeeded();
    await expect(story).toHaveAttribute("data-story-state", "ready");
    await expect(story.locator("canvas")).toHaveCount(1);
    await expect.poll(async () => (await rendererEvidence(page))?.draws ?? 0).toBeGreaterThan(0);
    const returned = await rendererEvidence(page);
    expect(returned!.index).not.toBe(firstRenderer!.index);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "reduced");
    await staticStory(page);
    await expect.poll(async () => (await rendererEvidence(page, returned!.index))?.lost).toBe(true);
    const disabledProgress = await story.getAttribute("data-story-progress");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await animationFrames(page, 10);
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await animationFrames(page, 10);
    await expect(story).toHaveAttribute("data-story-progress", disabledProgress!);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "active");
    await story.scrollIntoViewIfNeeded();
    await expect(story).toHaveAttribute("data-story-state", "ready");
    await expect(story.locator("canvas")).toHaveCount(1);
    await expect.poll(async () => (await rendererEvidence(page))?.draws ?? 0).toBeGreaterThan(0);
    await noOverflow(page);
    await attachEvidence(testInfo, "actual-software-webgl-and-local-layout", {
      note: "Local Chromium ANGLE SwiftShader rendering; not hardware FPS or field Core Web Vitals.",
      firstRenderer,
      firstPoseRenderer,
      secondPoseRenderer,
      idle,
      offscreenIdle,
      disposed,
      returned,
      retiredProgress,
      disabledProgress,
      initialLayout,
      enteredLayout,
      geometry: { before, after },
      network: await scripts.snapshot(),
    });
    expect(errors).toEqual([]);
  });

  test("reduced motion keeps normal flow without downloading cinematic runtimes", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await observeRendering(page);
    const scripts = observeHeavyScripts(page);
    const errors = observeErrors(page);
    await page.goto("/");
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "reduced");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await staticStory(page);
    await animationFrames(page);
    expect(
      await page
        .locator("[data-hero-line], [data-hero-image], [data-reveal], [data-parallax] img")
        .evaluateAll((elements) =>
          elements.every((element) => {
            const style = getComputedStyle(element);
            return style.transform === "none" && Number(style.opacity) === 1;
          }),
        ),
    ).toBe(true);
    const network = await scripts.snapshot();
    expect(network.loaded).toEqual([]);
    expect(await page.evaluate(() => (window as ObservedWindow).__THREE__)).toBeUndefined();
    expect(
      await page.evaluate(() => (window as ObservedWindow).__velaCinematic?.contexts.length),
    ).toBe(0);
    await page
      .getByTestId("product-story")
      .screenshot({ path: `.local/cinematic-reduced-${testInfo.project.name}.png` });
    await usableDialogs(page, testInfo.project.name === "mobile");
    await noOverflow(page);
    await attachEvidence(testInfo, "reduced-motion-network-and-layout", {
      network,
      layout: await layoutEvidence(page),
    });
    expect(errors).toEqual([]);
  });

  test("mobile uses the static product story and reacts to preference changes", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "The initial mobile fallback is a mobile-specific journey.",
    );
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await observeRendering(page);
    const scripts = observeHeavyScripts(page);
    const errors = observeErrors(page);
    await page.goto("/");
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "active");
    await staticStory(page);
    await animationFrames(page);
    const network = await scripts.snapshot();
    expect(network.loaded.filter((script) => script.libraries.includes("three"))).toEqual([]);
    expect(await page.evaluate(() => (window as ObservedWindow).__THREE__)).toBeUndefined();
    expect(
      await page.evaluate(() => (window as ObservedWindow).__velaCinematic?.contexts.length),
    ).toBe(0);
    await page
      .getByTestId("product-story")
      .screenshot({ path: ".local/cinematic-mobile-static.png" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "reduced");
    await staticStory(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "active");
    await staticStory(page);
    await usableDialogs(page, true);
    await attachEvidence(testInfo, "mobile-static-network-and-layout", {
      network,
      layout: await layoutEvidence(page),
    });
    expect(errors).toEqual([]);
  });

  test("unavailable WebGL leaves usable static product content", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Desktop capability denial exercises the WebGL gate.",
    );
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await observeRendering(page, true);
    const scripts = observeHeavyScripts(page);
    const errors = observeErrors(page);
    await page.goto("/");
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "active");
    await staticStory(page);
    await animationFrames(page);
    const network = await scripts.snapshot();
    expect(network.loaded.filter((script) => script.libraries.includes("three"))).toEqual([]);
    expect(await page.evaluate(() => (window as ObservedWindow).__THREE__)).toBeUndefined();
    await page.getByTestId("product-story").screenshot({ path: ".local/cinematic-no-webgl.png" });
    await usableDialogs(page, false);
    await attachEvidence(testInfo, "forced-no-webgl-network-and-layout", {
      network,
      layout: await layoutEvidence(page),
    });
    expect(errors).toEqual([]);
  });

  test("short desktop viewports keep the story in normal flow", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "The height gate is exercised on a desktop-width viewport.",
    );
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 650 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await observeRendering(page);
    const scripts = observeHeavyScripts(page);
    const errors = observeErrors(page);
    await page.goto("/");
    await expect(page.locator("#main")).toHaveAttribute("data-editorial-motion", "active");
    await staticStory(page);
    await animationFrames(page);
    const network = await scripts.snapshot();
    expect(network.loaded.filter((script) => script.libraries.includes("three"))).toEqual([]);
    expect(await page.evaluate(() => (window as ObservedWindow).__THREE__)).toBeUndefined();
    expect(
      await page.evaluate(() => (window as ObservedWindow).__velaCinematic?.contexts.length),
    ).toBe(0);
    await page
      .getByTestId("product-story")
      .screenshot({ path: ".local/cinematic-short-desktop.png" });
    await usableDialogs(page, false);
    await attachEvidence(testInfo, "short-desktop-network-and-layout", {
      network,
      layout: await layoutEvidence(page),
    });
    expect(errors).toEqual([]);
  });
});

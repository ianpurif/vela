import { describe, expect, it, vi } from "vitest";
import { clampProgress, getStoryPose } from "@/features/cinematic/pose";
import { localModelPath } from "@/features/cinematic/model-path";
import { createStoryProgress } from "@/features/cinematic/progress";

type Pose = ReturnType<typeof getStoryPose>;
function continuousValues(pose: Pose) {
  return [
    ...pose.bottle.position,
    ...pose.bottle.rotation,
    pose.bottle.scale,
    ...pose.camera.position,
    ...pose.camera.target,
    pose.droplets.spread,
    pose.droplets.opacity,
    pose.exit,
  ];
}

describe("scroll progress at the cinematic boundary", () => {
  it.each([-Number.MAX_VALUE, -20, -1, -Number.EPSILON])(
    "holds the opening pose before the section (%s)",
    (progress) => {
      expect(clampProgress(progress)).toBe(0);
      expect(getStoryPose(progress)).toEqual(getStoryPose(0));
    },
  );

  it.each([1 + Number.EPSILON, 2, 100, Number.MAX_VALUE])(
    "holds the exit pose after the section (%s)",
    (progress) => {
      expect(clampProgress(progress)).toBe(1);
      expect(getStoryPose(progress)).toEqual(getStoryPose(1));
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "recovers invalid measurements to the finite opening pose (%s)",
    (progress) => {
      expect(clampProgress(progress)).toBe(0);
      expect(getStoryPose(progress)).toEqual(getStoryPose(0));
      expect(continuousValues(getStoryPose(progress)).every(Number.isFinite)).toBe(true);
    },
  );

  it("preserves meaningful fractional progress without quantizing the scrub", () => {
    for (const progress of [0, 0.00001, 0.123456789, 0.5, 0.99999, 1]) {
      expect(clampProgress(progress)).toBe(progress);
    }
  });
});

describe("scroll-driven story pose invariants", () => {
  it("provides usable endpoints and visits all three chapters", () => {
    const first = getStoryPose(0);
    const last = getStoryPose(1);
    expect(first.chapter).toBe(0);
    expect(last.chapter).toBe(2);
    expect(first.exit).toBe(0);
    expect(last.exit).toBe(1);
    expect(continuousValues(first)).not.toEqual(continuousValues(last));
    const chapters = new Set(
      Array.from({ length: 101 }, (_, index) => getStoryPose(index / 100).chapter),
    );
    expect(chapters).toEqual(new Set([0, 1, 2]));
  });

  it("keeps geometry, opacity, and the camera finite and within a usable scene envelope", () => {
    for (let index = 0; index <= 2000; index += 1) {
      const pose = getStoryPose(index / 2000);
      expect(continuousValues(pose).every(Number.isFinite)).toBe(true);
      for (const vector of [
        pose.bottle.position,
        pose.bottle.rotation,
        pose.camera.position,
        pose.camera.target,
      ]) {
        expect(vector).toHaveLength(3);
        expect(vector.every((value) => Math.abs(value) <= 20)).toBe(true);
      }
      expect(pose.bottle.scale).toBeGreaterThan(0);
      expect(pose.bottle.scale).toBeLessThanOrEqual(20);
      expect(pose.droplets.spread).toBeGreaterThanOrEqual(0);
      expect(pose.droplets.spread).toBeLessThanOrEqual(20);
      expect(pose.droplets.opacity).toBeGreaterThanOrEqual(0);
      expect(pose.droplets.opacity).toBeLessThanOrEqual(1);
      expect(pose.exit).toBeGreaterThanOrEqual(0);
      expect(pose.exit).toBeLessThanOrEqual(1);
      const cameraDistance = Math.hypot(
        ...pose.camera.position.map((value, axis) => value - pose.camera.target[axis]),
      );
      expect(cameraDistance).toBeGreaterThan(0.01);
    }
  });

  it("does not snap any continuous channel during a dense forward scrub", () => {
    let previous = continuousValues(getStoryPose(0));
    for (let index = 1; index <= 2000; index += 1) {
      const current = continuousValues(getStoryPose(index / 2000));
      const largestStep = Math.max(
        ...current.map((value, channel) => Math.abs(value - previous[channel])),
      );
      // At 0.05% progress per sample, a jump this large would be visible even
      // without pinning tests to the artist's exact positions or easing formula.
      expect(largestStep).toBeLessThan(0.1);
      previous = current;
    }
  });

  it.each([0.22, 0.55, 0.82])(
    "arrives smoothly on both sides of the %s pose keyframe",
    (progress) => {
      const center = continuousValues(getStoryPose(progress)).slice(0, 13);
      for (const delta of [-0.0001, 0.0001]) {
        const neighbor = continuousValues(getStoryPose(progress + delta)).slice(0, 13);
        expect(
          Math.max(...center.map((value, channel) => Math.abs(value - neighbor[channel]))),
        ).toBeLessThan(0.00001);
      }
    },
  );

  it("keeps exit and chapter progression monotone while permitting reversible scrubbing", () => {
    let previous = getStoryPose(0);
    for (let index = 1; index <= 1000; index += 1) {
      const current = getStoryPose(index / 1000);
      expect(current.exit).toBeGreaterThanOrEqual(previous.exit);
      expect(current.chapter).toBeGreaterThanOrEqual(previous.chapter);
      previous = current;
    }
    const progress = [0.93, 0.18, 0.62, 0.01, 1, 0.4, 0];
    const expected = progress.map(getStoryPose);
    progress.toReversed().forEach(getStoryPose);
    expect(progress.map(getStoryPose)).toEqual(expected);
  });

  it("returns independent tuples so Three mutations cannot corrupt future scroll poses", () => {
    const baseline = getStoryPose(0.37);
    const changed = getStoryPose(0.37);
    changed.bottle.position[0] = 999;
    changed.bottle.rotation[1] = 999;
    changed.camera.position[2] = 999;
    changed.camera.target[0] = 999;
    changed.bottle.scale = 999;
    changed.droplets.opacity = 999;
    expect(getStoryPose(0.37)).toEqual(baseline);
  });
});

describe("demand-render progress notifications", () => {
  it("notifies only on a changed normalized pose, avoiding repeated idle invalidation", () => {
    const progress = createStoryProgress();
    const changed = vi.fn();
    progress.subscribe(changed);
    expect(progress.get()).toBe(0);
    progress.set(-1);
    progress.set(0.3);
    progress.set(0.3);
    progress.set(2);
    progress.set(1);
    expect(changed.mock.calls).toEqual([[0.3], [1]]);
    expect(progress.get()).toBe(1);
  });

  it("removes a detached listener without disrupting another active scene subscriber", () => {
    const progress = createStoryProgress();
    const disposed = vi.fn();
    const active = vi.fn();
    const unsubscribe = progress.subscribe(disposed);
    progress.subscribe(active);
    progress.set(0.2);
    unsubscribe();
    unsubscribe();
    progress.set(0.7);
    expect(disposed.mock.calls).toEqual([[0.2]]);
    expect(active.mock.calls).toEqual([[0.2], [0.7]]);
  });

  it("recovers a bad measurement once without emitting non-finite values", () => {
    const progress = createStoryProgress();
    const changed = vi.fn();
    progress.set(0.5);
    progress.subscribe(changed);
    progress.set(Number.NaN);
    progress.set(Number.POSITIVE_INFINITY);
    progress.set(Number.NEGATIVE_INFINITY);
    expect(changed.mock.calls).toEqual([[0]]);
    expect(progress.get()).toBe(0);
  });
});

describe("optional local model path isolation", () => {
  it.each(["/models/vela-bottle.glb", "/models/serum.gltf", "/models/vela/serum_v2.glb"])(
    "accepts an unchanged local model path: %s",
    (path) => {
      expect(localModelPath(path)).toBe(path);
    },
  );

  it.each([
    undefined,
    "",
    "https://cdn.example.test/bottle.glb",
    "http://127.0.0.1:3000/models/bottle.glb",
    "//cdn.example.test/bottle.glb",
    "data:model/gltf-binary;base64,AAAA",
    "blob:https://vela.example.test/model",
    "javascript:alert(1)",
    "C:\\models\\bottle.glb",
    "models/bottle.glb",
    "./models/bottle.glb",
    "/private/bottle.glb",
    "/models-other/bottle.glb",
    "/models/../private/bottle.glb",
    "/models/serum/../../private/bottle.glb",
    "/models/./bottle.glb",
    "/models\\bottle.glb",
    "/models/serum\\..\\bottle.glb",
    "/models/%2e%2e/bottle.glb",
    "/models/%252e%252e/bottle.glb",
    "/models/serum%2fbottle.glb",
    "/models/bottle.glb?download=https://example.test",
    "/models/bottle.glb#fragment",
    "/models/bottle.glb/extra",
    "/models/bottle.obj",
    "/models/bottle.png",
    "/models/bottle\u0000.glb",
    "/models/bottle.glb\n",
    "/models/bottle.glb\r\n",
    " /models/bottle.glb",
    "/models/bottle.glb ",
    `/models/${"a".repeat(229)}.glb`,
  ])("falls back instead of loading an unsafe or unsupported path: %s", (path) => {
    expect(localModelPath(path)).toBeNull();
  });
});

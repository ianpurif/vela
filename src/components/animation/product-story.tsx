"use client";

import Image from "next/image";
import Link from "next/link";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneBoundary } from "@/components/three/scene-boundary";
import { createStoryProgress } from "@/features/cinematic/progress";
import { localModelPath } from "@/features/cinematic/model-path";
import { getStoryPose } from "@/features/cinematic/pose";
import { cloudinaryDeliveryUrl } from "@/lib/cloudinary/delivery";
import { money } from "@/lib/utils";
import type { Product } from "@/types/commerce";
import styles from "./product-story.module.css";

// React.lazy does not request the scene until the guarded branch is rendered.
const SerumScene = lazy(() => import("@/components/three/serum-scene"));
const motionQuery =
  "(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";

function supportsWebGL2() {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2", { alpha: true, antialias: false });
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function ProductStory({ product, modelUrl }: { product: Product; modelUrl?: string }) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const progress = useMemo(() => createStoryProgress(), []);
  const [capable, setCapable] = useState(false);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = capable && inView && tabVisible && !failed;
  const enhanced = capable && !failed;
  const state = failed
    ? "failed"
    : !capable
      ? "static"
      : ready
        ? "ready"
        : near
          ? "loading"
          : "deferred";
  const path = localModelPath(modelUrl);
  const image = product.images[0];
  const available = product.status === "published" && product.stock - product.reserved > 0;
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const onFrame = useCallback((frame: number) => {
    if (root.current) root.current.dataset.renderedFrame = String(frame);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia(motionQuery);
    let webgl: boolean | undefined;
    const assess = () => {
      if (media.matches && webgl === undefined) webgl = supportsWebGL2();
      setCapable(media.matches && webgl === true);
      if (!media.matches) setReady(false);
    };
    // Reserve the desktop scroll geometry before the scene is requested or becomes visible.
    assess();
    media.addEventListener("change", assess);
    const proximity = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          proximity.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    const visibility = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0 },
    );
    proximity.observe(element);
    visibility.observe(element);
    const tab = () => setTabVisible(document.visibilityState === "visible");
    tab();
    document.addEventListener("visibilitychange", tab);
    return () => {
      media.removeEventListener("change", assess);
      proximity.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", tab);
    };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!enhanced || !near || !element) return;
    let cancelled = false;
    let dispose = () => {};
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const panels = element.querySelectorAll<HTMLElement>("[data-story-copy]");
        const meter = element.querySelector<HTMLElement>("[data-story-meter]");
        const context = gsap.context(() => {
          const timeline = gsap.timeline({ paused: true });
          timeline
            .to({}, { duration: 1 }, 0)
            .fromTo(
              panels[0],
              { opacity: 1, y: 0 },
              { opacity: 0, y: -18, duration: 0.08, ease: "none" },
              0.24,
            )
            .fromTo(
              panels[1],
              { opacity: 0, y: 18 },
              { opacity: 1, y: 0, duration: 0.08, ease: "none" },
              0.3,
            )
            .to(panels[1], { opacity: 0, y: -18, duration: 0.08, ease: "none" }, 0.6)
            .fromTo(
              panels[2],
              { opacity: 0, y: 18 },
              { opacity: 1, y: 0, duration: 0.08, ease: "none" },
              0.66,
            );
          const update = (value: number) => {
            progress.set(value);
            timeline.progress(value);
            element.dataset.storyProgress = value.toFixed(4);
            element.dataset.storyChapter = String(getStoryPose(value).chapter);
            if (meter) gsap.set(meter, { scaleX: value });
          };
          const trigger = ScrollTrigger.create({
            id: "vela-product-story",
            trigger: element,
            start: "top 88px",
            end: "bottom bottom",
            onUpdate: (self) => update(self.progress),
            onRefresh: (self) => update(self.progress),
          });
          update(trigger.progress);
          dispose = () => {
            trigger.kill();
            context.revert();
            ScrollTrigger.refresh();
          };
        }, element);
        ScrollTrigger.refresh();
      })
      .catch(() => {
        if (!cancelled) onFailure();
      });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [enhanced, near, onFailure, progress]);

  return (
    <section
      ref={root}
      aria-labelledby={titleId}
      data-testid="product-story"
      data-story-state={state}
      data-story-enhanced={enhanced}
      data-story-active={active}
      data-story-progress="0"
      className={styles.story}
    >
      <div data-story-viewport className={styles.viewport}>
        <div className={styles.visual}>
          <div data-story-fallback className={styles.still} aria-hidden={ready && enhanced}>
            <Image
              src={cloudinaryDeliveryUrl(image?.src ?? "/images/first-light-serum.webp", 1400)}
              alt={
                image?.alt ??
                "First Light Serum amber bottle with champagne collar and ivory dropper"
              }
              fill
              sizes="(min-width: 1024px) 54vw, 100vw"
              className={styles.photograph}
            />
          </div>
          {enhanced && near && (tabVisible || ready) && (
            <div className={styles.canvas} aria-hidden="true">
              <SceneBoundary onError={onFailure}>
                <Suspense fallback={null}>
                  <SerumScene
                    progress={progress}
                    active={active}
                    modelUrl={path}
                    onReady={onReady}
                    onFailure={onFailure}
                    onFrame={onFrame}
                  />
                </Suspense>
              </SceneBoundary>
            </div>
          )}
          <span className={styles.backdropWord} aria-hidden="true">
            first light
          </span>
        </div>
        <div className={styles.copy}>
          <p className="eyebrow mb-5 text-olive/80">A closer look / The daily ritual</p>
          <h2 id={titleId} className={styles.title}>
            {product.name}
          </h2>
          <div className={styles.productFacts}>
            <span>{product.size}</span>
            <span>{money(product.price)}</span>
            <span>{available ? "Available now" : "Currently unavailable"}</span>
          </div>
          <div className={styles.chapters}>
            <div data-story-copy className={styles.chapter}>
              <p className={styles.chapterNumber}>01 / A fresh beginning</p>
              <h3>
                A little light,
                <br />
                <em>every day.</em>
              </h3>
              <p>{product.description}</p>
            </div>
            <div data-story-copy className={styles.chapter}>
              <p className={styles.chapterNumber}>02 / A considered formula</p>
              <h3>
                Considered,
                <br />
                <em>drop by drop.</em>
              </h3>
              <ul>
                {product.benefits.slice(0, 3).map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <p className={styles.abstractNote}>
                The floating forms are an abstract study of texture.
              </p>
            </div>
            <div data-story-copy className={styles.chapter}>
              <p className={styles.chapterNumber}>03 / Your quiet moment</p>
              <h3>
                Make a little
                <br />
                <em>room for you.</em>
              </h3>
              <p>{product.usage}</p>
            </div>
          </div>
          <div className={styles.actions}>
            <Button asChild>
              <Link href={`/products/${product.slug}`}>
                Explore {product.name}
                <ArrowUpRight size={15} />
              </Link>
            </Button>
            <span className={styles.scrollHint}>
              <ArrowDown size={12} />
              Scroll to discover
            </span>
          </div>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <span data-story-meter />
        </div>
      </div>
    </section>
  );
}

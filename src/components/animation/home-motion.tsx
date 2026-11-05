"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Progressive decoration: server-rendered shopping content is always visible. */
export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    let started = false;
    let media: gsap.MatchMedia | undefined;
    const element = root.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    async function enhance() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !element) return;
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia(element);
      media.add(
        {
          all: "(min-width: 0px)",
          motion: "(prefers-reduced-motion: no-preference)",
          desktop: "(min-width: 1024px)",
        },
        (context) => {
          const { motion, desktop } = context.conditions!;
          element.dataset.editorialMotion = motion ? "active" : "reduced";
          if (!motion) return;
          const hero = element.querySelector<HTMLElement>(".hero-section");
          // Returning to a scrolled page should not replay the entrance above it.
          if (hero && hero.getBoundingClientRect().bottom > 0) {
            gsap.fromTo(
              element.querySelectorAll("[data-hero-line]"),
              { yPercent: 24, opacity: 0.35 },
              {
                yPercent: 0,
                opacity: 1,
                duration: 0.85,
                stagger: 0.12,
                ease: "power3.out",
                clearProps: "transform,opacity",
              },
            );
            gsap.fromTo(
              element.querySelectorAll("[data-hero-detail]"),
              { y: 12, opacity: 0.6 },
              {
                y: 0,
                opacity: 1,
                duration: 0.75,
                delay: 0.15,
                stagger: 0.08,
                ease: "power2.out",
                clearProps: "transform,opacity",
              },
            );
          }
          element.querySelectorAll<HTMLElement>("[data-reveal]").forEach((section) => {
            gsap.fromTo(
              section,
              { y: 26 },
              {
                y: 0,
                duration: 0.9,
                ease: "power3.out",
                clearProps: "transform",
                scrollTrigger: { trigger: section, start: "top 92%", once: true },
              },
            );
          });
          if (desktop) {
            const heroImage = element.querySelector("[data-hero-image]");
            if (heroImage && hero) {
              gsap.fromTo(
                heroImage,
                { scale: 1.06, yPercent: 0 },
                {
                  yPercent: -3,
                  ease: "none",
                  scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 },
                },
              );
            }
            element.querySelectorAll<HTMLElement>("[data-parallax]").forEach((frame) => {
              const visual = frame.querySelector("img");
              if (!visual) return;
              gsap.fromTo(
                visual,
                { scale: 1.09, yPercent: -3 },
                {
                  yPercent: 3,
                  ease: "none",
                  scrollTrigger: {
                    trigger: frame,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.6,
                  },
                },
              );
            });
          }
        },
      );
    }
    const startWhenAllowed = () => {
      if (preference.matches) {
        if (element) element.dataset.editorialMotion = "reduced";
        return;
      }
      if (started) return;
      started = true;
      // A failed enhancement leaves the complete static storefront usable.
      void enhance().catch(() => {
        media?.revert();
        if (element) element.dataset.editorialMotion = "static";
      });
    };
    // Initial reduced-motion visits do not download the animation libraries.
    preference.addEventListener("change", startWhenAllowed);
    startWhenAllowed();
    return () => {
      cancelled = true;
      preference.removeEventListener("change", startWhenAllowed);
      media?.revert();
    };
  }, []);
  return (
    <main id="main" ref={root} data-editorial-motion="static">
      {children}
    </main>
  );
}

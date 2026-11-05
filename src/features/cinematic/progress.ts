import { clampProgress } from "./pose";

export type StoryProgress = {
  get: () => number;
  set: (value: number) => void;
  subscribe: (listener: (value: number) => void) => () => void;
};
/** A tiny imperative channel avoids React renders for every scroll event. */
export function createStoryProgress(): StoryProgress {
  let progress = 0;
  const listeners = new Set<(value: number) => void>();
  return {
    get: () => progress,
    set: (value) => {
      const next = clampProgress(value);
      if (next === progress) return;
      progress = next;
      listeners.forEach((listener) => listener(progress));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

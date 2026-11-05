export type Vector3Tuple = [number, number, number];
export type StoryPose = {
  bottle: { position: Vector3Tuple; rotation: Vector3Tuple; scale: number };
  camera: { position: Vector3Tuple; target: Vector3Tuple };
  droplets: { spread: number; opacity: number };
  chapter: 0 | 1 | 2;
  exit: number;
};

export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
const smooth = (value: number) => {
  const t = clampProgress(value);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const vector = (a: Vector3Tuple, b: Vector3Tuple, t: number): Vector3Tuple => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];
type Keyframe = {
  at: number;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: number;
  camera: Vector3Tuple;
  target: Vector3Tuple;
};
const keyframes: Keyframe[] = [
  {
    at: 0,
    position: [1.5, -0.4, -0.2],
    rotation: [-0.08, -0.4, -0.1],
    scale: 0.84,
    camera: [0, 0.15, 8.1],
    target: [0, 0.1, 0],
  },
  {
    at: 0.22,
    position: [1.45, 0, 0],
    rotation: [0.04, 0.12, 0.04],
    scale: 1,
    camera: [0, 0.12, 7.5],
    target: [0, 0.05, 0],
  },
  {
    at: 0.55,
    position: [1.3, 0.08, 0],
    rotation: [0.1, 2.9, -0.07],
    scale: 1.03,
    camera: [0.2, 0.2, 7.1],
    target: [0.1, 0.08, 0],
  },
  {
    at: 0.82,
    position: [1.45, 0, 0],
    rotation: [0, Math.PI * 2 - 0.12, 0.03],
    scale: 0.97,
    camera: [0, 0.15, 7.5],
    target: [0, 0.05, 0],
  },
  {
    at: 1,
    position: [1.6, 0.35, -0.3],
    rotation: [-0.04, Math.PI * 2 + 0.12, 0.08],
    scale: 0.85,
    camera: [0, 0.1, 8],
    target: [0, 0.1, 0],
  },
];

/** Scroll position alone controls the scene. Every call returns independent mutable tuples. */
export function getStoryPose(value: number): StoryPose {
  const progress = clampProgress(value);
  const end = keyframes.findIndex((frame) => frame.at >= progress);
  const right = keyframes[Math.max(1, end)];
  const left = keyframes[Math.max(0, end - 1)];
  const t = smooth((progress - left.at) / (right.at - left.at));
  return {
    bottle: {
      position: vector(left.position, right.position, t),
      rotation: vector(left.rotation, right.rotation, t),
      scale: mix(left.scale, right.scale, t),
    },
    camera: {
      position: vector(left.camera, right.camera, t),
      target: vector(left.target, right.target, t),
    },
    droplets: {
      spread: 0.45 + smooth((progress - 0.18) / 0.36) * 1.2,
      opacity: smooth((progress - 0.18) / 0.18) * (1 - smooth((progress - 0.7) / 0.16)),
    },
    chapter: progress < 0.3 ? 0 : progress < 0.66 ? 1 : 2,
    exit: smooth((progress - 0.86) / 0.14),
  };
}

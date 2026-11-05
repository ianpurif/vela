"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { CanvasTexture, Group, Mesh, MeshPhysicalMaterial, SRGBColorSpace } from "three";
import { getStoryPose } from "@/features/cinematic/pose";
import type { StoryProgress } from "@/features/cinematic/progress";
import { ProceduralBottle } from "./procedural-bottle";
import { SceneBoundary } from "./scene-boundary";

const LocalBottle = lazy(() => import("./local-bottle"));
const dropletAngles = [-0.65, 0.25, 1.35, 2.2, 3.35, 4.3, 5.3];

function stoneTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Stone texture is unavailable.");
  context.fillStyle = "#d4c1a4";
  context.fillRect(0, 0, 256, 256);
  let seed = 17;
  for (let index = 0; index < 1800; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 256;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % 256;
    context.fillStyle = index % 3 ? "rgba(113,89,60,.08)" : "rgba(255,247,227,.18)";
    context.fillRect(x, y, (index % 5) + 1, (index % 2) + 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function SceneContents({
  progress,
  active,
  modelUrl,
  onFailure,
  onFrame,
}: {
  progress: StoryProgress;
  active: boolean;
  modelUrl: string | null;
  onFailure: () => void;
  onFrame: (frame: number) => void;
}) {
  const bottle = useRef<Group>(null);
  const droplets = useRef<Group>(null);
  const drops = useRef<(Mesh | null)[]>([]);
  const activeRef = useRef(active);
  const warmed = useRef(false);
  const { camera, gl, invalidate, size } = useThree();
  const stone = useMemo(() => stoneTexture(), []);
  const dropletMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#c68c38",
        roughness: 0.08,
        metalness: 0.22,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        clearcoat: 1,
      }),
    [],
  );
  const apply = useCallback(
    (value: number) => {
      if (!activeRef.current && warmed.current) return;
      const pose = getStoryPose(value);
      if (bottle.current) {
        bottle.current.position.set(...pose.bottle.position);
        bottle.current.rotation.set(...pose.bottle.rotation);
        bottle.current.scale.setScalar(pose.bottle.scale);
      }
      camera.position.set(...pose.camera.position);
      camera.lookAt(...pose.camera.target);
      if (droplets.current) droplets.current.visible = pose.droplets.opacity > 0.003;
      dropletMaterial.setValues({ opacity: pose.droplets.opacity * 0.8 });
      drops.current.forEach((drop, index) => {
        if (!drop) return;
        const angle = dropletAngles[index] + value * 0.8;
        drop.position.set(
          pose.bottle.position[0] + Math.cos(angle) * pose.droplets.spread,
          Math.sin(angle) * 1.22 + 0.18,
          Math.sin(angle * 1.5) * 0.7,
        );
        drop.rotation.z = -angle * 0.22;
      });
      invalidate();
    },
    [camera, dropletMaterial, invalidate],
  );
  useEffect(() => {
    activeRef.current = active;
    if (active) apply(progress.get());
  }, [active, apply, progress]);
  useEffect(() => {
    apply(progress.get());
    return progress.subscribe(apply);
  }, [apply, progress]);
  useEffect(() => {
    apply(progress.get());
  }, [apply, progress, size.width, size.height]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  useEffect(
    () => () => {
      stone.dispose();
      dropletMaterial.dispose();
    },
    [stone, dropletMaterial],
  );
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[-4, 6, 5]} color="#fff1d6" intensity={3.1} />
      <directionalLight position={[4, 2, -3]} color="#edbd78" intensity={1.25} />
      <Environment resolution={128} frames={1} environmentIntensity={0.7}>
        <Lightformer
          form="rect"
          intensity={3}
          color="#fff6e6"
          position={[4, 3, 5]}
          target={[0, 0, 0]}
          scale={[3, 7, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#ffffff"
          position={[-5, 1, 2]}
          target={[0, 0, 0]}
          scale={[2, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#d8ad70"
          position={[2, 4, -4]}
          target={[0, 0, 0]}
          scale={[4, 3, 1]}
        />
      </Environment>
      <group ref={bottle}>
        {modelUrl ? (
          <SceneBoundary key={modelUrl} fallback={<ProceduralBottle />}>
            <Suspense fallback={<ProceduralBottle />}>
              <LocalBottle url={modelUrl} />
            </Suspense>
          </SceneBoundary>
        ) : (
          <ProceduralBottle />
        )}
      </group>
      <group ref={droplets} visible={false}>
        {dropletAngles.map((angle, index) => (
          <mesh
            key={angle}
            ref={(mesh) => {
              drops.current[index] = mesh;
            }}
            material={dropletMaterial}
            scale={[0.1 + (index % 3) * 0.018, 0.17 + (index % 2) * 0.025, 0.1]}
          >
            <sphereGeometry args={[1, 20, 16]} />
          </mesh>
        ))}
      </group>
      <mesh
        position={[1.5, -2.08, 0]}
        onAfterRender={(renderer) => {
          warmed.current = true;
          onFrame(renderer.info.render.frame);
        }}
      >
        <cylinderGeometry args={[1.42, 1.45, 0.28, 64]} />
        <meshStandardMaterial map={stone} roughness={0.94} color="#dbc8aa" />
      </mesh>
      <mesh position={[1.5, -1.931, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.65, 1]}>
        <circleGeometry args={[0.64, 48]} />
        <meshBasicMaterial color="#725337" transparent opacity={0.13} depthWrite={false} />
      </mesh>
    </>
  );
}

export default function SerumScene({
  progress,
  active,
  modelUrl,
  onReady,
  onFailure,
  onFrame,
}: {
  progress: StoryProgress;
  active: boolean;
  modelUrl: string | null;
  onReady: () => void;
  onFailure: () => void;
  onFrame: (frame: number) => void;
}) {
  const [warmed, setWarmed] = useState(false);
  const firstFrame = useRef(false);
  const report = useCallback(
    (frame: number) => {
      onFrame(frame);
      if (!firstFrame.current) {
        firstFrame.current = true;
        setWarmed(true);
        onReady();
      }
    },
    [onFrame, onReady],
  );
  return (
    <Canvas
      frameloop={active || !warmed ? "demand" : "never"}
      dpr={[1, 1.5]}
      camera={{ fov: 35, near: 0.1, far: 30, position: [0, 0.15, 8.1] }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 150 } }}
      style={{ pointerEvents: "none" }}
      onCreated={(state) => {
        state.gl.setClearColor(0x000000, 0);
        state.events.disconnect?.();
      }}
      fallback={null}
    >
      <SceneContents
        progress={progress}
        active={active}
        modelUrl={modelUrl}
        onFailure={onFailure}
        onFrame={report}
      />
    </Canvas>
  );
}

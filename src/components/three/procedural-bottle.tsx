"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace, Vector2 } from "three";

const body = [
  [0, -1.5],
  [0.42, -1.5],
  [0.54, -1.48],
  [0.59, -1.42],
  [0.61, -1.31],
  [0.61, 0.5],
  [0.6, 0.6],
  [0.56, 0.7],
  [0.47, 0.79],
  [0.34, 0.85],
  [0.31, 0.9],
  [0.31, 1],
  [0, 1],
].map(([x, y]) => new Vector2(x, y));
const bulb = [
  [0, 1.44],
  [0.23, 1.44],
  [0.22, 1.5],
  [0.19, 1.58],
  [0.18, 1.7],
  [0.18, 1.98],
  [0.16, 2.08],
  [0.11, 2.16],
  [0.05, 2.2],
  [0, 2.21],
].map(([x, y]) => new Vector2(x, y));

function makeLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 850;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas label is unavailable.");
  context.fillStyle = "#efe2c9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#32291e";
  context.textAlign = "center";
  context.font = "130px Georgia, serif";
  context.fillText("V E L A", 384, 260);
  context.fillStyle = "#bb9151";
  context.fillRect(278, 356, 212, 5);
  context.fillStyle = "#32291e";
  context.font = "80px Georgia, serif";
  context.fillText("First Light", 384, 510);
  context.fillText("Serum", 384, 603);
  context.font = "31px Georgia, serif";
  context.fillText("30 mL", 384, 759);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Matches the supplied First Light reference; authored geometry, no substitute model. */
export function ProceduralBottle() {
  const label = useMemo(() => makeLabel(), []);
  useEffect(() => () => label.dispose(), [label]);
  return (
    <group position={[0, -0.35, 0]} name="first-light-procedural">
      <mesh name="amber-glass">
        <latheGeometry args={[body, 64]} />
        <meshPhysicalMaterial
          color="#984414"
          roughness={0.14}
          metalness={0.02}
          transmission={0.38}
          thickness={0.45}
          ior={1.47}
          attenuationColor="#a64c12"
          attenuationDistance={1.3}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh position={[0, -0.34, 0]}>
        <cylinderGeometry args={[0.525, 0.53, 1.88, 48]} />
        <meshStandardMaterial
          color="#b66516"
          roughness={0.2}
          metalness={0.05}
          transparent
          opacity={0.64}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.27, 0]} name="cream-label">
        <cylinderGeometry args={[0.616, 0.616, 1.27, 48, 1, true, -0.89, 1.78]} />
        <meshStandardMaterial map={label} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, -1.41, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.554, 0.04, 12, 64]} />
        <meshStandardMaterial color="#5a270e" roughness={0.18} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.175, 0]} name="champagne-collar">
        <cylinderGeometry args={[0.365, 0.365, 0.55, 64]} />
        <meshStandardMaterial
          color="#d3af70"
          metalness={0.92}
          roughness={0.18}
          envMapIntensity={1.3}
        />
      </mesh>
      {[0.905, 1.445].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.355, 0.015, 8, 64]} />
          <meshStandardMaterial color="#e5c48c" metalness={0.92} roughness={0.14} />
        </mesh>
      ))}
      <mesh name="ivory-bulb">
        <latheGeometry args={[bulb, 48]} />
        <meshPhysicalMaterial
          color="#f1e7d6"
          roughness={0.38}
          clearcoat={0.3}
          clearcoatRoughness={0.3}
        />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 2.15, 12]} />
        <meshStandardMaterial
          color="#f6d297"
          transparent
          opacity={0.34}
          roughness={0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -1.2, 0]} scale={[1, 1.4, 1]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#dda13e" roughness={0.15} metalness={0.15} />
      </mesh>
    </group>
  );
}

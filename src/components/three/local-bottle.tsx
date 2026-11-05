"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Group, LoadingManager, Material, Mesh, Texture, Vector3 } from "three";
import type { GLTFLoader } from "three-stdlib";
import { localModelPath } from "@/features/cinematic/model-path";

function localResources(loader: GLTFLoader) {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith("blob:") || /^data:(?:image\/|application\/octet-stream)/.test(url))
      return url;
    const resolved = new URL(url, window.location.origin);
    if (
      resolved.origin !== window.location.origin ||
      !resolved.pathname.startsWith("/models/") ||
      resolved.search ||
      resolved.hash
    )
      throw new Error("Model resources must stay local to /models/.");
    return resolved.href;
  });
  loader.manager = manager;
}

export default function LocalBottle({ url }: { url: string }) {
  const path = localModelPath(url);
  if (!path) throw new Error("Unsupported model path.");
  // No remote Draco or Meshopt decoder. Author an uncompressed, local asset.
  const { scene } = useGLTF(path, false, false, localResources);
  const owned = useMemo(() => {
    const model = scene.clone(true);
    const geometries = new Set<Mesh["geometry"]>();
    const materials = new Set<Material>();
    const textures = new Map<Texture, Texture>();
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry = node.geometry.clone();
      geometries.add(node.geometry);
      const cloneMaterial = (original: Material) => {
        const material = original.clone();
        materials.add(material);
        for (const key of Object.keys(material)) {
          const record = material as unknown as Record<string, unknown>;
          const value = record[key];
          if (value instanceof Texture) {
            if (!textures.has(value)) textures.set(value, value.clone());
            record[key] = textures.get(value);
          }
        }
        return material;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(cloneMaterial)
        : cloneMaterial(node.material);
    });
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    if (
      ![size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite) ||
      size.y <= 0 ||
      Math.max(size.x, size.y, size.z) > 100000
    )
      throw new Error("Model bounds are invalid.");
    model.position.sub(center);
    const group = new Group();
    group.add(model);
    group.scale.setScalar(3.7 / size.y);
    return { group, geometries, materials, textures };
  }, [scene]);
  useEffect(
    () => () => {
      owned.geometries.forEach((geometry) => geometry.dispose());
      owned.materials.forEach((material) => material.dispose());
      owned.textures.forEach((texture) => texture.dispose());
      useGLTF.clear(path);
    },
    [owned, path],
  );
  return <primitive object={owned.group} dispose={null} />;
}

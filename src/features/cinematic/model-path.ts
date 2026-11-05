/** Optional authored assets are local, under /models, and never inferred from product data. */
export function localModelPath(value?: string): string | null {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length > 240 ||
    value.includes("..")
  )
    return null;
  return /^\/models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:glb|gltf)$/i.test(value)
    ? value
    : null;
}

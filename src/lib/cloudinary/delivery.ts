/** Pure delivery helper, safe to import in browser components. */
export function cloudinaryDeliveryUrl(src: string, width: number): string {
  if (
    !/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/v\d+\/vela\/products\/[a-zA-Z0-9_-]+\.(jpg|png|webp|avif)$/.test(
      src,
    )
  )
    return src;
  const boundedWidth = Math.max(
    1,
    Math.min(2400, Math.round(Number.isFinite(width) ? width : 1200)),
  );
  return src.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${boundedWidth}/`);
}

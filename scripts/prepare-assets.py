"""Create display assets from the supplied VELA photographs without resizing.

Requires Pillow: python -m pip install Pillow
Run from any directory: python scripts/prepare-assets.py
Original images are never modified. Generated files are deterministic for a
given Pillow/libwebp version. No image generation or stock assets are used.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "images"
ASSETS = [
    (1, "hero-ritual", "Sunlit skincare portrait beside ivory VELA bottles and olive branches"),
    (2, "collection-travertine", "VELA skincare bottles arranged on warm travertine blocks"),
    (3, "cleanser-bottle", "Ivory pump cleanser bottle on travertine beneath botanical shadows"),
    (4, "first-light-serum", "Amber First Light Serum dropper bottle with white blossoms"),
    (5, "soft-landing-cream", "Soft Landing Cream jar with a champagne lid and white blossoms"),
    (6, "serum-texture", "Golden serum droplets and a glass pipette"),
    (7, "cream-texture", "Soft folds of ivory cream"),
    (8, "cleanser-texture", "Airy cleansing foam on a warm sand background"),
    (9, "cream-ritual", "A woman gently applying cream during her skincare ritual"),
    (10, "ritual-gift-box", "An open VELA gift box with skincare bottles and tissue paper"),
    (11, "essence-bottle", "Frosted essence bottle with a champagne cap on travertine"),
    (12, "evening-tide-oil", "Golden Evening Tide Oil dropper bottle framed by blossoms"),
    (13, "clear-day-milk", "Ivory Clear Day Milk tube with a champagne cap"),
    (14, "ritual-flatlay", "VELA skincare packaging and bottles arranged on natural linen"),
    (15, "serum-ritual", "A woman applying serum beside a sunlit bathroom mirror"),
    (16, "golden-hour-portrait", "Warm editorial portrait beside VELA skincare on travertine"),
    (17, "gel-texture", "Translucent golden gel with small suspended bubbles"),
    (18, "foam-texture", "Soft white cleansing foam and clear bubbles on sand"),
    (19, "botanical-still-life", "A serum bottle and cream jar with citrus, blossoms, and botanical leaves"),
    (20, "collection-sunlight", "Four VELA skincare products on stone in warm botanical light"),
]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    original_bytes = 0
    optimized_bytes = 0
    for index, name, alt in ASSETS:
        source = ROOT / "images" / f"img{index}.png"
        destination = OUTPUT / f"{name}.webp"
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            width, height = image.size
            image.save(destination, "WEBP", quality=88, method=6)
        with Image.open(destination) as verification:
            verification.load()
            assert verification.size == (width, height)
            assert verification.format == "WEBP"
        source_size = source.stat().st_size
        output_size = destination.stat().st_size
        original_bytes += source_size
        optimized_bytes += output_size
        manifest.append({
            "source": f"images/img{index}.png",
            "src": f"/images/{name}.webp",
            "width": width,
            "height": height,
            "alt": alt,
            "bytes": output_size,
        })
        print(f"{source.name}: {width}x{height} -> {destination.name} ({output_size:,} bytes)")
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    reduction = 100 * (1 - optimized_bytes / original_bytes)
    print(f"Verified {len(manifest)} assets; {original_bytes:,} -> {optimized_bytes:,} bytes ({reduction:.1f}% smaller).")


if __name__ == "__main__":
    main()

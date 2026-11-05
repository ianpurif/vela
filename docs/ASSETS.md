# VELA supplied image audit

Inspected all 20 supplied PNGs visually on 2026-11-05, including a larger product-label review. They form a consistent art direction: warm natural light, ivory/champagne packaging, travertine, soft botanical shadows, and intimate skincare rituals. No external stock imagery is needed.

## Preparation and quality

- Originals remain untouched in `images/`.
- `python scripts/prepare-assets.py` regenerates the display files below with Pillow: WebP quality 88, method 6, EXIF orientation applied, native dimensions retained, no upscaling or cropping.
- All outputs were decoded again and verified as WebP with the expected dimensions.
- Original total: **46,241,154 bytes**. Display total: **3,694,244 bytes** (**92.0% smaller**).
- `public/images/manifest.json` records source paths, public URLs, native dimensions, descriptive alt text, and byte sizes.
- Use Next Image with explicit dimensions/aspect ratios and responsive `sizes`. Do not enlarge small product crops into full-screen hero images. Wide sources are 1672px across; mobile should select responsive image sizes.
- Headlines, product names, prices, benefits, and actions must remain actual HTML. Raster labels do not define the product catalog.

## Complete inventory

| Source | Dimensions | Display file in `public/images/` | Visual content and intended placement | Label notes |
| --- | --- | --- | --- | --- |
| img1.png | 1672 × 941 | hero-ritual.webp | Landscape portrait, ivory bottles on the left, olive branches; primary homepage hero or brand editorial. Keep the face visible when cropping. | Small bottle labels are decorative, not product data. |
| img2.png | 1672 × 941 | collection-travertine.webp | Four products on staggered travertine blocks; collection introduction or shop banner. | Generic cleanser, serum, cream, and essence labels differ from catalog names. |
| img3.png | 1254 × 1254 | cleanser-bottle.webp | Ivory pump bottle with white blossoms; Stillwater Cleanser product visual. | Label reads **Gentle Cleanser**. HTML must say **Stillwater Cleanser**; source is a packaging concept. |
| img4.png | 1254 × 1254 | first-light-serum.webp | Amber dropper bottle on stone; First Light Serum main image. | **First Light Serum** is correctly spelled. |
| img5.png | 1254 × 1254 | soft-landing-cream.webp | Frosted cream jar and champagne lid; Soft Landing Cream main image. | **Soft Landing Cream** is correctly spelled. |
| img6.png | 1448 × 1086 | serum-texture.webp | Clear golden serum, suspended bubbles, glass dropper; serum/oil gallery detail or ingredient editorial. | No labels. This image does not substantiate any ingredient or efficacy claim. |
| img7.png | 1448 × 1086 | cream-texture.webp | White cream swirls; cream gallery detail or hydration editorial. | No labels. |
| img8.png | 1448 × 1086 | cleanser-texture.webp | Fine white foam on sand; cleanser gallery detail. | No labels. |
| img9.png | 1122 × 1402 | cream-ritual.webp | Portrait applying cream in a warm bathroom; routine quiz or daily-ritual editorial. | No testimonial, identity, or review is implied. |
| img10.png | 1122 × 1402 | ritual-gift-box.webp | Open branded gift box with several products; gifting/editorial detail. | Assorted generic labels. Do not imply a separately purchasable gift set unless one exists in the catalog. |
| img11.png | 1122 × 1402 | essence-bottle.webp | Tall frosted bottle, gold cap, botanical shadows; Dewpoint Essence product visual. | Label says **Hydrating Essence**, 100 mL; HTML must say **Dewpoint Essence**. Do not repeat efficacy language from the raster. |
| img12.png | 1122 × 1402 | evening-tide-oil.webp | Golden dropper bottle surrounded by blossoms; Evening Tide Oil main image. | **Evening Tide Oil**, 30 mL. Do not repeat the label's treatment wording as a medical claim. |
| img13.png | 1122 × 1402 | clear-day-milk.webp | Ivory tube, gold cap, stone base; Clear Day Milk packaging concept. | Name is correct; source includes **SPF 30 PA+++**, 60 mL, and brightening wording. These are unsupported generated-label claims. **Do not market this fictional product as sunscreen or repeat the SPF claim. Prefer a corrected product illustration or label-free texture when the label would be readable.** |
| img14.png | 1122 × 1402 | ritual-flatlay.webp | Skincare bottles, tissue, linen and thank-you card; about/packaging editorial. | Generic cleanser, serum, essence, cream labels do not match every catalog name. |
| img15.png | 1122 × 1402 | serum-ritual.webp | Portrait using a dropper near a sunlit mirror; routine or serum usage editorial. | Do not represent the pictured person as a reviewer or named customer. |
| img16.png | 1672 × 941 | golden-hour-portrait.webp | Cinematic portrait beside products with deep golden shadows; alternate hero or philosophy banner. | Brand lettering is already in the image. Avoid placing duplicate VELA text directly on it. Generic labels are decorative. |
| img17.png | 1254 × 1254 | gel-texture.webp | Translucent gel ribbons and bubbles; essence/serum detail. | No labels. |
| img18.png | 1254 × 1254 | foam-texture.webp | Airy white foam with bubbles; cleanser/ritual detail. | No labels. |
| img19.png | 1122 × 1402 | botanical-still-life.webp | Serum and cream with citrus, lavender, blossoms and stone arch; botanical philosophy editorial. | Generic product labels. Visible botanicals are art direction, not evidence that a specific formula contains them. |
| img20.png | 1672 × 941 | collection-sunlight.webp | Four products on travertine plinths with warm leaf shadows; shop or collection banner. | Generic purifying cleanser, radiant serum, restorative cream, treatment essence labels differ from catalog names. |

## Product gallery mapping

| Catalog product | Main source | Suggested additional image |
| --- | --- | --- |
| Stillwater Cleanser | cleanser-bottle.webp | cleanser-texture.webp or foam-texture.webp |
| First Light Serum | first-light-serum.webp | serum-texture.webp or serum-ritual.webp |
| Soft Landing Cream | soft-landing-cream.webp | cream-texture.webp or cream-ritual.webp |
| Evening Tide Oil | evening-tide-oil.webp | serum-texture.webp |
| Clear Day Milk | Corrected illustration preferred; clear-day-milk.webp is an uncorrected concept | cream-texture.webp |
| Dewpoint Essence | essence-bottle.webp | gel-texture.webp |

## 3D continuity

First Light Serum has the clearest correctly named square image and is the best candidate for the dedicated scroll story: an amber glass cylindrical dropper bottle, champagne collar, ivory rubber bulb, and cream label. A procedural 3D bottle should preserve those visual properties. Other supplied bottles use a different package shape and should not be silently substituted for this product.

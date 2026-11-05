# First Light Serum scroll story

`ProductStory({ product, modelUrl? })` is an optional homepage section for the published First Light Serum product. Product name, size, price, availability, description, benefits, usage and product-page link are real HTML. The canvas is decorative, hidden from assistive technology and noninteractive.

## Reference and model

The supplied `public/images/first-light-serum.webp` was visually inspected before modeling. Its amber cylindrical body, rounded shoulders, thick base, tall champagne collar, ivory rubber bulb and cream VELA / First Light Serum label define the procedural model. The model is authored from lathed profiles, cylinders, rings and a generated label texture. Its total height is approximately 3.7 scene units; the body is about 2.4, the collar 0.55 and the bulb 0.76. It is an interpretation of the supplied packaging, not a scanned or externally sourced asset.

The default needs no GLB, external HDR, decoder, stock model or remote font. Local geometry forms create a restrained studio environment using Drei Lightformers at resolution 128, captured once. A deterministic small texture gives the pedestal a stone-like surface. The floating droplets are abstract texture imagery, not a depiction of ingredients or an efficacy claim.

## Progressive enhancement

- SSR and JavaScript-free output is a normal-flow image and complete editorial text. No essential copy starts hidden in server markup.
- Enhancement requires a viewport at least 1,024px wide and 700px tall, `prefers-reduced-motion: no-preference` and a successfully created WebGL2 context. Short desktop windows use the normal-flow layout so the copy and CTA cannot be clipped. The capability probe is released immediately.
- Once capability is known, the section reserves 300svh before the heavy scene imports. The sticky viewport starts below the 88px desktop header and has `calc(100svh - 88px)` height. Canvas readiness only changes opacity, not section geometry.
- The scene is loaded with `React.lazy` only when the section is within 600px of the viewport and its tab is visible. An already-ready scene stays mounted but paused when the tab is hidden. GSAP/ScrollTrigger is also imported near the viewport. Mobile, reduced-motion and unsupported-WebGL sessions never request the scene branch.
- Media-query changes unmount the canvas and restore the compact static layout. Canvas creation errors, chunk errors and context loss also restore the static layout. The supplied image stays in the DOM throughout loading.

## Scroll and render lifecycle

ScrollTrigger `vela-product-story` uses the section as its trigger, starts at `top 88px`, and ends at `bottom bottom`. CSS supplies stickiness; GSAP does not pin or transform an ancestor. A paused timeline transitions the three HTML chapters. Scroll progress travels through a small imperative channel, so it does not cause a React render on every scroll update.

`getStoryPose(progress)` is pure. Non-finite values become zero; finite values clamp to 0–1. Smoothstep keyframes at 0, .22, .55, .82 and 1 govern entrance, a full rotation, a restrained camera move and exit. Chapters change at .3 and .66; exit ramps from .86 to 1. Each result owns fresh tuples. The scene never uses elapsed time or random motion.

The canvas uses demand rendering and a DPR range of 1–1.5. Object and camera mutations explicitly invalidate a frame. It has no self-invalidating frame loop, orbit controls, infinite environment capture, postprocessing or idle animation. After one preparation frame, offscreen or hidden-tab scenes use `frameloop="never"`. Returning to the viewport applies the latest scroll pose and resumes demand rendering. Resize invalidation is bounded by a 150ms resize debounce.

Cleanup removes intersection/media/visibility/context listeners, unsubscribes from the progress channel, kills the owned ScrollTrigger and reverts the owned GSAP context. Procedural textures and optional model clones are explicitly disposed. R3F owns and tears down the Canvas renderer, environment, declarative geometry and material resources; it releases the WebGL context on unmount. No global `killAll` or shared renderer teardown is used.

## Optional local Blender asset

No authored `.glb` or `.gltf` file is included. To replace the procedural bottle, supply an actual project asset through `modelUrl`, for example `/models/first-light-serum.glb` **after creating that file**. The separate `LocalBottle` component loads it with `useGLTF` only when requested. An absent, invalid or failed optional model falls back to the procedural bottle.

Export guidance:

1. Match the reference bottle, label and proportions. Apply transforms in Blender; verify the exported model is upright on +Y with its label facing +Z in Three.js. The camera views the label from positive Z.
2. Use a centered, static model without lights, camera animation, a floor or a background. The loader centers its bounds and normalizes its height to 3.7 units; check the result with the existing scroll poses.
3. Prefer a single uncompressed GLB with embedded textures, a modest mesh count and roughly 50,000 triangles or fewer. Use 1K–2K textures and conventional glTF PBR materials. The default procedural scene remains the performance baseline.
4. Do not require Draco, Meshopt, KTX2 or remote resources. Decoder loading is disabled. A `.gltf` may reference local resources under `/models/`; the loader rejects cross-origin or out-of-directory resources. Embedded image/buffer data and loader-created blob URLs are allowed.
5. Paths must be canonical `/models/` paths ending in `.glb` or `.gltf`. Query strings, fragments, traversal, encoding, backslashes, whitespace and remote URLs are rejected. Model clones own their geometries, materials and textures, which are disposed when unmounted.

## Verification hooks and limits

The section exposes `data-testid="product-story"`, `data-story-state` (`static`, `deferred`, `loading`, `ready`, `failed`), `data-story-enhanced`, `data-story-active`, `data-story-progress` and `data-story-chapter`. `[data-story-viewport]` identifies the fixed-size visual viewport. `data-rendered-frame` is updated from the real renderer's frame counter in a visible pedestal mesh's `onAfterRender`; it is not a simulated timer.

`tests/cinematic.test.ts` checks pose bounds, continuity, determinism, fresh results, safe model paths and channel notification behavior. Browser acceptance belongs to the coordinated cinematic suite; actual GPU appearance, frame stability, context release and media-query transitions must be exercised there. No physical-device FPS claim is made by these helpers or the implementation.

Implementation references: [R3F demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [Drei local environment composition](https://drei.docs.pmnd.rs/staging/environment), and [Drei useGLTF decoder options](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf). Installed Next.js lazy-loading and Server/Client Component guides were also reviewed.

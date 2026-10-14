# Reference Analysis — messenger.abeto.co

Investigation date: 2026-10-14. Purpose: learn *transferable design and engineering principles* for
**Anandapur: Pujo Nights**. No proprietary code, assets, characters or branding were copied into the
project. The downloaded public JS bundle was used only for keyword counts and was deleted afterwards.

## Method

| Step | Tool | Evidence |
| --- | --- | --- |
| GPU-enabled headless Chromium 156 (ANGLE → OpenGL ES 3.2 on NVIDIA RTX PRO 6000) with loopback CDP on `127.0.0.1:9222` | Playwright launcher (`tools/ref/browser.mjs`) | `tools/ref/out/browser.log` |
| Passive page inspection (DOM, a11y tree, scripts, workers, console, storage) | REA `inspect-web-page` (CLI, rea-agents 6.4.0) | `ev_0df97460…c20` → `tools/ref/out/inspect.json` |
| Static bundle analysis (chunk graph, endpoints, source maps) | REA `analyze-web-bundle --fetch-source-maps` | `ev_475461b1…f58` → `tools/ref/out/bundle.json` |
| Network capture of the full session | Playwright HAR + REA `inspect-web-network-capture` | `ev_4e1b14a6…f65` → `tools/ref/out/messenger.har` |
| Interaction tests (click, Enter, Space, WASD, Shift, drag, wheel, E, Esc, viewport resize) | Playwright over the same CDP endpoint (`tools/ref/play*.mjs`) | `docs/reference-shots/*.png` |

Limitations: REA's CDP provider is attach-only/passive; the page was driven by Playwright. REA reported
`attach_limited` for network/console because it attached after load (the HAR fills that gap). No source
maps are published (`source_maps.status = unavailable`), so internal logic was **inferred** from
behaviour, not read. Audio could not be listened to (headless); only audio *assets* were observed.
Multiplayer traffic over WebSocket was not inspected beyond its existence.

## Findings by system

### 1. Scene setup and rendering technology
- **Observed:** Two first-party scripts: a 3.8 KB `webgl-*.js` bootstrap that statically imports a 1.93 MB
  `App3D-*.js` module (REA chunk graph). Workers: `bitmapworker`, `dracoworker`, `geometryworker` (+ more).
  Bundle string `REVISION="180"` ⇒ **Three.js r180**. Keywords present: `EffectComposer` (35), `AgX` (25),
  `KTX2` (118), `DRACOLoader`, `BatchedMesh` (41), `InstancedMesh`, `LOD` (126), `BVH` (25) incl.
  `acceleratedRaycast` (three-mesh-bvh style), `WebGPU` (7 — probably renderer capability checks).
  REA endpoint scan shows probing of `WEBGL_multi_draw`, `KHR_parallel_shader_compile`,
  compressed-texture extensions, `WEBGL_lose_context`.
- **Inference:** plain Three.js (not R3F) with a post-processing composer; batched/instanced static
  world; BVH for raycasts/collision; parallel shader compile to avoid hitches.
- **Adapt:** Use Three.js directly (r170), EffectComposer with a custom outline + grade pass, merged/
  instanced static geometry, simple 2D collision instead of a BVH (our city is mostly flat).

### 2. World scale and geometry
- **Observed (shots 02–07, 41–50):** the world is a **tiny planet** — the title screen shows a spherical
  diorama with town, hills, river and trees; in-game the horizon visibly curves (`planet` ×110,
  `curvature` ×7 in bundle). Streets are narrow and slope; buildings 2–4 storeys; character ≈ 1/3 of a
  storey tall relative to doors.
- **Adapt:** Keep a flat walkable city (simpler collision, sacred spaces stay level) but **fake the
  curvature** in the vertex shader for distant geometry so far streets bend away — gives the miniature
  "little world" feel. Dense, short sightlines, landmarks peeking over roofs.

### 3. Character proportions and animation
- **Observed:** youthful character, ~6 heads tall, big hair mass, simple flat-shaded clothes with one
  accent colour, crossbody bag. Smooth walk/run cycles, idle sway. Other players use the same rig with
  different outfits (customisation via the shirt button).
- **Adapt:** Our own original character: chunkier ~3.5-head proportions (friendlier, more toy-like),
  kurta/punjabi or sari-inspired outfits, procedural limb animation (no skinned GLB needed).

### 4. Input and movement
- **Observed:** BEGIN is a canvas-rendered button. Dialogue gates movement until advanced with the
  on-screen arrow (one line per click; Space/Enter did not advance in our test). WASD moves relative
  to the camera; Shift produces a visibly faster run (shot 44). Character turns smoothly toward motion.
  `gamepad` ×23 in bundle ⇒ gamepad support likely.
- **Adapt:** WASD/arrows, Shift jog, Space/E advance dialogue (we *will* support keyboard advance —
  an accessibility improvement), acceleration/deceleration smoothing, yaw slerp.

### 5. Third-person camera
- **Observed:** low, close, over-the-shoulder framing with a **wide FOV (est. 65–75°)** that makes
  buildings tower and lean (strong perspective). Mouse drag orbits (shot 45 vs 43b). Wheel had little
  visible effect. Camera rides slightly below head height, looking slightly up — emphasises
  architecture overhead.
- **Adapt:** FOV ~60°, distance 6–9 m, default pitch slightly low; allow upward look to admire pandal
  tops; critically-damped follow; wheel zoom with clamps.

### 6. Camera obstacle avoidance
- **Observed:** next to a wall (shots 45/49) the camera pulled in close rather than clipping through.
- **Adapt:** raycast from player head to desired camera position against building boxes; shorten to
  hit distance minus margin; ease outward slowly, inward fast.

### 7. Materials, outlines, lighting
- **Observed:** strongly **cel-shaded**: 2–3 flat tones per surface, crisp shadow shapes, **dark ink
  outlines with hand-drawn breakup** (broken, slightly wobbly lines on silhouettes *and* creases),
  painted cloud sky with flat light/dark teal shapes, very limited palette (teal sky, sage greys,
  greens, warm accent yellows/oranges). Tone mapping includes AgX.
- **Adapt:** MeshToonMaterial-style ramp (custom 3-step gradient), screen-space depth+normal edge
  outline pass with noise-jittered thickness for a hand-inked look, paper grain overlay. Our palette is
  night-time festival: indigo/violet sky, warm marigold/vermilion lights, cyan accents — very different
  mood from the daytime reference.

### 8. Environment composition and density
- **Observed:** every view has 10+ props: vending machines, poles, overhead wires, cones, signs,
  shutters, A/C units, trucks, benches, trees. Streets wind and climb; no straight grids.
  Readable landmarks (mirror pole, stairs, shrine).
- **Adapt:** Bengali street kit: lamp posts with marigold strings, overhead wires with light chains,
  green-shuttered houses with wrought-iron balconies, tea stalls, rickshaws, taxis, banners. Winding
  lanes between districts; pandal silhouettes act as landmarks.

### 9. NPC behaviour and dialogue
- **Observed:** standing NPC (old man reading paper, masked person) with idle loops; dialogue box =
  coloured **speaker-name tab** + white rounded panel + arrow button, all-caps handwritten font.
  Other characters seen running were real online players.
- **Adapt:** Single-player only. Archetype NPCs with idle/walk/watch loops; name-tab dialogue panel in
  our own style (cream paper, vermilion tab), optional translation line for Bengali phrases.

### 10. Quest and progress mechanics
- **Observed:** opening monologue: "I've got five on the list. Hopefully they're easy to find." — a
  short, finite, list-based objective (deliveries) presented through a list icon (top-right).
- **Adapt:** Eight-stamp Pujo Passport; finite, non-linear, discoverable in any order.

### 11. UI overlays and transitions
- **Observed:** HUD is four square paper-card icon buttons on the right (list, music, outfit, emote),
  with drop shadows; nothing else on screen. Title is a canvas-rendered 3D blocky logo; dialogue
  overlays bottom-centre. DOM has only 89 nodes / 26 a11y nodes; the a11y tree exposes a single
  unnamed canvas (`role=Canvas`) — **poor accessibility**.
- **Adapt:** Minimal HUD (title top-left, passport counter top-right, contextual hint bottom-centre),
  but built in **HTML/DOM** so it is keyboard- and screen-reader-accessible.

### 12. Performance, loading, optimisation
- **Observed (HAR, 322 requests):** 204 Draco `.drc` meshes (12.4 MB), 21 KTX2 textures (0.7 MB),
  53 OGG audio files (3.7 MB), 3 WASM decoders, 3 fonts. Assets streamed progressively; geometry
  decoded off-thread in workers. Steady **~60 fps** rAF rate on our GPU at 1600×900.
- **Adapt:** We generate geometry procedurally at load (zero mesh downloads) and synthesise audio with
  WebAudio — tiny payload. Merge static geometry by material, instancing for repeated props, DPR cap,
  quality presets.

### 13. Responsive behaviour
- **Observed:** at 420×860 the canvas fills the viewport and the HUD stays right-aligned (shot 12).
- **Adapt:** Desktop-first; still keep canvas + overlays fluid and readable at narrow widths.

### 14. Sound and atmosphere
- **Observed:** music toggle button; 53 OGG clips suggests per-event SFX + ambience + music stems;
  `AudioContext` used directly. Not audible in headless test.
- **Adapt:** Procedural WebAudio: dhak rhythms, crowd murmur, river, bells, UI clicks, finale music,
  with PannerNodes for spatial dhak near Dhaker Taal. Starts on the Start button gesture.

## Principles carried into Anandapur

1. **A small world that feels big** — curvature fakery, dense props, winding streets, landmarks.
2. **Strong, consistent style beats fidelity** — toon ramp + ink outlines + limited palette.
3. **Camera low and wide** so architecture looms; collision pulls camera in.
4. **Tiny HUD, diegetic goals.**
5. **Finite, list-based goal** with free order.
6. **Ship light** — procedural geometry/audio, worker-free.

Things we deliberately do *differently*: single-player, accessible DOM UI, keyboard dialogue advance,
night festival palette, Bengali cultural content, no network dependency.

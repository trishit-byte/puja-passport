# Technical Architecture

**Stack:** TypeScript · Vite 8 · three.js r170 · DOM/CSS overlays · Vitest · Playwright.
There's no React, Rapier, Zustand or Howler, because none earned its keep: physics is 2D circle-versus-box, state is a small model with event listeners, and audio is synthesised. There is no backend.

## Module map

| Area | Files | Responsibility |
|---|---|---|
| Boot | `src/main.ts` | font preload (Bengali and Devanagari glyphs must be ready before canvas text is painted), loading bar, `?debug` hook |
| Core | `core/Game.ts`, `core/Input.ts` | owns all systems, game phases (title → intro → play → finale), input routing (keyboard, mouse, touch joystick, swipe and pinch), autosave |
| Rendering | `rendering/Renderer.ts`, `PostFX.ts`, `materials.ts`, `Sky.ts`, `Lighting.ts` | quality presets, adaptive resolution, post chain, toon materials with planet mapping, sky, light pool |
| Planet | `utils/planet.ts` | flat → sphere mapping, shared by GLSL and CPU |
| World | `world/World.ts`, `roads.ts`, `collision.ts`, `Batcher.ts` | city generation, road field, colliders, static batching, horizon culling |
| Props | `world/props/*.ts` | Bengali buildings (fronts and detailed side façades, staffed shopfronts), street furniture, food stalls (`stalls.ts`), the Ambassador taxi (`ambassador.ts`), the signboard atlas and trilingual food boards |
| Festivities | `world/Festivities.ts` | searchlights, light boards, traffic (taxis, autos, cycle-rickshaws, bikes, tram) on lane loops with rolling wheels, braking, honks |
| Pandals | `world/pandals/*.ts` | eight builders, plus gates with trilingual name boards, cloth-dressed enclosures, bells and landmark towers; `protima.ts` builds the ekchala tableau in eight styles |
| Characters | `player/Character.ts`, `player/Player.ts`, `player/Actions.ts` | procedural rig, garments and animation; NPCs bake to one skinned mesh each. The controller handles acceleration, yaw smoothing, collision and ground following. Actions cover eat, dance, sit, pranam, dhunuchi and selfie, with props in the hand |
| Camera | `camera/ThirdPersonCamera.ts` | orbit, damping, zoom, wall occlusion (pull in and lift), planet-aware up vector |
| Interactions | `interactions/machines.ts`, `InteractionSystem.ts` | **pure** state machines per interaction kind; proximity and facing prompt selection |
| Gameplay | `gameplay/Progress.ts`, `SimClock.ts`, `PandalController.ts`, `atmosphere.ts` | **pure** progress model; the timed night (6 PM → 4 AM over 45 real minutes, pause reasons, stage and crowd curves); glue between machines, builds and UI; mood stages |
| NPCs | `npc/LivingCity.ts`, `npc/DjBoxes.ts` | crowds (density by hour, people on the road), shopkeepers, vendors and customers, secrets, photo spots, finale celebration; the 12 DJ spots with dancers |
| UI | `ui/UI.ts`, `Minimap.ts`, `TouchControls.ts`, `mapDraw.ts`, `stamps.ts`, `styles.css` | all screens as accessible DOM, the rotating minimap, touch controls, and responsive layouts from 375 px phones to desktop |
| Audio | `audio/AudioEngine.ts`, `audio/DjMusic.ts` | WebAudio: the dhak recording with per-pandal cuts, DJ channels (your songs or generated tracks), ducking, synthesised ambience and effects |
| Data | `data/pandals.ts`, `data/layout.ts` | data-driven pandals (names, palettes, interaction specs, stamps) and city plan |
| Save | `save/SaveStore.ts` | versioned schema, sanitising migration, storage failure tolerance |

Dependency direction: `data`, `save`, `interactions/machines`, `gameplay/Progress`, `gameplay/atmosphere` and `utils` import nothing from three.js or the DOM, so Vitest covers them directly.

## Tiny-planet rendering

Gameplay is flat. Every lit or unlit world material is patched in `onBeforeCompile` (`materials.ts` → `bend()`) so its world-space vertex position goes through the azimuthal-equidistant mapping:

```
d = |(x,z)|,  φ = d / R,  p' = C + (R + y) · (sinφ · x/d, cosφ, sinφ · z/d),   R = 165 m, C = (0,-R,0)
```

Distance from the centre is preserved and local shapes are only rotated, so characters and buildings look undistorted while streets curve away over a horizon about 30 m off. Consequences handled in code:

- **Camera:** computed in flat space, then mapped. `camera.up` follows the planet normal (`ThirdPersonCamera.apply`).
- **Point lights:** positions are mapped on the CPU (`Lighting.update`). The directional moon and the hemisphere light are left flat, and normals are unrotated, so N·L stays consistent.
- **Shadows:** shadow maps are rendered and looked up in flat space (`worldpos_vertex` is untouched), so they stay consistent.
- **Culling:** batch meshes get planet-space bounding spheres. A per-frame horizon test (`World.cullHorizon`) hides 35 m cells whose tallest point is below the horizon, typically 55–75% of cells. Characters and very large meshes have frustum culling disabled.
- **Long geometry is segmented** (ghat steps, pandal walls, ground grid at 3 m, road ribbons at 2 m) because the mapping bends geometry only at its vertices.
- **Sky** is tilted to the local up vector, and the **sea** is a real sphere just below the island.

## Rendering pipeline

`RenderPass` into a half-float target with a depth texture → **ink outline pass** → **UnrealBloom** → **grade** (saturation, split tone, vignette, grain) → **OutputPass** (ACES tone mapping, sRGB) → **SMAA**.

The ink outline pass detects silhouettes (a Laplacian of linear depth) and creases (normals reconstructed from depth on a 3×3 neighbourhood). That gives the hand-inked look without a separate normal render. Static noise varies line weight; the lines deliberately don't flicker per frame, which keeps motion smooth.

Materials: `MeshToonMaterial` with a 3-step ramp, plus "paint" mottling and ground grime in world space. Floors use Lambert shading so lamps don't make hard rings. Glowing bulbs, windows and lanterns are HDR `MeshBasicMaterial`, which feeds the bloom.

Draw-call strategy: the static city goes through `Batcher`. Every coloured material folds into a shared vertex-coloured material, merged per (material, 35 m cell) into about 360 meshes for the whole city. All ~9,000 festival bulbs use two `InstancedMesh`es whose alternating brightness creates a chase effect. Each NPC is one skinned mesh (all parts rigidly weighted to their bones), so it costs one draw call. NPCs, dancers, pandal animations, light boards and vehicles are frustum- or distance-culled.

Dynamic lighting: one shadow-casting directional light plus a pool of 3, 6 or 8 point lights (depending on quality) reassigned each frame to the nearest of ~450 lamp and pandal light sources.

Quality presets (`Renderer.QUALITY`): pixel ratio cap 1/1.5/2, shadow map off/1024/2048, bloom off/on/on, light pool 3/6/8, crowd budget 50/110/210. Touch devices start on Medium. **Adaptive resolution** steps the render scale between 0.8 and 1.0 based on the 80th-percentile frame time, so it never goes blurry.

WebGL context loss: `webglcontextlost` saves progress and shows a notice; `webglcontextrestored` resumes the loop (three.js re-uploads GPU resources). This is covered by an E2E test.

## Interaction framework

`data/pandals.ts` declares each pandal's `InteractionSpec`, one of four kinds:

| Kind | Machine | Used by |
|---|---|---|
| `single` | `SingleMachine` | Bonedi Bari (bell), Neel Shagor (pearl) |
| `set` (optionally `ordered`) | `SetMachine` | Alo'r Utsav, Gram Bangla (with info cards), Shobuj Swapno, Nodi'r Alo (ordered take → place) |
| `rhythm` | `RhythmMachine` + `judgeRhythm` (judges intervals, generous tolerance, skip always completes) | Dhaker Taal |
| `match` | `MatchMachine` (select a card, then place it at a landmark; mismatches are gentle) | Smritir Shohor |

Each pandal builder returns physical station positions. `PandalController` registers them with `InteractionSystem`, routes E presses to the right machine, plays feedback, and calls `Progress.stamp()`, which is idempotent, only when the machine reports `complete`.

## Save schema (v3)

`{ version, stamps[], discovered[], secrets[], player{x,z,yaw}|null, outfit{style,color,accent,hair}, audio{master,music,ambient,muted}, settings{quality,reducedMotion,guidance,translations,subtitles}, finaleSeen, tutorialDone, session{elapsed,status,completedAt} }`, where `session.status` is one of none, active, success, failed or sightseeing, and `elapsed` counts active real seconds.

`sanitize()` accepts anything. It migrates v1 (`completed` → `stamps`), removes unknown ids and duplicates, clamps numbers, and refuses `finaleSeen` without eight stamps. Corrupt JSON or storage that throws falls back to a fresh save, and a toast tells the player.

## Audio graph

`master ← {music, ambient, sfx}`. The ambient bus holds the crowd bed and the river, plus HRTF `PannerNode`s for the dhak ensembles at Dhaker Taal and the Chowk. Beats and melody notes are scheduled 250 ms ahead of `currentTime`. The listener uses flat coordinates. The context is created inside the Start click handler.

# Testing and performance

Measured on 2026-10-14 on the development machine (RTX PRO 6000, headless Chromium with GPU).
Treat the absolute frame times as an upper bound; phones and integrated GPUs will be slower,
which is why touch devices start on the Medium preset.

## Automated tests

| Suite | Command | Count | What it covers |
|---|---|---|---|
| Unit (Vitest) | `npm test` | 36 | Progress, save migration and validation, SimClock (pause reasons, expiry, stages, crowd curve), interaction state machines, planet mapping, RNG |
| End-to-end (Playwright) | `npm run test:e2e` | 19 | Boot with no console errors; movement, jog, camera; collision; discovery vs. stamping; every pandal's interaction by keyboard; persistence and no duplicate stamps; rhythm skip; random-order completion → finale; menus, volume, reset; NPC dialogue and eating at a stall; WebGL context loss and recovery; frame-time stability; the festival clock (pause on menu and hidden tab, 4 AM end); success then sunrise; **phone portrait** 375×667, 390×844, 412×915 (joystick walks, swipe turns, action button rings the bell, no HUD overlap); **layout** 1280×720, 1024×768 touch, 844×390 touch |

## Screen-size matrix (`tools/matrix.mjs`)

Checks that the title page fits, the HUD elements (clock, buttons, minimap, compass, touch
controls) never overlap or go off-screen, and the passport opens.

| Size | Device class | Result |
|---|---|---|
| 1920×1080 | desktop | ✓ |
| 1366×768 | laptop | ✓ |
| 1280×720 | small laptop | ✓ (compass narrows between the clock and buttons) |
| 1024×768 | tablet landscape (touch) | ✓ (compass drops below the buttons; minimap top-right) |
| 1180×820 | iPad Air landscape (touch) | ✓ |
| 768×1024 | tablet portrait (touch) | ✓ |
| 844×390 | phone landscape (touch) | ✓ (title page scrolls; rules in two columns) |
| 375×667 | iPhone SE | ✓ |
| 412×915 | large Android | ✓ |

## Is 45 minutes fair? (`tools/walktime.mjs`)

A* over the real collision map (1 m grid, player radius 0.38 m) from the start to every pandal gate
and gate → bell → gate inside each, checking every visiting order (10 pandals, measured 2026-10-14
after Nakshatralok, Debaloy and the river pandal were added):

- Best order: Rajbarir Pujo → Debaloy → Matir Taan → Smritir Shohor → Nodir Opare (across the footbridge) → Neel Swapno → Aranyer Ahoban → Dhaker Taale → Alor Thikana → Nakshatralok
- Distance: **989 m between pandals + 165 m inside them = 1,154 m**
- Walking (3.6 m/s) plus about 25 s per pandal: **8.7 real minutes**; jogging: **6.3 minutes**

So the 45-minute night is about 5× the optimal route, which leaves plenty of room to explore, eat,
dance and enjoy each pandal's optional activity.

## Performance (`tools/perf.mjs`, High preset, 1600×900)

| Spot | FPS | CPU frame p50 / p95 | Draw calls |
|---|---|---|---|
| Chowk (start) | 60 | 6.9 ms p50 | ~420 |
| Mela plaza (busiest) | 57–60 | 5.9 ms p50 | ~630 |
| Bonedi Bari | 60 | 5.2 / 8.1 ms | ~385 |
| Riverside | 60 | 4.9 / 6.7 ms | ~400 |

What keeps it fast:
- Static geometry is merged into material and spatial buckets.
- Each NPC is a single skinned mesh, one draw call per person.
- NPCs and dancers are frustum-culled against their tiny-planet position.
- Pandal animations, light boards and vehicles are hidden beyond about 70–75 m, where the planet's curve hides them anyway.
- Render resolution adapts between 80% and 100%.

The crowd budget scales with the preset: Low 50 / Medium 110 / High 210, with walkers on their
own quota of 80% of the budget. Shopkeepers and vendors are always present.

### Phone emulation (`tools/phoneperf.mjs`, 390×844 @3×, touch)

A first visit on a touch device starts on **Medium** (pixel ratio 1.5, ~110 walkers plus
shopkeepers and vendors). The CPU is slowed with Chrome's throttling to approximate phones:

| CPU slowdown | Chowk | Busiest plaza | Riverside | Notes |
|---|---|---|---|---|
| 4× (mid-range phone) | 17.2 ms (58 fps) | 19.0 ms (53 fps) | 16.5 ms (60 fps) | |
| 6× (budget phone) | 27.6 ms (36 fps) | 30.9 ms (32 fps) | 23.4 ms (43 fps) | adaptive resolution steps down to 1.2× |

Real GPUs in phones are weaker than this machine's, so treat these as CPU-side estimates.

## Memory (`tools/mem.mjs`, `tools/peak.mjs`)

These are Chromium process sizes (RSS) on this machine at 1600×900, High preset, measured on
2026-10-14. Before the memory pass, a single tab used about 4.8 GB.

| | Before | After |
|---|---|---|
| Renderer process (the page) | 3,145 MB | 450 MB after loading; 360 MB once Chrome's memory reducer runs (about 70 s); 270 MB after a full GC |
| GPU process | 1,494 MB | 310 MB |
| Total for the tab | 4,869 MB | ≈ 800 MB, of which ≈ 330 MB is Chromium's baseline for any page with a WebGL canvas (`tools/blank.mjs`) |
| Load to playable | 18.5 s | 7.6 s |

The window size hardly matters: 2560×1440 at 2× measures the same as 1600×900, because the
render resolution is capped at 4K.

Where the memory went, and the fix for each:

1. **The crowd: 1.9 GB → 25 MB.**
   - *Problem:* each of the ~670 people had their own 48,000-vertex, non-indexed body at 60 bytes per vertex.
   - *Fix:* bodies stay indexed, and people with the same body shape share one copy. That copy holds positions, 8-bit normals, 8-bit skin indices and weights, and the index. The shape key is style, hair, age, glasses and moustache, giving about 30 shapes.
   - Each person adds only a 3-byte-per-vertex colour buffer, itself shared by people dressed identically.
   - Known shapes skip geometry work entirely, and part geometries (tori, boxes, lathes, drapes) are memoised.
2. **The static city: 880 MB → about 75 MB on the GPU and nothing in JS.**
   - *Problem:* merged batches were non-indexed, with float normals and colours and UVs no material used.
   - *Fix:* the batcher now records only a reference to a shared, welded template plus a matrix, and writes each merged mesh straight into its final arrays:
     - indexed geometry;
     - 16-bit positions relative to the batch box, with the mesh matrix restoring them;
     - 8-bit normals and colours, and float colours only for HDR glow.
   - Smooth icosahedrons are welded (960 → 162 vertices), and small spheres get fewer segments, so static vertices dropped from 7.6 M to 6.2 M.
3. **JS-side copies.**
   - *Problem:* three.js keeps a JS copy of every buffer after uploading it.
   - *Fix:* static batches, crowd shapes and one-off canvas textures (pandal and food boards) now drop that copy after upload (`releaseAfterUpload`, `releaseImageAfterUpload`). As a result, a lost WebGL context recovers by saving and reloading straight back into the game.
4. **Load-time garbage.**
   - *Problem:* cloning and merging everything during load left about 770 MB of collectable vertex garbage. Chrome is slow to free it because it lives outside the JS heap, and this was much of what the task manager showed.
   - *Fix:* the two changes above removed nearly all of it.
5. **DJ songs.** Each DJ box opens its song's `<audio>` stream only while you're within 16 m, and remembers its place in the song. Before, all 12 boxes buffered an MP3 stream each.
6. **Smaller items:**
   - the dhak recording is decoded to mono (33 → 17 MB), since it plays through a positional panner anyway;
   - the composer's and bloom's buffers no longer allocate unused depth buffers;
   - the canvas has no depth or stencil buffer;
   - render resolution is capped at 8.3 MP (4K).

## Phone audit (`tools/phoneaudit.mjs`)

This drives the production build with real touch taps on three emulated phones: 390×844 at 3×, 412×915 at 2.6×, and 844×390 landscape at 3×. On each it checks:
- the title fits, touch controls show, and Medium is the default;
- the HUD has no overlaps;
- the ground guide appears near an unvisited pandal;
- the action button offers and performs the kneeling pranam;
- tapping eats fuchka and dances at a DJ spot;
- the passport fits the screen;
- the night-over card fits, and "Try the Night Again" starts a fresh 6 PM night;
- there are no page errors.

On 2026-10-14 all 39 checks passed, loading took 7–8 s, and the tab used about 760 MB in total. Frame time on Medium with a 4× CPU slowdown was 17–18 ms (55–60 fps).

## Manual checks still worth doing on real hardware

- An iPhone (Safari) and a mid-range Android phone (Chrome): touch controls, audio unlock on the first tap, frame rate on Medium.
- An integrated-GPU laptop on High vs. Medium.
- A gamepad (support exists but is untested on hardware).

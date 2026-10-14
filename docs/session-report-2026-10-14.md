# Session report: 14 October 2026

**Window:** 06:33 UTC to 14:00 UTC (10 AM US Eastern), continuous work. **Commits:** 44. **Code:**
+4,300 / −630 lines across 40 source and test files. The detailed, timestamped log is in
[PROGRESS.md](PROGRESS.md).

## What changed for the player

**The game is now *Puja Passport*.** The title page says "You are in Anandapur" (in Bengali,
Devanagari and English) and gives four rules: hop every pandal; ring each bell for a stamp; eat,
dance and have fun; beat the dawn.

**A timed night.** The night runs from 6:00 PM to 4:00 AM over 45 real minutes, with a pause
whenever a menu is open or the tab is hidden. Success is final at the eighth stamp. "Finish the
Night" at Sunrise Ghat leads to the sunrise finale. Failure offers Retry, Sightseeing (no clock)
or the Main menu.

**Every pandal**
- has a bell for its stamp and a gold arrow over your head guiding you to the entrance;
- has a trilingual name board, with a selfie spot just outside its gate;
- has a **protima in its own style**: classic Kumartuli, gilded, terracotta, eco, patachitra, sea-blue, silver daker saaj, or pastel alada chala;
- is dressed in festival cloth, with striped walls and a marigold valance.

**The protima** is the full ekchala:
- Durga with ten arms, each holding a weapon;
- her right foot on a horse-faced lion, the trishul through Mahishasura's chest, and a serpent binding him;
- Lakshmi, Saraswati, Ganesh (four arms), Kartik, Kola Bou, and their vahanas;
- Kumartuli faces with long-tailed eyes and chandan dots;
- offerings: lamps, marigolds, fruit and the ghot.

**Things to do:** eat (fuchka, chowmein, kathi roll, cha, jhalmuri, mishti), dance at 12 DJ
stages, join the dhunuchi naach, sit on benches, offer pranam, join the **evening and midnight
aarti** (a purohit with a pancha-pradip, bells, and crowds gathering), and take selfies, which
are kept as **Memories** in the passport.

**A livelier city**
- *Crowd:* about 300 people in saris, salwar kameez, kurtas, shirts, and T-shirts with jeans. The crowd builds through the evening and thins after 2 AM, and spills onto the road.
- *Shops:* a shopkeeper behind every open shop.
- *Traffic:* Ambassador taxis, autos, cycle-rickshaws, motorbikes and a tram on rails. All have turning wheels, brake for people and honk.
- *Buildings:* detailed side walls instead of blank ones.
- *The ghat:* priests' umbrellas, shrines, boats and floating diyas.

**Navigation:** a GTA-style rotating minimap, ♪ DJ markers on the compass, minimap and city map,
and no numbers on DJ spots.

**Phones and tablets:**
- *Controls:* a joystick, swipe to look, pinch to zoom, RUN and action buttons.
- *Layout:* safe areas and a responsive HUD, checked at 9 screen sizes from 375 px phones to desktop.
- *Defaults:* phones start on Medium graphics.

**Your requests, as asked:**
- DJ music only within 15 m, with everything else silent inside a DJ zone.
- No "Now playing" titles.
- "Fuchka".
- Equal-size Bengali, Devanagari and English.
- The glare from lights was fixed earlier, and the lights weren't touched since.
- A sharper picture: pixel ratio up to 2×, never below 80%.

## Ready to publish

- `npm run build:public` ships **no commercial songs**. I verified it contains 0 MP3s and is 3 MB.
- Link-preview image and tags, an app icon and manifest, and caching headers.
- [DEPLOY.md](DEPLOY.md) covers Cloudflare Pages (recommended), Netlify and GitHub Pages.
- Third-party reference screenshots and 134 MB of old PNGs are untracked. They are still in older git history, so start a fresh history before making the repository public.

## How it was checked

- **20 Playwright browser tests**, run in full before every feature commit (all passing). Coverage: every pandal, persistence, the clock and both endings, menus, dialogue, eating, phone portrait ×3, layouts ×3, WebGL context loss, frame stability, and selfie memories.
- **36 unit tests.**
- **Screenshots of every visual change**, from several angles, before committing.
- **Fairness:** the optimal route through all eight pandals is 883 m, about 7.4 minutes walking, which leaves roughly 6× slack in the 45-minute night.
- **Performance:**
  - Desktop: 57–60 fps at High.
  - Draw calls: cut about 40% this afternoon by merging vehicle parts.
  - Emulated mid-range phone: 53–60 fps.
  - Emulated budget phone: 32–43 fps.

Details are in [testing-and-performance.md](testing-and-performance.md).

## Bugs found and fixed along the way

- Garments were rendering inside-out, which made legs show through saris and kurtas.
- A floating-point NaN in the cloth-fold maths filled the console with errors and failed tests.
- A tree blocked the view of Shobuj Swapno's protima, and a shell canopy cut off Neel Shagor's Durga.
- The passport and other menus opened scrolled to the bottom, with the title cut off.
- The "passport complete" toast repeated; after success the clock card said "Sightseeing"; and the HUD stayed visible over the sunrise.
- HUD elements overlapped on laptops, tablets and phones held sideways.

## Last hour

- Menus open at the top (the passport used to open scrolled to the bottom).
- Phone-friendly outfit and settings menus, with touch controls help.
- No emoji that render as empty boxes on devices without an emoji font.
- Crowd lines that hint at the DJ spots, aarti, gate selfies and the clock.
- Public build re-verified, and the link-preview image refreshed.

## Honest gaps

- Phones and tablets were tested in emulation only; real iOS Safari and Android devices still need a check.
- Gamepad support hasn't been tested on hardware.
- A flat brown oval appeared twice in distant screenshots and couldn't be reproduced up close (see [known-issues.md](known-issues.md)).
- The visuals are stylised low-poly toon art built from code. The protimas are recognisable and respectful, but not sculptural.

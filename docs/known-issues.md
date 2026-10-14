# Known issues and future work

## Known issues

- **Floating brown oval.** In two distant screenshots a flat brown oval appeared above the
  rooftops near Mela Bazaar. It couldn't be reproduced up close and is probably a canopy or tree
  crown seen edge-on through the planet curve. If you spot it, note the place and time.
- **Real-device testing.** Phones and tablets were tested in emulation (touch, sizes, safe
  areas), not on physical devices. Check iOS Safari's audio unlock and frame rate on Medium.
- **Gamepad.** Gamepad support exists but hasn't been tested on hardware.
- **Audio in headless tests.** Automated tests can't hear audio. Levels and fades are checked
  numerically (tools/djcheck.mjs, tools/duckcheck.mjs, tools/audioanalyse.mjs).
- **Git history.** `docs/reference-shots/` (third-party screenshots) is untracked now but still
  in older commits. Start a fresh history before making the repository itself public. Deployed
  builds never include it.

## Future ideas

- Real Bengali voice lines for a few NPCs (with consent and credit).
- Sindoor khela as a separate Dashami chapter (not part of Ashtami night).

## WebGL context loss reloads the page

To save memory, static geometry and crowd bodies live only on the GPU once uploaded. If the
browser loses the WebGL context (a GPU reset or driver update, or a phone reclaiming memory), the
game saves and reloads straight back into the night, rather than rebuilding in place.

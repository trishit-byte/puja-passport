# Deploying Puja Passport

The game is a static site: one `index.html`, JS/CSS bundles, fonts, a dhak recording and some
images. It needs no server code, database or API keys.

## 1. Build the public version

```bash
npm ci
npm run build:public      # → dist/  (about 3 MB)
```

`build:public` is the same as `build`, except that it **does not include any songs from
`public/assets/audio/musics/`**. Those are commercial recordings for personal use only. The DJ
boxes then play the game's own generated tracks. Check before uploading:

```bash
find dist -name "*.mp3" | wc -l        # must print 0
cat dist/assets/audio/songs/available.json   # {"songs":[]}
```

The build uses relative paths (`base: './'`), so it works at a domain root or in a sub-folder.

### Or: the full build, with the DJ songs (owner's choice)

The prepared songs (`public/assets/audio/songs/NN.mp3`, already trimmed and loudness-matched,
plus `available.json`) are committed, so a host that builds from git can ship them: use
`npm run build` instead of `build:public`. The raw `musics/` folder stays out of git; without it,
`scripts/prepare-music.mjs` leaves the committed songs as they are. These are commercial
recordings: publishing them can draw copyright takedowns (of the repo and/or the site).

## 2. Pick a host

### Cloudflare Pages (recommended: free, fast in India, HTTPS)

Through the dashboard: **Workers & Pages → Create → Pages → Connect to Git**, then pick the repo.

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build:public` (or `npm run build` to include the DJ songs) |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION = 24` |

Or upload a local build without Git:

```bash
npx wrangler pages deploy dist --project-name puja-passport
```

### Netlify

Build command `npm run build:public`, publish directory `dist`. You can also drag and drop the
`dist` folder onto app.netlify.com/drop.

### GitHub Pages

Push `dist/` to a `gh-pages` branch (`npx gh-pages -d dist`), or build it in an Action. Because
of `base: './'`, it works under `https://<user>.github.io/<repo>/`.

## 3. After the first deploy

- **Link previews:** `index.html` has Open Graph / Twitter tags pointing at `og-image.jpg`.
  Some crawlers (WhatsApp, LinkedIn) need an **absolute** URL. Once you know the domain, change
  `content="og-image.jpg"` to `content="https://your.domain/og-image.jpg"` in both image tags.
- **Caching:** the hashed files under `assets/` can be cached forever. On Cloudflare Pages, add a
  `public/_headers` file containing:
  ```
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  ```
- **Smoke test:** open the site on a phone and on a laptop. You should see the title page, be
  able to start the night, walk, and hear the dhak near a pandal after tapping Start.

## 4. What must never be published

- `public/assets/audio/musics/` and `public/assets/audio/songs/*.mp3` (commercial songs)
- `docs/reference-shots/` (third-party screenshots used for study; untracked since this commit, but still present in older git history, so if the repo itself goes public, start a fresh history or scrub it first)

Both are git-ignored or excluded by `build:public`. Only `dist/` is deployed, so they can't leak
as long as you use `build:public`.

// Converts every playable audio file in public/assets/audio/musics/ into a browser-safe, loudness-
// matched MP3 (public/assets/audio/songs/NN.mp3) and writes songs/available.json for the DJ boxes.
// Runs before `dev` and `build`. Uses ffmpeg (on PATH or .tools-ffmpeg/); without it, files that are
// already real MP3s are copied as-is. Broken/empty files are skipped with a warning.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = 'public/assets/audio/musics';
const OUT = 'public/assets/audio/songs';
mkdirSync(OUT, { recursive: true });
// On a host that builds from git (e.g. Cloudflare Pages) the raw musics/ folder isn't there: keep
// the already-prepared songs/ (trimmed, loudness-matched, committed) exactly as they are.
if (!existsSync(SRC) && existsSync(join(OUT, 'available.json'))) {
  console.log('prepare-music: no musics/ folder; using the prepared songs in', OUT);
  process.exit(0);
}
const ff = existsSync('.tools-ffmpeg/bin/ffmpeg') ? '.tools-ffmpeg/bin/ffmpeg' : 'ffmpeg';
let hasFF = true;
try {
  execFileSync(ff, ['-version'], { stdio: 'ignore' });
} catch {
  hasFF = false;
}

/** Readable title/artist from a YouTube-style file name. */
const KNOWN = [
  ['Aar Koto Raat', 'Aar Koto Raat Eka Thakbo', 'Asha Bhosle'],
  ['Chirodini', 'Chirodini Tumi Je Aamar', 'Kishore Kumar'],
  ['Dhaker Taley', 'Dhaker Taley', 'Jeet Gannguli'],
  ['Dugga Elo', 'Dugga Elo', 'Monali Thakur'],
  ['Dugga Maa Asche', 'Dugga Maa Asche', 'Kiran Mazumder'],
  ['EKBAR NACHO', 'Ekbar Nacho Maa', 'Dohar'],
  ['Gold Printer', 'Gold Printer Sari Pore', 'Mita Chatterjee'],
];
function titleOf(name) {
  const k = KNOWN.find(([key]) => name.toLowerCase().startsWith(key.toLowerCase()));
  if (k) return { title: k[1], artist: k[2] };
  const stem = basename(name, extname(name));
  return { title: stem.split(/ - | _ /)[0].trim(), artist: '' };
}

/**
 * Optional trims: public/assets/audio/musics/trims.json maps the start of a file name to the part
 * to keep, e.g. { "Dugga Maa Asche": { "start": "0:12", "end": "2:45" } }. Times are m:ss (or
 * seconds). The original files are never changed; a short fade in/out smooths the cut.
 */
const TRIMS_FILE = join(SRC, 'trims.json');
const trims = existsSync(TRIMS_FILE) ? JSON.parse(readFileSync(TRIMS_FILE, 'utf8')) : {};
const secs = (t) => (typeof t === 'number' ? t : String(t).split(':').reduce((a, v) => a * 60 + Number(v), 0));
function trimOf(name) {
  const k = Object.keys(trims).find((key) => name.toLowerCase().startsWith(key.toLowerCase()));
  if (!k) return null;
  const start = trims[k].start !== undefined ? secs(trims[k].start) : 0;
  const end = trims[k].end !== undefined ? secs(trims[k].end) : null;
  return { start, end };
}

const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => !f.startsWith('.') && f !== 'trims.json').sort() : [];
const songs = [];
for (const f of files) {
  const p = join(SRC, f);
  const size = statSync(p).size;
  if (size < 50_000) {
    console.warn(`music: skipping "${f}" (${size} bytes: ${readFileSync(p).subarray(0, 40).toString('utf8').replace(/[^\x20-\x7e]/g, '')}) — please re-download it`);
    continue;
  }
  const outName = String(songs.length + 1).padStart(2, '0') + '.mp3';
  const out = join(OUT, outName);
  const trim = trimOf(f);
  const prev = existsSync(join(OUT, 'available.json')) ? JSON.parse(readFileSync(join(OUT, 'available.json'), 'utf8')).songs?.find((s) => s.file === outName) : null;
  const fresh = existsSync(out) && statSync(out).mtimeMs > statSync(p).mtimeMs && prev?.source === f && JSON.stringify(prev?.trim ?? null) === JSON.stringify(trim);
  if (!fresh) {
    if (trim && !hasFF) console.warn(`music: "${f}" has a trim but ffmpeg is unavailable — using the full song`);
    if (hasFF) {
      const cut = [];
      let fades = '';
      if (trim) {
        cut.push('-ss', String(trim.start));
        if (trim.end !== null) cut.push('-to', String(trim.end));
        const len = (trim.end ?? Infinity) - trim.start;
        fades = (trim.start > 0 ? 'afade=t=in:d=1.5,' : '') + (Number.isFinite(len) ? `afade=t=out:st=${Math.max(0, len - 2.5)}:d=2.5,` : '');
      }
      execFileSync(ff, ['-y', '-loglevel', 'error', ...cut, '-i', p, '-vn', '-ac', '2', '-ar', '44100', '-b:a', '160k', '-af', fades + 'loudnorm=I=-14:TP=-1.5:LRA=11', out]);
    } else {
      const h = readFileSync(p).subarray(0, 3);
      if (h.toString() !== 'ID3' && !(h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) {
        console.warn(`music: "${f}" is not an MP3 and ffmpeg is unavailable — skipped`);
        continue;
      }
      copyFileSync(p, out);
    }
  }
  songs.push({ file: outName, ...titleOf(f), source: f, ...(trim ? { trim } : {}) });
}
for (const f of readdirSync(OUT)) if (/^\d\d\.mp3$/.test(f) && !songs.some((s) => s.file === f)) rmSync(join(OUT, f));
writeFileSync(join(OUT, 'available.json'), JSON.stringify({ songs }, null, 2) + '\n');
console.log(`music: ${songs.length} song(s) ready${songs.length ? ': ' + songs.map((s) => s.title).join(' · ') : ' — DJ boxes will use the built-in tracks'}`);

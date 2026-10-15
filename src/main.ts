import '@fontsource/baloo-da-2/400.css';
import '@fontsource/baloo-da-2/600.css';
import '@fontsource/baloo-da-2/800.css';
import '@fontsource/baloo-da-2/bengali-400.css';
import '@fontsource/baloo-da-2/bengali-600.css';
import '@fontsource/baloo-da-2/bengali-800.css';
import '@fontsource/baloo-2/devanagari-600.css';
import '@fontsource/baloo-2/devanagari-800.css';
import './ui/styles.css';
import './rendering/fastMatrices';
import { Game } from './core/Game';
import { LOADING_HTML, setLoading } from './ui/loading';

/** Yield to the browser so the loading bar can paint between heavy build steps. */
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed')) || 1931;
  const ui = document.getElementById('ui')!;
  ui.innerHTML = LOADING_HTML;
  setLoading(ui, 0.08);
  const sub = ui.querySelector('.loading-sub') as HTMLElement;
  // the Bengali webfont must be ready before signboards are painted into textures
  await Promise.all([document.fonts.load('800 40px "Baloo Da 2"', 'আনন্দপুর'), document.fonts.load('700 40px "Baloo Da 2"', 'Anandapur'), document.fonts.load('800 40px "Baloo 2"', 'आनंदपुर')]).catch(() => {});
  await frame();
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  let game: Game;
  try {
    game = new Game(canvas, seed, (p, t) => {
      setLoading(ui, p, t);
    });
  } catch (e) {
    sub.textContent = 'Sorry — this browser could not start WebGL. Please try a recent Chrome, Edge or Firefox.';
    console.error(e);
    return;
  }
  (window as any).__game = game;
  if (params.has('debug')) (window as any).__anandapur = game.debugApi();
  game.start();
  await frame();
  ui.querySelector('.loading')?.classList.add('fade');
  setTimeout(() => ui.querySelector('.loading')?.remove(), 800);
  game.showTitle();
  let auto = params.has('autostart');
  try {
    if (sessionStorage.getItem('anandapur.autostart')) {
      sessionStorage.removeItem('anandapur.autostart');
      auto = true;
    }
  } catch {
    /* storage unavailable */
  }
  if (auto) (document.querySelector('.title-screen .title-buttons .btn') as HTMLElement)?.click();
}

boot();

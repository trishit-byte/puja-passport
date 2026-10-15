// The numbers, for the owner: /api/stats?key=<STATS_KEY>. Totals, phone vs desktop, and the last 30 days.
const LABEL = { visit: 'Page opens', player: 'Unique players (devices)', start: 'Nights started', stamp: 'Stamps collected', complete: 'Passports completed', sunrise: 'Sunrise finales watched' };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.STATS_KEY || url.searchParams.get('key') !== env.STATS_KEY) return new Response('Not found', { status: 404 });
  if (!env.STATS) return new Response('Storage (STATS) is not attached yet.', { status: 200 });
  const all = {};
  let cursor;
  do {
    const page = await env.STATS.list({ cursor });
    await Promise.all(page.keys.map(async (k) => (all[k.name] = Number(await env.STATS.get(k.name)) || 0)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  if (url.searchParams.get('format') === 'json') return Response.json(all);
  const rows = Object.keys(LABEL).map((e) => `<tr><td>${LABEL[e]}</td><td><b>${all[`t:${e}`] ?? 0}</b></td><td>${all[`t:${e}:phone`] ?? 0}</td><td>${all[`t:${e}:desktop`] ?? 0}</td></tr>`).join('');
  const days = [...new Set(Object.keys(all).filter((k) => k.startsWith('d:')).map((k) => k.slice(2, 12)))].sort().reverse().slice(0, 30);
  const dayRows = days.map((d) => `<tr><td>${d}</td>${['player', 'start', 'stamp', 'complete'].map((e) => `<td>${all[`d:${d}:${e}`] ?? 0}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puja Passport — plays</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:720px;padding:0 16px;color:#2a1a10;background:#fbf4e4}table{border-collapse:collapse;width:100%;margin:8px 0 28px}td,th{padding:6px 10px;border-bottom:1px solid #e3d3b0;text-align:right}td:first-child,th:first-child{text-align:left}h1{color:#9e1b1b}</style>
<h1>Puja Passport — plays</h1><table><tr><th></th><th>Total</th><th>Phone</th><th>Desktop</th></tr>${rows}</table>
<h2>Last 30 days</h2><table><tr><th>Day (UTC)</th><th>New players</th><th>Nights started</th><th>Stamps</th><th>Passports</th></tr>${dayRows || '<tr><td colspan=5>No plays yet</td></tr>'}</table>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

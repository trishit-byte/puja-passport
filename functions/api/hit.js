// Play counter (Cloudflare Pages Function). The game posts one small event — no cookies, no IP
// or personal data is stored: only running totals, overall and per day, in the STATS KV namespace.
const EVENTS = new Set(['visit', 'player', 'start', 'stamp', 'complete', 'sunrise']);

export async function onRequestPost({ request, env }) {
  if (!env.STATS) return new Response(null, { status: 204 }); // storage not attached yet
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const e = String(body?.e ?? '');
  if (!EVENTS.has(e)) return new Response(null, { status: 400 });
  const dev = body?.m ? 'phone' : 'desktop';
  const day = new Date().toISOString().slice(0, 10);
  const keys = [`t:${e}`, `t:${e}:${dev}`, `d:${day}:${e}`];
  await Promise.all(keys.map(async (k) => env.STATS.put(k, String((Number(await env.STATS.get(k)) || 0) + 1))));
  return new Response(null, { status: 204 });
}

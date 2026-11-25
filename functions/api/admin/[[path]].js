// Admin API behind the /admin/ page.
//
// Checks the admin password, keeps the owner signed in with an HttpOnly cookie, and reads the activity log
// from Supabase with the secret key, which never reaches the browser. Only the admin_* functions in
// supabase/schema.sql are called.
//
// Settings: Cloudflare Pages → the project → Settings → Variables and Secrets (type "Secret"):
//   ADMIN_PASSWORD        the password for /admin/ (use a long, random one)
//   SUPABASE_SERVICE_KEY  Supabase → Project Settings → API Keys → a secret key (sb_secret_…) or the service_role key
//   SUPABASE_URL          optional, defaults to the project the site already uses
// Changing either secret signs the admin out everywhere. For `wrangler pages dev`, put them in .dev.vars.

const DEFAULT_URL = 'https://btboxrpehexlyptiwdyw.supabase.co';
const COOKIE = 'sg_admin';
const MAX_AGE = 7 * 86400;   // stay signed in for a week
const enc = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const json = (body, status = 200, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extra }
});

async function sign(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Compares two strings of equal length without stopping at the first difference
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const secretOf = env => `${env.ADMIN_PASSWORD}|${env.SUPABASE_SERVICE_KEY}`;

async function signedIn(request, env) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!/^\d+$/.test(exp || '') || Number(exp) < Date.now() / 1000 || !sig) return false;
  return same(sig, await sign(secretOf(env), `admin|${exp}`));
}

async function rpc(env, fn, body) {
  const key = env.SUPABASE_SERVICE_KEY;
  const headers = { 'Content-Type': 'application/json', apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;   // older service_role keys are JWTs
  const r = await fetch(`${(env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) {
    // PGRST202: the function isn't there yet, so the activity part of supabase/schema.sql hasn't been run
    const missing = r.status === 404 || text.includes('PGRST202');
    return json({ error: missing ? 'schema_missing' : 'database', detail: text.slice(0, 300) }, 502);
  }
  return json(text);
}

const int = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const word = v => (v && /^[a-z0-9_-]{1,30}$/.test(v) ? v : null);
const tz = v => (v && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(v) ? v : 'Asia/Kolkata');

export async function onRequest({ request, env, params }) {
  const path = [].concat(params.path || []).join('/');
  const url = new URL(request.url);
  const q = url.searchParams;
  const configured = !!(env.ADMIN_PASSWORD && env.SUPABASE_SERVICE_KEY);

  if (path === 'login' && request.method === 'POST') {
    if (!configured) return json({ error: 'not_configured' }, 503);
    let password = '';
    try { password = String((await request.json()).password || ''); } catch { /* empty body */ }
    // compare signatures, which are always the same length, rather than the passwords themselves
    const ok = same(await sign(secretOf(env), `pw|${password}`), await sign(secretOf(env), `pw|${env.ADMIN_PASSWORD}`));
    if (!ok) {
      await new Promise(r => setTimeout(r, 800));   // slows down guessing
      return json({ error: 'wrong_password' }, 401);
    }
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    return json({ ok: true }, 200, {
      'Set-Cookie': `${COOKIE}=${exp}.${await sign(secretOf(env), `admin|${exp}`)}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure}`
    });
  }
  if (path === 'logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0` });
  }

  if (!configured) return json({ error: 'not_configured' }, 503);
  if (!(await signedIn(request, env))) return json({ error: 'signed_out' }, 401);

  // Ignore a browser (the owner's own, or any player), or stop ignoring it: { device, label, on }
  if (path === 'ignore' && request.method === 'POST') {
    // only from the admin page itself: a JSON body from this site's own origin
    const origin = request.headers.get('Origin');
    if ((origin && origin !== url.origin) || !(request.headers.get('Content-Type') || '').includes('application/json')) {
      return json({ error: 'forbidden' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch { /* empty body */ }
    const device = String(b.device || '').toLowerCase();
    if (!UUID.test(device)) return json({ error: 'bad_device' }, 400);
    return rpc(env, 'admin_ignore', { p_device: device, p_label: b.label ? String(b.label).slice(0, 60) : null, p_on: b.on !== false });
  }
  if (request.method !== 'GET') return json({ error: 'method' }, 405);

  switch (path) {
    case 'session':
      return json({ ok: true });
    case 'overview':
      return rpc(env, 'admin_overview', { p_days: int(q.get('days'), 30, 1, 365), p_tz: tz(q.get('tz')) });
    case 'events': {
      const device = (q.get('device') || '').toLowerCase();
      return rpc(env, 'admin_events', {
        p_limit: int(q.get('limit'), 100, 1, 500),
        p_before: q.get('before') ? int(q.get('before'), null, 1, Number.MAX_SAFE_INTEGER) : null,
        p_device: UUID.test(device) ? device : null,
        p_event: word(q.get('event')),
        p_game: word(q.get('game'))
      });
    }
    case 'players':
      return rpc(env, 'admin_players', { p_days: int(q.get('days'), 30, 1, 365), p_q: (q.get('q') || '').slice(0, 40) || null, p_limit: int(q.get('limit'), 200, 1, 1000) });
    case 'device': {
      const id = (q.get('id') || '').toLowerCase();
      if (!UUID.test(id)) return json({ error: 'bad_device' }, 400);
      return rpc(env, 'admin_device', { p_device: id });
    }
    case 'lists':
      return rpc(env, 'admin_lists', {});
    case 'ignored':
      return rpc(env, 'admin_ignored_list', {});
    default:
      return json({ error: 'not_found' }, 404);
  }
}

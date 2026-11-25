// Admin dashboard for sizeit.games. Reads /api/admin/* (functions/api/admin/[[path]].js), which reads Supabase.
// Plain JavaScript, no libraries: charts are drawn as SVG.
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = n => Number(n || 0).toLocaleString('en-IN');
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; } })();
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sgadm_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sgadm_' + k, JSON.stringify(v)); } catch { /* private mode */ } }
  };

  const GAMES = {
    'how-big': ['Size It Up', '📏'], heavier: ['Heavier or Lighter', '⚖️'], sort: ['Sort It', '🔢'], ballpark: ['Ballpark', '🎯'],
    speed: ['Speed Race', '🏎️'], fit: ['How Many Fit?', '📦'], far: ['How Far?', '🗺️'], number: ['Number Guess', '🔟'],
    survival: ['Survival', '❤️'], weekly: ['Weekly', '📅']
  };
  const EVENTS = {
    page_view: ['Viewed a page', '👀'], game_end: ['Finished a game', '🏁'], share: ['Shared a result', '📤'],
    random: ['Took a random challenge', '🎲'], league_create: ['Started a league', '🏆'], league_join: ['Joined a league', '🤝'],
    league_invite: ['Invited friends', '✉️'], league_post: ['Posted standings', '📣']
  };
  const MODES = { daily: 'Daily', archive: 'Archive', unlimited: 'Unlimited', endless: 'Endless', rush: 'Rush', run: 'Run', week: 'Weekly' };
  const gname = id => (GAMES[id] ? GAMES[id][0] : id || '—');
  const gicon = id => (GAMES[id] ? GAMES[id][1] : '🎮');
  const evname = e => (EVENTS[e] ? EVENTS[e][0] : String(e || '').replace(/_/g, ' '));
  const evicon = e => (EVENTS[e] ? EVENTS[e][1] : '•');
  const flag = cc => (cc && /^[A-Z]{2}$/.test(cc) && !['XX', 'T1', 'EU', 'AP'].includes(cc)
    ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🌐');
  const country = (() => {
    let dn = null;
    try { dn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser */ }
    return cc => { if (!cc || cc === '??' || cc === 'XX') return 'Unknown'; if (cc === 'T1') return 'Tor'; try { return dn ? dn.of(cc) : cc; } catch { return cc; } };
  })();
  const ago = t => {
    const s = (Date.now() - new Date(t).getTime()) / 1000;
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
    return when(t);
  };
  const when = t => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const timeOnly = t => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const dayLabel = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const localDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // A stable colour and emoji for each browser, so the same player is easy to spot in lists
  const AV = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦉', '🐳', '🦄', '🐝', '🐢', '🦁', '🐧', '🐨', '🦋', '🐬', '🦜'];
  const hashOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const avatar = d => { const h = hashOf(d); return `<span class="avatar" style="background:hsl(${h % 360} 80% 60% / .2)">${AV[h % AV.length]}</span>`; };
  const devTag = d => `<button class="linkish" data-device="${esc(d)}" title="Open this player"><span class="dev">${esc(String(d).slice(0, 8))}</span></button>`;
  const kind = p => (/mobile/.test(p || '') ? 'Mobile' : /tablet/.test(p || '') ? 'Tablet' : /desktop/.test(p || '') ? 'Desktop' : 'Unknown');
  const PAGES = {
    '/size-it-up/': 'how-big', '/which-is-heavier/': 'heavier', '/sort-it/': 'sort', '/ballpark/': 'ballpark', '/speed-race/': 'speed',
    '/how-many-fit/': 'fit', '/how-far/': 'far', '/number-guess/': 'number', '/survival/': 'survival', '/weekly/': 'weekly'
  };
  const pagePretty = p => {
    if (!p || p === '/') return '🏠 Home';
    if (PAGES[p]) return `${gicon(PAGES[p])} ${gname(PAGES[p])}`;
    const s = String(p).replace(/^\/|\/$/g, '');
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
  };
  const delta = (now, before) => {
    if (!before && !now) return '<span class="delta flat">–</span>';
    if (!before) return '<span class="delta up">new</span>';
    const d = Math.round((now - before) / before * 100);
    return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '▲' : d < 0 ? '▼' : ''} ${Math.abs(d)}%</span>`;
  };
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---------- API ----------
  async function api(path, opts = {}) {
    const r = await fetch('/api/admin/' + path, {
      method: opts.method || 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let body = null;
    try { body = await r.json(); } catch { /* not JSON: the API isn't running here */ }
    if (r.status === 401 && path !== 'login') { showLogin(); throw Object.assign(new Error('signed_out'), { quiet: true }); }
    if (!r.ok || !body) throw Object.assign(new Error((body && body.error) || (body ? `HTTP ${r.status}` : 'no_api')), { status: r.status, body });
    return body;
  }
  function explain(e) {
    switch (e.message) {
      case 'not_configured': return 'The admin page isn\'t set up yet. In Cloudflare Pages, add the secrets <code>ADMIN_PASSWORD</code> and <code>SUPABASE_SERVICE_KEY</code>, then redeploy.';
      case 'schema_missing': return 'The database doesn\'t have the activity log yet. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.';
      case 'no_api': return 'The admin API isn\'t reachable here. Open the page on the live site, or run <code>npx wrangler pages dev . --port 8788</code> locally.';
      case 'database': return 'Supabase returned an error. Check that <code>SUPABASE_SERVICE_KEY</code> is a secret (service role) key. ' + esc((e.body && e.body.detail) || '');
      default: return 'Something went wrong: ' + esc(e.message);
    }
  }

  // ---------- State ----------
  const VIEWS = {
    overview: ['Overview', 'How the site is doing'],
    live: ['Live activity', 'Every event as it happens, newest first'],
    players: ['Players', 'Each browser is one player (no names or emails)'],
    scores: ['Daily scores', 'Leaderboard submissions, last 30 days'],
    suggestions: ['Suggestions', 'Objects players want added'],
    leagues: ['Friends Leagues', 'Groups and their members']
  };
  const S = {
    view: VIEWS[store.get('view')] ? store.get('view') : 'overview',
    days: [1, 7, 30, 90].includes(store.get('days')) ? store.get('days') : 30,
    metric: 'players', timer: 0, loading: false, seen: new Set(), feed: [], filters: { event: '', game: '', device: '' },
    players: null, q: '', lists: null, listQ: '', ignored: []
  };

  // ---------- Ignoring the owner's own visits ----------
  // The admin page is on the site's own origin, so it can read the site's device id (sg_device) and turn
  // logging off in this browser (sg_no_log, read by assets/common.js). The server list (admin_ignored) is the
  // source of truth: it also hides the browser's past activity, and works for the owner's other devices.
  const site = {
    get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
  };
  function myDevice() {
    let id = site.get('sg_device');
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      id = crypto.randomUUID ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
      site.set('sg_device', id);   // the site will use this same id from now on
    }
    return id;
  }
  function browserLabel() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : 'Linux';
    const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : 'Safari';
    return `My ${os} · ${br}`;
  }
  const isIgnored = d => (S.ignored || []).some(x => x.device === d);
  // Keeps this browser's sg_no_log in step with the server list, then updates the button and banner
  function syncMe() {
    const me = myDevice(), on = isIgnored(me);
    if (on) site.set('sg_no_log', true); else site.del('sg_no_log');
    const b = $('#meBtn');
    b.hidden = false;
    b.classList.toggle('on', on);
    b.textContent = on ? '✓ My visits ignored' : '🙈 Ignore my visits';
    b.title = on ? 'This browser isn\'t counted. Click to count it again.' : 'Stop counting this browser\'s visits and hide its past activity';
    $('#meBanner').hidden = on || store.get('meDismissed', false);
    renderIgnored();
  }
  async function loadIgnored() {
    try { S.ignored = await api('ignored'); syncMe(); } catch { /* the database may not have the function yet */ }
  }
  async function setIgnored(device, on, label) {
    S.ignored = await api('ignore', { method: 'POST', body: { device, on, label } });
    syncMe();
    go(S.view, true);
  }
  $('#meBtn').addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true;
    try { await setIgnored(myDevice(), !isIgnored(myDevice()), browserLabel()); } catch (err) { if (!err.quiet) { $('#notice').innerHTML = explain(err); $('#notice').hidden = false; } }
    finally { b.disabled = false; }
  });
  $('#meBannerYes').addEventListener('click', () => $('#meBtn').click());
  $('#meBannerNo').addEventListener('click', () => { store.set('meDismissed', true); $('#meBanner').hidden = true; });

  // ---------- Sign in ----------
  function showLogin(msg, info) {
    clearInterval(S.timer);
    $('#app').hidden = true; $('#login').hidden = false;
    const m = $('#loginMsg');
    m.innerHTML = msg || ''; m.classList.toggle('info', !!info);
    setTimeout(() => $('#pw').focus(), 50);
  }
  function showApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    go(S.view);
    loadIgnored();
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await api('login', { method: 'POST', body: { password: $('#pw').value } });
      $('#pw').value = '';
      showApp();
    } catch (err) {
      showLogin(err.message === 'wrong_password' ? 'That password isn\'t right.' : explain(err), err.message !== 'wrong_password');
    } finally { btn.disabled = false; btn.textContent = 'Sign in'; }
  });
  $('#logoutBtn').addEventListener('click', async () => { try { await api('logout', { method: 'POST' }); } catch { /* signed out anyway */ } showLogin('Signed out.', true); });

  // ---------- Theme ----------
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  applyTheme(store.get('theme', ''));
  $('#themeBtn').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const t = dark ? 'light' : 'dark';
    store.set('theme', t); applyTheme(t); go(S.view, true);
  });

  // ---------- Navigation ----------
  $('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) go(b.dataset.view); });
  $('#range').addEventListener('click', e => {
    const b = e.target.closest('button[data-days]'); if (!b) return;
    S.days = +b.dataset.days; store.set('days', S.days); S.players = null; go(S.view);
  });
  $('#refreshBtn').addEventListener('click', () => go(S.view, true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#app').hidden) refresh(); });

  function go(view, keep) {
    if (view !== S.view) S.listQ = '';
    S.view = view; store.set('view', view);
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    $$('#range button').forEach(b => b.classList.toggle('on', +b.dataset.days === S.days));
    $('#range').hidden = !['overview', 'players'].includes(view);
    $('#title').textContent = VIEWS[view][0];
    $('#subtitle').textContent = VIEWS[view][1];
    if (!keep) $('#view').innerHTML = '<div class="grid g-kpi">' + '<div class="skel"></div>'.repeat(4) + '</div><div class="skel" style="min-height:300px"></div>';
    refresh();
    clearInterval(S.timer);
    // Live activity refreshes every 15 seconds, everything else every minute
    S.timer = setInterval(() => { if (!document.hidden) refresh(true); }, view === 'live' ? 15000 : 60000);
  }

  async function refresh(silent) {
    if (S.loading) return;
    S.loading = true;
    const btn = $('#refreshBtn'); btn.classList.add('spin');
    try {
      const view = S.view;
      if (view === 'overview') renderOverview(await api(`overview?days=${S.days}&tz=${encodeURIComponent(TZ)}`));
      else if (view === 'live') await loadFeed(silent);
      else if (view === 'players') renderPlayers(await api(`players?days=${S.days}&q=${encodeURIComponent(S.q)}`));
      else { S.lists = await api('lists'); renderList(view); }
      $('#notice').hidden = true;
      $('#updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      if (!e.quiet) { $('#notice').innerHTML = explain(e); $('#notice').hidden = false; if (!silent && $('.skel')) $('#view').innerHTML = ''; }
    } finally { S.loading = false; btn.classList.remove('spin'); }
  }

  // ---------- Charts ----------
  // A round top for the y axis that splits into five round steps (5, 10, 20, 50, 100, 250, 500…)
  const niceMax = v => { if (v <= 5) return 5; const p = 10 ** Math.floor(Math.log10(v)); return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v && Number.isInteger(m / 5)); };
  const tip = $('#tip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, y - h - 12) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  // Area chart of one series over days. rows: [{ day, ...values }]
  function areaChart(rows, key, color, label) {
    const W = 760, H = 250, L = 40, R = 14, T = 16, B = 28;
    const vals = rows.map(r => +r[key] || 0), max = niceMax(Math.max(1, ...vals)), n = rows.length;
    const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
    const y = v => T + (H - T - B) * (1 - v / max);
    const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const area = `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const ticks = [0, 1, 2, 3, 4, 5].map(i => max * i / 5);
    const every = Math.max(1, Math.ceil(n / 7));
    const id = 'g' + key;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per day">
      <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
    ticks.forEach(t => { s += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${nf(t)}</text>`; });
    rows.forEach((r, i) => { if (i % every === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(dayLabel(r.day))}</text>`; });
    s += `<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (n <= 45) vals.forEach((v, i) => { s += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === n - 1 ? 4.5 : 2.5}" fill="${i === n - 1 ? color : cssVar('--panel')}" stroke="${color}" stroke-width="2"/>`; });
    s += `<line class="guide" id="guide-${key}" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
    const step = n === 1 ? W - L - R : (W - L - R) / (n - 1);
    rows.forEach((r, i) => { s += `<rect x="${x(i) - step / 2}" y="${T}" width="${step}" height="${H - T - B}" fill="transparent" data-i="${i}"/>`; });
    return s + '</svg>';
  }
  function bindChart(svgBox, rows) {
    const svg = $('svg', svgBox); if (!svg) return;
    const guide = $('.guide', svg);
    svg.addEventListener('mousemove', e => {
      const r = e.target.closest('rect[data-i]'); if (!r) return;
      const i = +r.dataset.i, row = rows[i], cx = +r.getAttribute('x') + +r.getAttribute('width') / 2;
      guide.setAttribute('x1', cx); guide.setAttribute('x2', cx); guide.setAttribute('visibility', 'visible');
      showTip(`<b>${esc(new Date(row.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br>
        👥 ${nf(row.players)} players · 🆕 ${nf(row.new)} new<br>🏁 ${nf(row.games)} games · 👀 ${nf(row.views)} views`, e.clientX, e.clientY);
    });
    svg.addEventListener('mouseleave', () => { guide.setAttribute('visibility', 'hidden'); hideTip(); });
  }
  function donut(parts) {
    const total = parts.reduce((a, p) => a + p.v, 0) || 1, r = 52, c = 2 * Math.PI * r;
    let off = 0, s = `<svg class="donut" viewBox="0 0 130 130"><circle cx="65" cy="65" r="${r}" fill="none" stroke="${cssVar('--panel2')}" stroke-width="16"/>`;
    parts.forEach(p => {
      const len = p.v / total * c;
      s += `<circle cx="65" cy="65" r="${r}" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 65 65)"/>`;
      off += len;
    });
    const top = parts.slice().sort((a, b) => b.v - a.v)[0];
    return s + `<text x="65" y="64" text-anchor="middle" font-size="24">${pct(top ? top.v : 0, total)}%</text><text x="65" y="84" text-anchor="middle" font-size="11" style="fill:var(--muted);font-family:system-ui;font-weight:600">${esc(top ? top.k : '')}</text></svg>`;
  }
  const barList = (rows, label, value, sub, color) => {
    if (!rows.length) return '<p class="empty">Nothing yet</p>';
    const max = Math.max(1, ...rows.map(value));
    return `<div class="bars">${rows.map(r => `<div class="bar-row"><div class="name">${label(r)}</div><div class="val">${nf(value(r))}</div>
      <div class="track"><b style="width:${(value(r) / max * 100).toFixed(1)}%;${color ? 'background:' + color : ''}"></b></div>${sub ? `<div class="meta">${sub(r)}</div>` : ''}</div>`).join('')}</div>`;
  };

  // ---------- Overview ----------
  function renderOverview(d) {
    const k = d.kpi, range = S.days === 1 ? 'today' : `last ${S.days} days`;
    const series = d.series || [];
    const kinds = {};
    (d.platforms || []).forEach(p => { const t = kind(p.platform); kinds[t] = (kinds[t] || 0) + p.players; });
    const kindColors = { Mobile: cssVar('--accent'), Desktop: cssVar('--c2'), Tablet: cssVar('--c3'), Unknown: cssVar('--muted') };
    const parts = Object.entries(kinds).map(([k2, v]) => ({ k: k2, v, color: kindColors[k2] }));
    const os = {}, br = {};
    (d.platforms || []).forEach(p => { const [o, b] = String(p.platform).split(' · '); os[o] = (os[o] || 0) + p.players; if (b) br[b] = (br[b] || 0) + p.players; });
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
    (d.heat || []).forEach(h => { heat[h.d - 1][h.h] = h.c; });
    const heatMax = Math.max(1, ...heat.flat());
    const metricInfo = { players: ['Players', '--accent'], games: ['Games finished', '--c2'], views: ['Page views', '--c3'], new: ['New players', '--c4'] };
    const returning = pct(k.returning_range, k.players_range);

    $('#view').innerHTML = `
      <div class="grid g-kpi">
        <div class="card kpi hero"><div class="label"><span class="live-dot"></span> Live now</div><div class="value">${nf(k.live)}</div><div class="sub">players in the last 5 minutes</div><div class="ico">⚡</div></div>
        <div class="card kpi"><div class="label">Players today ${delta(k.players_today, k.players_yesterday)}</div><div class="value">${nf(k.players_today)}</div><div class="sub">${nf(k.new_today)} new · ${nf(k.sessions_today)} visits</div><div class="ico">👥</div></div>
        <div class="card kpi c2"><div class="label">Games finished today ${delta(k.games_today, k.games_yesterday)}</div><div class="value">${nf(k.games_today)}</div><div class="sub">${nf(k.views_today)} page views today</div><div class="ico">🏁</div></div>
        <div class="card kpi c3"><div class="label">Avg. visit length</div><div class="value">${k.avg_session_min == null ? '–' : nf(k.avg_session_min)}<small style="font-size:1rem"> min</small></div><div class="sub">${range}</div><div class="ico">⏱️</div></div>
      </div>
      <div class="grid g-kpi">
        <div class="card kpi"><div class="label">Players, ${range}</div><div class="value">${nf(k.players_range)}</div><div class="sub">${nf(k.new_range)} new · ${returning}% came back</div><div class="ico">📈</div></div>
        <div class="card kpi c2"><div class="label">Games, ${range}</div><div class="value">${nf(k.games_range)}</div><div class="sub">${k.players_range ? (k.games_range / k.players_range).toFixed(1) : '0'} per player</div><div class="ico">🎮</div></div>
        <div class="card kpi c3"><div class="label">Daily scores today</div><div class="value">${nf(k.scores_today)}</div><div class="sub">sent to the leaderboard</div><div class="ico">🏅</div></div>
        <div class="card kpi"><div class="label">All-time players</div><div class="value">${nf(k.players_all)}</div><div class="sub">${nf(k.events_all)} events logged</div><div class="ico">🌍</div></div>
      </div>

      <div class="card">
        <header><h2>Activity per day <small>${esc(dayLabel(d.since))} – ${esc(dayLabel(d.today))}</small></h2>
          <div class="seg" id="metric">${Object.entries(metricInfo).map(([m, [l]]) => `<button data-m="${m}" class="${m === S.metric ? 'on' : ''}">${l}</button>`).join('')}</div></header>
        <div id="mainChart">${areaChart(series, S.metric, cssVar(metricInfo[S.metric][1]), metricInfo[S.metric][0])}</div>
      </div>

      <div class="grid g-2">
        <div class="card"><header><h2>Games <small>${range}</small></h2><span class="chip">${nf(k.games_range)} finished</span></header>
          ${barList(d.games || [], g => `<span>${gicon(g.game)}</span><span>${esc(gname(g.game))}</span>`, g => g.plays,
            g => `${nf(g.players)} players · avg score ${nf(g.avg_score)} · best ${nf(g.best)} <span class="chips">${Object.entries(g.modes || {}).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<span class="chip">${esc(MODES[m] || m)} ${nf(n)}</span>`).join('')}</span>`)}
        </div>
        <div class="card"><header><h2>When players play <small>${esc(TZ)}</small></h2></header>
          <div class="heat" id="heat"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="hl">${h % 3 ? '' : h}</span>`).join('')}
            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dn, di) => `<span class="dl">${dn}</span>${heat[di].map((c, h) => `<span class="cell" data-t="${dn} ${String(h).padStart(2, '0')}:00 · ${nf(c)} events" style="opacity:${c ? (0.12 + 0.88 * c / heatMax).toFixed(2) : 0.05}"></span>`).join('')}`).join('')}
          </div>
          <p class="small muted" style="margin:12px 0 0">Darker squares mean more activity in that hour.</p>
        </div>
      </div>

      <div class="grid g-3">
        <div class="card"><header><h2>Countries</h2></header>
          ${barList((d.countries || []).slice(0, 8), c => `<span>${flag(c.country)}</span><span>${esc(country(c.country))}</span>`, c => c.players, null, cssVar('--c2'))}</div>
        <div class="card"><header><h2>Devices</h2></header>
          ${parts.length ? `<div class="donut-wrap">${donut(parts)}<div class="legend" style="flex-direction:column;gap:6px">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.k)} · ${nf(p.v)}</span>`).join('')}</div></div>
          <div class="stat-list" style="margin-top:16px">${top(os, 4).map(([o, n]) => `<div><span>${esc(o)}</span><b>${nf(n)}</b></div>`).join('')}</div>
          <p class="small muted" style="margin:10px 0 0">Browsers: ${top(br, 4).map(([b, n]) => `${esc(b)} ${nf(n)}`).join(' · ')}</p>` : '<p class="empty">Nothing yet</p>'}</div>
        <div class="card"><header><h2>Where they come from</h2></header>
          ${(d.refs || []).length ? barList(d.refs.slice(0, 8), r => `<span>🔗</span><span>${esc(r.ref)}</span>`, r => r.visits, r => `${nf(r.players)} players`, cssVar('--c3'))
            : '<p class="empty">No links from other sites yet. Direct visits and apps (WhatsApp, Instagram) usually send no referrer.</p>'}</div>
      </div>

      <div class="grid g-3">
        <div class="card"><header><h2>Top pages</h2></header>
          ${barList((d.pages || []).slice(0, 10), p => `<span>${esc(pagePretty(p.page))}</span>`, p => p.views, p => `${nf(p.players)} players`)}</div>
        <div class="card"><header><h2>What players do</h2></header>
          ${barList(d.events || [], e => `<span>${evicon(e.event)}</span><span>${esc(evname(e.event))}</span>`, e => e.n, e => `${nf(e.players)} players`, cssVar('--c2'))}</div>
        <div class="card"><header><h2>Community</h2></header>
          <div class="stat-list">
            <div><span>🏅 Daily scores today</span><b>${nf(k.scores_today)}</b></div>
            <div><span>🏆 Friends Leagues</span><b>${nf(k.leagues)}</b></div>
            <div><span>👥 League members</span><b>${nf(k.league_members)}</b></div>
            <div><span>💡 Suggestions this week</span><b>${nf(k.suggestions_week)}</b></div>
            <div><span>📬 Suggestions in total</span><b>${nf(k.suggestions_all)}</b></div>
          </div>
          <p style="margin:16px 0 0"><button class="btn" data-goto="suggestions">See suggestions →</button></p>
        </div>
      </div>`;

    bindChart($('#mainChart'), series);
    $('#metric').addEventListener('click', e => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      S.metric = b.dataset.m;
      $$('#metric button').forEach(x => x.classList.toggle('on', x === b));
      $('#mainChart').innerHTML = areaChart(series, S.metric, cssVar(metricInfo[S.metric][1]), metricInfo[S.metric][0]);
      bindChart($('#mainChart'), series);
    });
    $('#heat').addEventListener('mousemove', e => { const c = e.target.closest('.cell'); if (c) showTip(esc(c.dataset.t), e.clientX, e.clientY); else hideTip(); });
    $('#heat').addEventListener('mouseleave', hideTip);
  }

  // ---------- Live activity ----------
  function evRow(e, opts = {}) {
    const bits = [];
    if (e.game) bits.push(`${gicon(e.game)} ${esc(gname(e.game))}`);
    if (e.mode) bits.push(esc(MODES[e.mode] || e.mode));
    if (e.event === 'page_view') bits.push(esc(pagePretty(e.page)));
    if (e.ref) bits.push(`from ${esc(e.ref)}`);
    if (e.data && e.data.how) bits.push(esc(e.data.how));
    if (e.data && e.data.vs) bits.push('⚔️ challenge');
    if (e.data && e.data.src) bits.push(`utm: ${esc(e.data.src)}`);
    if (!opts.device) { bits.push(`${flag(e.country)} ${esc(country(e.country))}`); if (e.platform) bits.push(esc(e.platform)); }
    const score = e.event === 'game_end' && e.score != null ? ` · <b>${nf(e.score)}</b> pts` : '';
    return `<div class="ev ${esc(e.event)}${opts.fresh ? ' fresh' : ''}" data-id="${e.id}">
      <span class="ic">${evicon(e.event)}</span>
      <div class="what"><b>${esc(evname(e.event))}</b>${score}<div class="meta">${bits.map(b => `<span>${b}</span>`).join('<span>·</span>')}</div></div>
      <div class="when"><span title="${esc(when(e.created_at))}">${opts.device ? timeOnly(e.created_at) : ago(e.created_at)}</span>${opts.device ? '' : `<br>${devTag(e.device)}`}</div>
    </div>`;
  }
  function feedQuery(extra = '') {
    const f = S.filters, q = new URLSearchParams({ limit: '100' });
    if (f.event) q.set('event', f.event);
    if (f.game) q.set('game', f.game);
    if (f.device) q.set('device', f.device);
    return `events?${q}${extra}`;
  }
  async function loadFeed(silent) {
    const rows = await api(feedQuery());
    if (!$('#feed')) renderLiveShell();
    const fresh = silent ? rows.filter(r => !S.seen.has(r.id)) : [];
    S.feed = rows;
    rows.forEach(r => S.seen.add(r.id));
    const freshIds = new Set(fresh.map(r => r.id));
    $('#feed').innerHTML = rows.length ? rows.map(r => evRow(r, { fresh: freshIds.has(r.id) })).join('') : '<p class="empty">No events match. Activity shows up here a few seconds after it happens.</p>';
    $('#moreBtn').hidden = rows.length < 100;
    const live = rows.filter(r => Date.now() - new Date(r.created_at) < 5 * 60000);
    $('#liveCount').textContent = `${new Set(live.map(r => r.device)).size} active in the last 5 min`;
    $('#navLive').hidden = !live.length;
  }
  function renderLiveShell() {
    const f = S.filters;
    $('#view').innerHTML = `
      <div class="card">
        <header><h2><span class="live-dot"></span>&nbsp; Live feed <small id="liveCount"></small></h2>
          <div class="filters">
            <select id="fEvent" aria-label="Event"><option value="">All events</option>${Object.keys(EVENTS).map(k => `<option value="${k}"${f.event === k ? ' selected' : ''}>${esc(EVENTS[k][0])}</option>`).join('')}</select>
            <select id="fGame" aria-label="Game"><option value="">All games</option>${Object.keys(GAMES).map(k => `<option value="${k}"${f.game === k ? ' selected' : ''}>${esc(GAMES[k][0])}</option>`).join('')}</select>
            ${f.device ? `<span class="chip accent">Player ${esc(f.device.slice(0, 8))} <button class="linkish" id="clearDev" aria-label="Show all players">✕</button></span>` : ''}
          </div></header>
        <div class="feed" id="feed"></div>
        <div class="more"><button class="btn" id="moreBtn" hidden>Load older</button></div>
      </div>`;
    $('#fEvent').addEventListener('change', e => { S.filters.event = e.target.value; reloadFeed(); });
    $('#fGame').addEventListener('change', e => { S.filters.game = e.target.value; reloadFeed(); });
    const cd = $('#clearDev'); if (cd) cd.addEventListener('click', () => { S.filters.device = ''; reloadFeed(); });
    $('#moreBtn').addEventListener('click', async () => {
      const last = S.feed[S.feed.length - 1]; if (!last) return;
      const older = await api(feedQuery(`&before=${last.id}`));
      S.feed = S.feed.concat(older);
      older.forEach(r => S.seen.add(r.id));
      $('#feed').insertAdjacentHTML('beforeend', older.map(r => evRow(r)).join(''));
      $('#moreBtn').hidden = older.length < 100;
    });
  }
  function reloadFeed() { $('#view').innerHTML = ''; renderLiveShell(); refresh(); }

  // ---------- Players ----------
  function renderPlayers(rows) {
    S.players = rows;
    if (!$('#pSearch')) {
      $('#view').innerHTML = `
        <div class="card">
          <header><h2>Players <small id="pCount"></small></h2>
            <div class="filters"><input type="search" id="pSearch" placeholder="Search a device id or league name…" value="${esc(S.q)}"></div></header>
          <div class="table-wrap"><table class="nowrap"><thead><tr><th>Player</th><th>Last seen</th><th>First seen</th><th class="r">Days</th><th class="r">Visits</th><th class="r">Games</th><th class="r">Pages</th><th>Last game</th><th>Where</th><th>Device</th></tr></thead>
          <tbody id="pBody"></tbody></table></div>
        </div>
        <div class="card"><header><h2>Ignored browsers <small>left out of every number and list</small></h2></header><div id="ignBody"></div></div>`;
      $('#ignBody').addEventListener('click', async e => {
        const b = e.target.closest('button[data-unignore]'); if (!b) return;
        b.disabled = true;
        try { await setIgnored(b.dataset.unignore, false); } catch (err) { b.disabled = false; if (!err.quiet) { $('#notice').innerHTML = explain(err); $('#notice').hidden = false; } }
      });
      let t = 0;
      $('#pSearch').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); refresh(); }, 300); });
      $('#pBody').addEventListener('click', e => { const tr = e.target.closest('tr[data-device]'); if (tr) openDevice(tr.dataset.device); });
    }
    $('#pCount').textContent = `${nf(rows.length)} ${S.days === 1 ? 'today' : `in the last ${S.days} days`}${rows.length >= 200 ? ' (newest 200)' : ''}`;
    $('#pBody').innerHTML = rows.length ? rows.map(p => `<tr class="click" data-device="${esc(p.device)}">
      <td><div class="who">${avatar(p.device)}<div><span class="dev">${esc(p.device.slice(0, 8))}</span>${p.names ? `<div class="small">${esc(p.names)}</div>` : ''}</div></div></td>
      <td title="${esc(when(p.last_seen))}">${ago(p.last_seen)}</td><td title="${esc(when(p.first_seen))}" class="muted">${ago(p.first_seen)}</td>
      <td class="r">${nf(p.days)}</td><td class="r">${nf(p.sessions)}</td><td class="r"><b>${nf(p.games)}</b></td><td class="r">${nf(p.views)}</td>
      <td>${p.last_game ? `${gicon(p.last_game)} ${esc(gname(p.last_game))}` : '<span class="muted">–</span>'}</td>
      <td>${flag(p.country)} ${esc(country(p.country))}</td><td class="small muted">${esc(p.platform || '')}</td></tr>`).join('')
      : `<tr><td colspan="10" class="empty">${S.q ? 'No player matches that search.' : 'No players in this period yet.'}</td></tr>`;
    renderIgnored();
  }
  function renderIgnored() {
    const box = $('#ignBody'); if (!box) return;
    const me = myDevice(), rows = S.ignored || [];
    box.innerHTML = rows.length ? `<div class="table-wrap"><table class="nowrap"><thead><tr><th>Browser</th><th>Ignored</th><th class="r">Hidden events</th><th>Last seen</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><div class="who">${avatar(r.device)}<div>${devTag(r.device)} ${r.device === me ? '<span class="chip accent">this browser</span>' : ''}<div class="small">${esc(r.label || '')}</div></div></div></td>
        <td class="muted">${ago(r.created_at)}</td><td class="r">${nf(r.events)}</td><td class="muted">${r.last_seen ? ago(r.last_seen) : '–'}</td>
        <td class="r"><button class="btn" data-unignore="${esc(r.device)}">Count again</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty">None yet. Use “Ignore my visits” in the sidebar on each of your own devices, or “Ignore this player” in a player\'s details.</p>';
  }

  // ---------- One player ----------
  async function openDevice(id) {
    $('#scrim').hidden = false; $('#drawer').hidden = false;
    $('#drawerBody').innerHTML = '<div class="skel" style="min-height:420px"></div>';
    try {
      const d = await api(`device?id=${encodeURIComponent(id)}`);
      const s = d.summary || {}, evs = d.events || [];
      const last = evs[0] || {};
      const ign = !!d.ignored, mine = id === myDevice();
      let html = `<section><div class="who">${avatar(id)}<div><h2>Player ${esc(id.slice(0, 8))} ${mine ? '<span class="chip accent">this browser</span>' : ''} ${ign ? '<span class="chip ignored">ignored</span>' : ''}</h2>
        <div class="small muted">${flag(last.country)} ${esc(country(last.country))}${last.platform ? ' · ' + esc(last.platform) : ''}</div></div></div>
        <p class="small muted" style="margin:10px 0 0">Device id <span class="dev">${esc(id)}</span> <button class="btn" style="padding:2px 8px;font-size:.78rem" id="copyId">Copy</button></p>
        <p style="margin:12px 0 0"><button class="btn" id="ignoreDev">${ign ? '👁️ Count this player again' : '🙈 Ignore this player'}</button>
        <span class="small muted">${ign ? 'Hidden from every number and list.' : 'For your own phone or laptop: hides it from every number and list.'}</span></p></section>
        <section class="mini-kpis">
          <div><b>${nf(s.games)}</b><span>games finished</span></div><div><b>${nf(s.sessions)}</b><span>visits</span></div><div><b>${nf(s.views)}</b><span>pages viewed</span></div>
          <div><b style="font-size:1rem">${s.first_seen ? esc(when(s.first_seen)) : '–'}</b><span>first seen</span></div>
          <div><b style="font-size:1rem">${s.last_seen ? esc(ago(s.last_seen)) : '–'}</b><span>last seen</span></div>
          <div><b>${nf((d.leagues || []).length)}</b><span>leagues</span></div>
        </section>`;
      if ((d.leagues || []).length) html += `<section class="card"><h2 style="font-size:1rem;margin-bottom:8px">Leagues</h2>${d.leagues.map(l => `<div class="stat-list"><div><span>🏆 ${esc(l.league)} <span class="chip">${esc(l.code)}</span></span><b>as “${esc(l.name)}”</b></div></div>`).join('')}</section>`;
      if ((d.games || []).length) html += `<section class="card"><h2 style="font-size:1rem;margin-bottom:8px">Games</h2><div class="table-wrap"><table><thead><tr><th>Game</th><th class="r">Played</th><th class="r">Avg</th><th class="r">Best</th></tr></thead><tbody>
        ${d.games.map(g => `<tr><td>${gicon(g.game)} ${esc(gname(g.game))}</td><td class="r">${nf(g.plays)}</td><td class="r">${nf(g.avg_score)}</td><td class="r"><b>${nf(g.best)}</b></td></tr>`).join('')}</tbody></table></div></section>`;
      if ((d.scores || []).length) html += `<section class="card"><h2 style="font-size:1rem;margin-bottom:8px">Daily scores on the leaderboard</h2><div class="table-wrap"><table><thead><tr><th>Day</th><th>Game</th><th class="r">Score</th></tr></thead><tbody>
        ${d.scores.slice(0, 30).map(x => `<tr><td>${esc(dayLabel(x.day))}</td><td>${gicon(x.game)} ${esc(gname(x.game))}</td><td class="r"><b>${nf(x.score)}</b>${x.max ? `<span class="muted"> / ${nf(x.max)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
      html += '<section class="card"><h2 style="font-size:1rem">Timeline <small>newest first</small></h2><div class="timeline">';
      let day = '', sess = '';
      evs.forEach(e => {
        const dd = localDay(e.created_at);
        if (dd !== day) { html += `<div class="timeline-day">${esc(new Date(e.created_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }))}</div>`; day = dd; sess = e.session; }
        else if (e.session !== sess) { html += '<div class="sess-break">new visit</div>'; sess = e.session; }
        html += evRow(e, { device: true });
      });
      if (!evs.length) html += '<p class="empty">No activity logged for this player.</p>';
      html += `</div>${evs.length >= 300 ? '<p class="small muted">Showing the newest 300 events.</p>' : ''}</section>
        <p><button class="btn" id="devFeed">Show in Live activity →</button></p>`;
      $('#drawerBody').innerHTML = html;
      $('#ignoreDev').addEventListener('click', async e => {
        e.target.disabled = true;
        try {
          await setIgnored(id, !ign, mine ? browserLabel() : `Player ${id.slice(0, 8)}${last.platform ? ' · ' + last.platform : ''}`);
          openDevice(id);
        } catch (err) { if (!err.quiet) $('#drawerBody').insertAdjacentHTML('afterbegin', `<div class="notice">${explain(err)}</div>`); e.target.disabled = false; }
      });
      $('#copyId').addEventListener('click', e => { navigator.clipboard && navigator.clipboard.writeText(id).then(() => { e.target.textContent = 'Copied'; }); });
      $('#devFeed').addEventListener('click', () => { closeDrawer(); S.filters = { event: '', game: '', device: id }; $('#view').innerHTML = ''; go('live'); });
    } catch (e) {
      if (!e.quiet) $('#drawerBody').innerHTML = `<div class="notice">${explain(e)}</div>`;
    }
  }
  function closeDrawer() { $('#scrim').hidden = true; $('#drawer').hidden = true; }
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  // Any device tag anywhere opens that player
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-device].linkish'); if (b) { e.stopPropagation(); openDevice(b.dataset.device); return; }
    const g = e.target.closest('[data-goto]'); if (g) go(g.dataset.goto);
  });

  // ---------- Scores, suggestions, leagues ----------
  function renderList(view) {
    const L = S.lists || {};
    const search = `<input type="search" id="lSearch" placeholder="Filter…" value="${esc(S.listQ)}">`;
    const match = (...xs) => !S.listQ || xs.join(' ').toLowerCase().includes(S.listQ.toLowerCase());
    let html = '';
    if (view === 'scores') {
      const rows = L.scores || [];
      const byDay = {};
      rows.forEach(r => { byDay[r.day] = (byDay[r.day] || 0) + r.players; });
      const days = Object.keys(byDay).sort().map(day => ({ day, players: byDay[day], games: 0, views: 0, new: 0 }));
      const perGame = {};
      rows.forEach(r => { const g = perGame[r.game] || (perGame[r.game] = { game: r.game, players: 0, days: 0, avg: 0 }); g.players += r.players; g.days++; g.avg += r.avg_score / (r.max || 1); });
      html = `<div class="card"><header><h2>Scores sent per day</h2></header>${days.length ? `<div id="scoreChart">${areaChart(days, 'players', cssVar('--accent'), 'Scores')}</div>` : '<p class="empty">No Daily scores in the last 30 days.</p>'}</div>
      <div class="grid g-2">
        <div class="card"><header><h2>By game <small>30 days</small></h2></header>${barList(Object.values(perGame).sort((a, b) => b.players - a.players), g => `<span>${gicon(g.game)}</span><span>${esc(gname(g.game))}</span>`, g => g.players, g => `avg ${Math.round(g.avg / g.days * 100)}% of the max score`)}</div>
      <div class="card"><header><h2>Every day and game</h2>${search}</header><div class="table-wrap"><table><thead><tr><th>Day</th><th>Game</th><th class="r">Players</th><th class="r">Average</th><th class="r">Best</th><th class="r">Max</th></tr></thead><tbody>
        ${rows.filter(r => match(r.day, gname(r.game))).map(r => `<tr><td>${esc(dayLabel(r.day))}</td><td>${gicon(r.game)} ${esc(gname(r.game))}</td><td class="r"><b>${nf(r.players)}</b></td><td class="r">${nf(r.avg_score)}</td><td class="r">${nf(r.best)}</td><td class="r muted">${nf(r.max)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nothing here</td></tr>'}
      </tbody></table></div></div></div>`;
      $('#view').innerHTML = html;
      if (days.length) bindChart($('#scoreChart'), days);
    } else if (view === 'suggestions') {
      const rows = (L.suggestions || []).filter(r => match(r.name, r.category, r.measure, r.note, r.source));
      html = `<div class="card"><header><h2>Suggestions <small>${nf((L.suggestions || []).length)} newest</small></h2>${search}</header><div class="table-wrap"><table>
        <thead><tr><th>When</th><th>Object</th><th>Category</th><th>Size or weight</th><th>Source</th><th>Note</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td class="muted" title="${esc(when(r.created_at))}">${ago(r.created_at)}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.category || '')}</td><td class="wrap-text">${esc(r.measure || '')}</td>
          <td class="wrap-text">${/^https?:\/\//i.test(r.source || '') ? `<a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${esc(r.source.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}</a>` : esc(r.source || '')}</td>
          <td class="wrap-text">${esc(r.note || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No suggestions yet.</td></tr>'}
      </tbody></table></div></div>`;
      $('#view').innerHTML = html;
    } else if (view === 'leagues') {
      const all = L.leagues || [], rows = all.filter(r => match(r.name, r.code, r.names));
      const members = all.reduce((a, l) => a + l.members, 0);
      html = `<div class="grid g-kpi">
        <div class="card kpi"><div class="label">Leagues</div><div class="value">${nf(all.length)}</div><div class="ico">🏆</div></div>
        <div class="card kpi c2"><div class="label">Members</div><div class="value">${nf(members)}</div><div class="ico">👥</div></div>
        <div class="card kpi c3"><div class="label">Average size</div><div class="value">${all.length ? (members / all.length).toFixed(1) : '0'}</div><div class="ico">📐</div></div>
        <div class="card kpi"><div class="label">Biggest</div><div class="value">${nf(all.length ? Math.max(...all.map(l => l.members)) : 0)}</div><div class="sub">${esc(all[0] ? all[0].name : '')}</div><div class="ico">⭐</div></div>
      </div>
      <div class="card"><header><h2>All leagues</h2>${search}</header><div class="table-wrap"><table><thead><tr><th>League</th><th>Code</th><th>Started</th><th class="r">Members</th><th>Names</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td><span class="chip">${esc(r.code)}</span></td><td class="muted" title="${esc(when(r.created_at))}">${ago(r.created_at)}</td><td class="r"><b>${nf(r.members)}</b></td><td class="wrap-text small">${esc(r.names || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No leagues yet.</td></tr>'}
      </tbody></table></div></div>`;
      $('#view').innerHTML = html;
    }
    const ls = $('#lSearch');
    if (ls) {
      ls.addEventListener('input', e => { S.listQ = e.target.value; const pos = e.target.selectionStart; renderList(view); const n = $('#lSearch'); n.focus(); n.setSelectionRange(pos, pos); });
    }
  }

  // ---------- Start ----------
  (async () => {
    try { await api('session'); showApp(); } catch (e) {
      if (e.quiet) return;                       // signed out: the login form is already showing
      showLogin(explain(e), true);
    }
  })();
})();

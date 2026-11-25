// Shared site config and helpers for every game page.
(() => {
  'use strict';

  // ---------- Site config: change names here ----------
  const SITE = {
    name: 'sizeit.games',             // shown in the header, footer, share text and share images
    tagline: 'Daily games about size, weight and scale',
    contact: 'contact@sizeit.games',   // shown in the footer and on the Privacy page
    epoch: '2026-11-01',               // day #1 for every daily puzzle; the archive starts here. Set to your launch date.
    // daily: where each game keeps its Daily results, and how to score one day's record (for Stats and Archive)
    games: [
      {
        id: 'how-big', name: 'Size It Up', path: 'size-it-up/', status: 'live', icon: 'size',
        desc: 'Resize an object until it matches its real size next to another. Five rounds a day, plus Unlimited.',
        daily: { key: 'sg_howbig_daily', max: 1000, score: r => sum(r.scores) }
      },
      {
        id: 'heavier', name: 'Heavier or Lighter', path: 'which-is-heavier/', status: 'live', icon: 'weight',
        desc: 'Is the next object heavier or lighter? Ten a day, or keep an endless streak going.',
        daily: { key: 'sg_heavier_daily', max: 10, score: r => r.answers.filter(Boolean).length }
      },
      {
        id: 'sort', name: 'Sort It', path: 'sort-it/', status: 'live', icon: 'sort',
        desc: 'Put five things in order, smallest to biggest or lightest to heaviest. See them lined up at true scale.',
        daily: { key: 'sg_sort_daily', max: 20, score: r => sum(r.scores) }
      },
      {
        id: 'ballpark', name: 'Ballpark', path: 'ballpark/', status: 'live', icon: 'ballpark',
        desc: 'Skip the exact number. Is it in the tens, the thousands or the billions? Ten a day, or a 60-second Rush.',
        daily: { key: 'sg_ballpark_daily', max: 30, score: r => sum(r.answers.map(d => d === 0 ? 3 : Math.abs(d) === 1 ? 1 : 0)) }
      },
      {
        id: 'speed', name: 'Speed Race', path: 'speed-race/', status: 'live', icon: 'speed',
        desc: 'Cheetah or scooter? Pick the faster racer, guess by how much, then watch them race at true speed.',
        daily: { key: 'sg_speed_daily', max: 16, score: r => sum(r.answers.map(a => (a.w ? 1 : 0) + (a.g ? 1 : 0))) }
      },
      {
        id: 'fit', name: 'How Many Fit?', path: 'how-many-fit/', status: 'live', icon: 'fit',
        desc: 'How many buses long is the Titanic? Guess how many of one thing fit along another, then watch them line up.',
        daily: { key: 'sg_fit_daily', max: 1000, score: r => sum(r.scores) }
      },
      {
        id: 'far', name: 'How Far?', path: 'how-far/', status: 'live', icon: 'far',
        desc: 'Delhi to Mumbai? London to Tokyo? Guess the straight-line distance between two cities.',
        daily: { key: 'sg_far_daily', max: 1000, score: r => sum(r.scores) }
      },
      {
        id: 'number', name: 'Number Guess', path: 'number-guess/', status: 'live', icon: 'number',
        desc: 'How many bones in your body? How far to the Moon? Guess the number and get as close as you can. Five a day.',
        daily: { key: 'sg_number_daily', max: 1000, score: r => sum(r.scores) }
      },
      {
        // no daily block: Survival is endless only, so it stays out of Stats totals, the Archive and Today's total
        id: 'survival', name: 'Survival', path: 'survival/', status: 'live', icon: 'survival',
        desc: 'Size, weight, speed, distance and numbers, mixed and against the clock. Three lives. How long can you last?'
      }
    ],
    // Leaderboard (Supabase). Paste your project's URL and its anon / publishable key here.
    // Both are safe to publish: the database only accepts the two functions in supabase/schema.sql.
    // Leave them empty and the site works exactly as before, without the "you beat X%" line.
    leaderboard: { url: 'https://btboxrpehexlyptiwdyw.supabase.co', key: 'sb_publishable_HoLJ8Eet8BIk8XUKrTpl-Q_XUJNqBuc' },
    // Pages that are not games but belong in the menu
    pages: [
      { id: 'weekly', name: 'Weekly', path: 'weekly/' },
      { id: 'league', name: 'Leagues', path: 'league/' },
      { id: 'answers', name: 'Answers', path: 'answers/' },
      { id: 'archive', name: 'Archive', path: 'archive/' },
      { id: 'stats', name: 'Stats', path: 'stats/' }
    ]
  };
  function sum(a) { return (a || []).reduce((x, y) => x + y, 0); }

  const ROOT = document.documentElement.dataset.root || './';
  const NS = 'http://www.w3.org/2000/svg';

  // ---------- Storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  // ---------- Seeded random ----------
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(seed) {
    let a = hash(seed);
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randomSeed = () => Math.random().toString(36).slice(2, 10);

  // ---------- Dates ----------
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => dateKey(new Date());
  function dayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    const [ey, em, ed] = SITE.epoch.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000) + 1;
  }
  function untilMidnight() {
    const now = new Date();
    const mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  // Streak of consecutive finished days, from a {dateKey: {done}} record.
  // Puzzles replayed later from the Archive are marked `late`: they count as played, but not towards a streak.
  function streakInfo(rec) {
    const done = k => rec[k] && rec[k].done;
    const onTime = k => done(k) && !rec[k].late;
    const day = new Date();
    if (!onTime(dateKey(day))) day.setDate(day.getDate() - 1);
    let cur = 0;
    while (onTime(dateKey(day))) { cur++; day.setDate(day.getDate() - 1); }
    const keys = Object.keys(rec).filter(done).sort();
    let max = 0, run = 0, prev = null;
    for (const k of keys.filter(onTime)) {
      const n = dayNumber(k);
      run = prev !== null && n === prev + 1 ? run + 1 : 1;
      max = Math.max(max, run);
      prev = n;
    }
    return { cur, max, keys };
  }

  // ---------- Archive ----------
  // A game page opened with ?date=YYYY-MM-DD plays that past day's Daily instead of today's.
  let archiveDate = (() => {
    const d = new URLSearchParams(location.search).get('date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && dayNumber(d) >= 1 && d < todayKey() ? d : null;
  })();
  // Leave the archive (when the player switches mode): drop ?date from the address bar
  function leaveArchive() {
    if (!archiveDate) return;
    archiveDate = null;
    const q = new URLSearchParams(location.search); q.delete('date');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
    const b = document.getElementById('archiveBar'); if (b) b.remove();
  }
  // Spread into a saved Daily record: marks archive plays so they don't count towards streaks
  const lateFlag = () => archiveDate ? { late: true } : {};
  // Data added later carries `since: 'YYYY-MM-DD'`. It only joins puzzles from that day on,
  // so past Dailies (and the archive) stay exactly as they were played.
  const playDate = () => archiveDate || todayKey();
  const fresh = list => list.filter(x => !x.since || x.since <= playDate());
  function fmtDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Every day from the epoch up to yesterday, newest first
  function pastDays() {
    const out = [], day = new Date();
    day.setDate(day.getDate() - 1);
    while (dayNumber(dateKey(day)) >= 1) { out.push(dateKey(day)); day.setDate(day.getDate() - 1); }
    return out;
  }

  // ---------- Leaderboard ----------
  // After a Daily, send the score and show how it compares with everyone else who played that day.
  // Archive replays are never sent; they are only compared with that day's players.
  const board = (() => {
    const cfg = SITE.leaderboard || {};
    const on = !!(cfg.url && cfg.key);
    function deviceId() {
      let id = store.get('sg_device', '');
      if (!/^[0-9a-f-]{36}$/.test(id)) {
        id = crypto.randomUUID ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
        store.set('sg_device', id);
      }
      return id;
    }
    async function rpc(fn, body) {
      const headers = { 'Content-Type': 'application/json', apikey: cfg.key };
      if (cfg.key.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.key}`;   // older anon keys are JWTs
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
        if (!r.ok) throw new Error(`${fn}: ${r.status}`);
        return await r.json();
      } finally { clearTimeout(timer); }
    }
    function render(box, st, score, max, late) {
      const others = st.total - (late ? 0 : 1);
      if (others < 1) {
        box.innerHTML = late ? `<p class="lb-line">Nobody else played this Daily on the day.</p>`
          : `<p class="lb-line">🌍 You're one of the first to play today. Check back later to see how you compare.</p>`;
        return;
      }
      // ties count as half beaten
      const beaten = st.below + Math.max(0, st.equal - (late ? 0 : 1)) / 2;
      const pct = Math.round(beaten / others * 100);
      const mine = Math.min(9, Math.floor(score * 10 / max));
      const peak = Math.max(1, ...st.bins);
      box.innerHTML = `
        <p class="lb-line">🌍 ${late ? `On that day, you'd have beaten <b>${pct}%</b>` : `You beat <b>${pct}%</b>`} of ${others.toLocaleString('en')} ${others === 1 ? 'player' : 'players'}</p>
        <div class="lb-bars" aria-hidden="true">${st.bins.map((c, i) => `<i class="${i === mine ? 'me' : ''}" style="height:${(8 + c / peak * 92).toFixed(0)}%"></i>`).join('')}</div>
        <p class="lb-axis"><span>0</span><span>${max}</span></p>`;
    }
    // gameId: SITE.games id; date: the Daily's date; result: the result <section> to add the line to
    async function show(gameId, date, result) {
      if (location.hash === '#answers') return;   // loaded out of sight by the Answers page
      afterDaily(gameId, date, result);
      if (!on || !result) return;
      const g = SITE.games.find(x => x.id === gameId);
      const rec = g && g.daily && store.get(g.daily.key, {})[date];
      if (!rec || !rec.done) return;
      const score = g.daily.score(rec), late = !!rec.late || date !== todayKey();
      let box = result.querySelector('.lb');
      if (!box) {
        box = document.createElement('div');
        box.className = 'lb';
        const anchor = result.querySelector('.blocks') || result.querySelector('.total');
        anchor.after(box);
      }
      box.innerHTML = '<p class="lb-line lb-wait">Comparing with other players…</p>';
      const sent = store.get('sg_lb_sent', {}), k = `${gameId}:${date}`;
      try {
        const st = late || sent[k]
          ? await rpc('day_stats', { p_game: gameId, p_day: date, p_score: score })
          : await rpc('submit_score', { p_game: gameId, p_day: date, p_device: deviceId(), p_score: score });
        if (!late && !sent[k]) { sent[k] = 1; store.set('sg_lb_sent', sent); }
        render(box, st, score, g.daily.max, late);
      } catch {
        box.remove();   // offline or not set up: just leave the result as it was
      }
    }
    return { on, show, rpc, deviceId };
  })();

  // ---------- Region and units ----------
  // A best guess from the time zone, used only for defaults (units, which cities to show first). Nothing is sent.
  const region = (() => {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
    if (/^Asia\/(Kolkata|Calcutta)$/.test(tz)) return 'in';
    if (/^(America\/(New_York|Detroit|Chicago|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/.test(tz)) return 'us';
    return 'w';
  })();
  // Players in the US start in feet and pounds; everyone can switch with the units button
  let units = store.get('sg_units', region === 'us' ? 'imperial' : 'metric');
  const trimZero = s => s.replace(/\.0$/, '');
  function fmtLen(m) {
    if (units === 'imperial') {
      const inches = m / 0.0254;
      if (inches < 12) return trimZero(inches.toFixed(1)) + ' in';
      const ft = m / 0.3048;
      if (ft < 100) {
        let f = Math.floor(ft), i = Math.round((ft - f) * 12);
        if (i === 12) { f++; i = 0; }
        return i ? `${f} ft ${i} in` : `${f} ft`;
      }
      const mi = m / 1609.344;
      if (mi >= 10) return (mi < 100 ? trimZero(mi.toFixed(1)) : Math.round(mi).toLocaleString('en')) + ' miles';
      return Math.round(ft).toLocaleString('en') + ' ft';
    }
    if (m < 0.01) return trimZero((m * 1000).toFixed(1)) + ' mm';
    if (m < 1) { const cm = m * 100; return (cm < 10 ? trimZero(cm.toFixed(1)) : Math.round(cm)) + ' cm'; }
    if (m < 100) return trimZero(m.toFixed(1)) + ' m';
    if (m >= 10000) { const km = m / 1000; return (km < 100 ? trimZero(km.toFixed(1)) : Math.round(km).toLocaleString('en')) + ' km'; }
    return Math.round(m).toLocaleString('en') + ' m';
  }
  function fmtKg(kg) {
    if (units === 'imperial') {
      const lb = kg * 2.20462;
      if (lb < 1) return trimZero((lb * 16).toFixed(1)) + ' oz';
      if (lb < 2000) return (lb < 10 ? trimZero(lb.toFixed(1)) : Math.round(lb).toLocaleString('en')) + ' lb';
      const tons = lb / 2000;
      return (tons < 10 ? trimZero(tons.toFixed(1)) : Math.round(tons).toLocaleString('en')) + ' tons';
    }
    if (kg < 1) { const g = kg * 1000; return (g < 10 ? trimZero(g.toFixed(1)) : Math.round(g)) + ' g'; }
    if (kg < 1000) return (kg < 10 ? trimZero(kg.toFixed(1)) : Math.round(kg).toLocaleString('en')) + ' kg';
    const t = kg / 1000;
    return (t < 10 ? trimZero(t.toFixed(1)) : Math.round(t).toLocaleString('en')) + ' t';
  }
  const unitListeners = [];
  function toggleUnits() {
    units = units === 'metric' ? 'imperial' : 'metric';
    store.set('sg_units', units);
    unitListeners.forEach(f => f(units));
  }

  // ---------- Shapes ----------
  let BBOX = null;
  function measureShapes(list) {
    if (BBOX) return BBOX;
    BBOX = {};
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden');
    document.body.appendChild(svg);
    for (const o of list) {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = o.svg;
      svg.appendChild(g);
      const b = g.getBBox();
      BBOX[o.id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    }
    svg.remove();
    return BBOX;
  }
  // A standalone <svg> for an object, cropped to its drawing
  function shapeSvg(o, cls) {
    const b = BBOX[o.id];
    const p = Math.max(b.w, b.h) * 0.02;
    return `<svg class="${cls || ''}" viewBox="${b.x - p} ${b.y - p} ${b.w + 2 * p} ${b.h + 2 * p}" aria-hidden="true">${o.svg}</svg>`;
  }

  // Box in metres for an object whose main dimension is `size`
  function boxOf(o, size = o.size) {
    const b = BBOX[o.id];
    return o.dim === 'h' ? { w: size * b.w / b.h, h: size } : { w: size, h: size * b.h / b.w };
  }

  // Objects standing side by side at true relative scale, as an SVG string.
  // items: [{ o, cls, label }]
  function lineup(items, opt = {}) {
    const W = opt.w || 600, H = opt.h || 260, pad = opt.pad ?? 16, gap = opt.gap ?? 16;
    const below = (opt.labels ? 30 : 0) + (opt.ruler ? 26 : 0);
    const boxes = items.map(it => boxOf(it.o));
    const sumW = boxes.reduce((a, b) => a + b.w, 0);
    const maxH = Math.max(...boxes.map(b => b.h));
    const s = Math.min((H - 2 * pad - below - (opt.top || 0)) / maxH, (W - 2 * pad - gap * (items.length - 1)) / sumW);
    const ground = H - pad - below;
    let x = (W - (sumW * s + gap * (items.length - 1))) / 2;
    let lastEnd = -Infinity, row = 0;
    let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.aria || items.map(i => i.o.name).join(', '))}">`;
    items.forEach((it, i) => {
      const bx = boxes[i], b = BBOX[it.o.id];
      const k = (bx.w * s) / b.w;
      out += `<g class="pfig ${it.cls || ''}" style="animation-delay:${(i * 0.09).toFixed(2)}s"><g transform="translate(${x.toFixed(1)} ${(ground - bx.h * s).toFixed(1)}) scale(${k.toFixed(4)}) translate(${-b.x} ${-b.y})">${it.o.svg}</g></g>`;
      if (opt.labels) {
        // drop a label to a second row when it would collide with the previous one
        const label = it.label || it.o.name, cx = x + bx.w * s / 2, half = label.length * 3.3;
        row = cx - half < lastEnd + 4 && row === 0 ? 1 : 0;
        if (row === 0) lastEnd = cx + half;
        out += `<text x="${cx.toFixed(1)}" y="${ground + 14 + row * 11}" text-anchor="middle" font-size="11" font-weight="800" fill="var(--muted)">${esc(label)}</text>`;
      }
      x += bx.w * s + gap;
    });
    out += `<line x1="0" x2="${W}" y1="${ground}" y2="${ground}" stroke="var(--edge)" stroke-width="2.5"/>`;
    if (opt.ruler) {
      const ry = ground + (opt.labels ? 36 : 6);
      const stepM = [1, 2, 5, 10, 20, 50, 100][[1, 2, 5, 10, 20, 50, 100].findIndex(m => m * s >= 34)] || 100;
      out += `<line x1="${pad}" x2="${W - pad}" y1="${ry}" y2="${ry}" stroke="var(--muted)" stroke-width="1.5"/>`;
      for (let m = 0, px = pad; px <= W - pad + 0.1; m += stepM, px = pad + m * s) {
        out += `<line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${ry}" y2="${ry - 6}" stroke="var(--muted)" stroke-width="1.5"/>`;
        out += `<text x="${px.toFixed(1)}" y="${ry + 12}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--muted)">${m} m</text>`;
      }
    }
    return out + '</svg>';
  }

  // ---------- Object names in sentences ----------
  // "the giraffe", "the Eiffel Tower", "Robert Wadlow": lowercase common nouns, keep proper ones
  const PROPER_START = /^(Boeing|Indian|A4|Titanic|T\. rex|Bengal|Asian|Mona Lisa|Statue|Eiffel|Big Ben)/;
  const isPerson = o => o.id === 'wadlow';
  const COMMON_IN_LANDMARKS = new Set(['coconut']);   // filed under landmarks, but not a name
  // Objects can also say so themselves: proper (keep the capital), one (one of a kind), bare (no "the")
  const isProper = o => isPerson(o) || o.proper || (['landmarks', 'famous'].includes(o.cat) && !COMMON_IN_LANDMARKS.has(o.id)) || PROPER_START.test(o.name);
  const isOne = o => o.one || ['landmarks', 'famous'].includes(o.cat) || o.id === 'titanic';
  const shortName = o => isPerson(o) ? o.name.split(',')[0] : o.name.replace(/ \(.*\)$/, '');
  const noun = o => { const n = shortName(o); return isProper(o) ? n : n.charAt(0).toLowerCase() + n.slice(1); };
  const theNoun = o => isPerson(o) || o.bare ? shortName(o) : 'the ' + noun(o);
  function weightFact(o, w) {
    if (isPerson(o)) return `${shortName(o)} weighed about ${w}.`;
    if (isOne(o)) return `${o.bare ? '' : 'The '}${shortName(o)} weighs about ${w}.`;
    return `A typical ${noun(o)} weighs about ${w}.`;
  }

  // ---------- UI helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- Share sheet ----------
  // WhatsApp first (most players are in India), then X, Telegram, Copy, and the phone's own share menu.
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
    catch { window.prompt('Copy this:', text); }
  }
  function share(text) {
    let dlg = document.getElementById('shareDlg');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'shareDlg'; dlg.className = 'share-dlg';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    }
    const m = text.match(/\s*(https?:\/\/\S+)\s*$/);
    const link = m ? m[1] : '', body = m ? text.slice(0, m.index) : text;
    const enc = encodeURIComponent;
    dlg.innerHTML = `<h2>Share with friends</h2>
      <pre class="share-preview">${esc(text)}</pre>
      <div class="share-grid">
        <a class="sh sh-wa" data-sh="whatsapp" href="https://wa.me/?text=${enc(text)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.6c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.7c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.3 14.3 0 0 0 5.5 4.8c2 .9 2.8 1 3.8.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg>WhatsApp</a>
        <a class="sh" data-sh="x" href="https://twitter.com/intent/tweet?text=${enc(text)}" target="_blank" rel="noopener"><b>𝕏</b>Post</a>
        <a class="sh" data-sh="telegram" href="https://t.me/share/url?url=${enc(link)}&text=${enc(body)}" target="_blank" rel="noopener"><b>✈️</b>Telegram</a>
        <button class="sh" type="button" data-sh="copy"><b>📋</b>Copy</button>
        ${navigator.share ? '<button class="sh" type="button" data-sh="more"><b>⋯</b>More</button>' : ''}
      </div>
      <form method="dialog"><button class="secondary">Close</button></form>`;
    dlg.querySelectorAll('[data-sh]').forEach(b => b.addEventListener('click', async e => {
      const how = b.dataset.sh;
      track('share', { how, page: location.pathname });
      if (how === 'copy') { e.preventDefault(); await copyText(text); dlg.close(); }
      else if (how === 'more') { e.preventDefault(); dlg.close(); try { await navigator.share({ text }); } catch { /* cancelled */ } }
      else setTimeout(() => dlg.close(), 300);
    }));
    dlg.showModal();
  }
  // ---------- Activity log ----------
  // Page views, finished games, shares and league actions go to log_events() in Supabase (supabase/schema.sql),
  // for the owner's admin page at /admin/. Each event carries the random device id, a session id (new after
  // 30 idle minutes) and an "OS · browser · device type" label. No names, IP addresses or locations are sent;
  // the country comes from Cloudflare on the server. Events are batched and sent at most every few seconds.
  // Not sent from localhost (set localStorage sg_log_local to true to test), or for the Answers page's hidden games.
  const activity = (() => {
    const cfg = SITE.leaderboard || {};
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !store.get('sg_log_local', false);
    const on = !!(cfg.url && cfg.key) && location.hash !== '#answers' && location.protocol !== 'file:' && !local;
    const queue = [];
    let timer = 0;
    function session() {
      const now = Date.now();
      let s = store.get('sg_session', null);
      if (!s || typeof s.id !== 'string' || now - s.t > 30 * 60 * 1000) s = { id: now.toString(36) + Math.random().toString(36).slice(2, 10) };
      s.t = now;
      store.set('sg_session', s);
      return s.id;
    }
    const platform = (() => {
      const ua = navigator.userAgent || '';
      const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      const os = /Android/i.test(ua) ? 'Android' : ipad || /iPhone|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
        : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
      const br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung'
        : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
      const kind = ipad || /Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua)) ? 'tablet' : /Mobi|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop';
      let app = false;
      try { app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { /* ignore */ }
      return `${os} · ${br} · ${kind}${app ? ' · app' : ''}`;
    })();
    function flush() {
      clearTimeout(timer); timer = 0;
      while (queue.length) {
        const body = JSON.stringify({ p_device: board.deviceId(), p_session: session(), p_platform: platform, p_events: queue.splice(0, 20) });
        const headers = { 'Content-Type': 'application/json', apikey: cfg.key };
        if (cfg.key.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.key}`;
        // keepalive lets the last events of a page still arrive after the player has moved on
        try { fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/log_events`, { method: 'POST', headers, body, keepalive: true }).catch(() => {}); } catch { /* ignore */ }
      }
    }
    // e: event name (a-z, 0-9, _); f: { g: game, m: mode, s: score, r: referrer host, d: { anything small } }
    function log(e, f = {}) {
      if (!on) return;
      queue.push({ e, p: location.pathname, ...f });
      if (queue.length >= 20) flush();
      else if (!timer) timer = setTimeout(flush, e === 'page_view' ? 1500 : 4000);
    }
    if (on) {
      addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      const q = new URLSearchParams(location.search), d = {};
      let r = '';
      try { const u = new URL(document.referrer); if (u.host !== location.host) r = u.host.replace(/^www\./, ''); } catch { /* no referrer */ }
      if (q.get('utm_source')) d.src = q.get('utm_source').slice(0, 40);
      if (q.get('vs')) d.vs = 1;
      if (q.get('mode')) d.mode = q.get('mode').slice(0, 20);
      log('page_view', { r, d });
    }
    // Every game calls vsResult() when a game ends, so that is where finished games are logged.
    let last = '';
    function gameEnd(ctx, score) {
      const page = SITE.games.find(g => location.pathname.includes('/' + g.path));
      const game = page ? page.id : location.pathname.includes('/weekly/') ? 'weekly' : '';
      let mode = (ctx && ctx.mode) || '';
      if (mode === 'daily' && (archiveDate || (ctx.date && ctx.date !== todayKey()))) mode = 'archive';
      const key = `${game}|${mode}|${score}|${Math.floor(Date.now() / 5000)}`;   // the same result shown twice in a row is one game
      if (!game || key === last) return;
      last = key;
      const d = {};
      if (ctx.date && (mode === 'daily' || mode === 'archive')) d.day = ctx.date;
      if (vsFor(ctx)) d.vs = 1;
      log('game_end', { g: game, m: mode, s: Math.round(Number(score) || 0), d });
    }
    return { on, log, gameEnd, flush };
  })();
  // Shares, random challenges and league actions: logged for the admin page, and passed to window.sgTrack if a page defines it
  function track(name, data) {
    activity.log(String(name).toLowerCase(), { d: data || {} });
    try { if (typeof window.sgTrack === 'function') window.sgTrack(name, data || {}); } catch { /* ignore */ }
  }

  // ---------- Challenge links ----------
  // Every shared result is a challenge. The link carries the score (and name, if given), and the friend who
  // opens it plays the same puzzles: the same day's Daily (?date=), or the same seeded run (?mode=&s=).
  // Size It Up and Number Guess also keep their older ?c= links, which they read themselves.
  const vs = (() => {
    const q = new URLSearchParams(location.search);
    const n = parseInt(q.get('vs'), 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return {
      vs: Math.min(n, 1e6),
      by: (q.get('by') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20),
      mode: (q.get('mode') || 'daily').replace(/[^a-z]/g, '').slice(0, 12),
      seed: (q.get('s') || '').replace(/[^\w-]/g, '').slice(0, 40),
      date: /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : todayKey()
    };
  })();
  // The challenge, if it is the one being played now: same mode, and the same day (Daily) or seed (other modes).
  // A friend who switches mode or starts a fresh run is no longer playing it.
  const vsFor = ({ mode, seed, date }) => vs && !new URLSearchParams(location.search).get('c') && vs.mode === mode &&
    (mode === 'daily' ? (date || todayKey()) === vs.date : (seed || '') === vs.seed) ? vs : null;
  function challengeUrl({ mode = 'daily', date, seed, score }) {
    const q = new URLSearchParams();
    if (mode === 'daily') q.set('date', date || todayKey());
    else { q.set('mode', mode); if (seed) q.set('s', seed); }
    q.set('vs', String(score));
    const by = store.get('sg_name', '').trim().slice(0, 20);
    if (by) q.set('by', by);
    return `${location.origin}${location.pathname}?${q}`;
  }
  // What every Share button sends: headline, emoji blocks, a hook, then the challenge link
  const challengeText = (head, blocks, link) => `${head}${blocks ? '\n' + blocks : ''}\nCan you beat me? 👇\n${link}`;
  // Banner above the game while a friend's challenge is being played. Call again whenever a new game starts.
  // ctx: { mode, seed, date } of the game now on screen
  function vsBanner(ctx, of = '') {
    let b = document.getElementById('vsBanner');
    const c = vsFor(ctx);
    if (!c) { if (b) b.hidden = true; return; }
    if (!b) {
      b = document.createElement('div');
      b.className = 'banner vs-banner'; b.id = 'vsBanner';
      const hero = document.querySelector('main .ghero');
      hero ? hero.after(b) : document.querySelector('main').prepend(b);
    }
    b.hidden = false;
    b.innerHTML = `⚔️ <b>${esc(c.by || 'A friend')}</b> scored <b>${c.vs}${esc(of)}</b>${c.seed || c.mode === 'daily' ? ' on these exact puzzles' : ''}. Can you beat it?`;
  }
  // On the result screen: who won
  function vsResult(resultEl, ctx, mine) {
    activity.gameEnd(ctx || {}, mine);
    let line = resultEl.querySelector('.vs-line');
    const c = vsFor(ctx);
    if (!c) { if (line) line.hidden = true; return; }
    if (!line) {
      line = document.createElement('div');
      line.className = 'vs vs-line';
      const at = resultEl.querySelector('.blocks') || resultEl.querySelector('.total') || resultEl.firstElementChild;
      at.after(line);
    }
    line.hidden = false;
    const by = esc(c.by || 'Your friend');
    line.innerHTML = `You: ${mine} · ${by}: ${c.vs}<br>${mine > c.vs ? 'You win! 🎉 Share it back and make them try again.' : mine < c.vs ? `${by} wins this time.` : "It's a tie!"}`;
  }
  // A name field above every Share button, so challenge links say who sent them
  function addNameBoxes() {
    document.querySelectorAll('.result #shareBtn').forEach(btn => {
      const res = btn.closest('.result');
      if (res.querySelector('#nameInput')) return;
      const box = document.createElement('div');
      box.className = 'challenge-box name-box';
      box.innerHTML = '<input type="text" id="nameInput" maxlength="20" autocomplete="nickname" placeholder="Your name (shown to friends)" aria-label="Your name">';
      (btn.closest('.actions') || btn).before(box);
    });
    document.querySelectorAll('#nameInput').forEach(i => { if (!i.value) i.value = store.get('sg_name', ''); });
  }
  document.addEventListener('input', e => { if (e.target && e.target.id === 'nameInput') store.set('sg_name', e.target.value.trim().slice(0, 20)); });

  // ---------- First-visit intro ----------
  // Three quick steps, shown once per game, so a friend arriving from a shared link knows what to do.
  const HOWTO = {
    'how-big': [['👀', 'The <b class="c-ref">grey</b> thing is drawn at its real size.'], ['↔️', 'Drag or slide to resize the <b class="c-guess">orange</b> one until it looks right.'], ['🎯', 'Lock in and see the true size. Within 5% scores full points.']],
    heavier: [['⚖️', 'Two things sit on a scale. You know the weight of one.'], ['👆', 'Is the other one <b>heavier</b> or <b>lighter</b>? Tap your answer.'], ['🔥', 'Ten a day. In Endless, one wrong answer ends your streak.']],
    sort: [['🧩', 'You get five things, all mixed up.'], ['👆', 'Tap them in order, smallest (or lightest) first.'], ['📏', 'Check your order and see them lined up at true scale.']],
    ballpark: [['❓', 'Each question has a number for an answer.'], ['🎯', 'Skip the exact number: just pick the range it falls in.'], ['⭐', 'Exact range scores 3, one off scores 1. Ten a day.']],
    speed: [['🏁', 'Two racers line up: animals, vehicles, people.'], ['👆', 'Tap the faster one, then guess by how much.'], ['💨', 'Then watch them race at their true speeds.']],
    fit: [['📦', 'One thing, and a much bigger thing.'], ['🔢', 'Guess how many of the small one fit along the big one.'], ['🎯', 'Lock in and watch them line up. Closer scores more.']],
    far: [['📍', 'Two cities on a map.'], ['📏', 'Slide or type how far apart they are, in a straight line.'], ['🎯', 'Lock in. Within 5% scores full points.']],
    number: [['❓', 'Each question has a real-world number for an answer.'], ['🎚️', 'Slide, tap − and +, or type your guess (1.5k and 3 million work).'], ['🎯', 'Lock in. Within 5% scores full points.']]
  };
  function intro(id) {
    const steps = HOWTO[id];
    if (!steps || location.hash === '#answers' || window.top !== window || store.get('sg_intro_' + id, false)) return;
    store.set('sg_intro_' + id, true);
    const g = SITE.games.find(x => x.id === id);
    const dlg = document.createElement('dialog');
    dlg.className = 'intro-dlg';
    dlg.innerHTML = `<div class="kicker">How to play</div><h2>${esc(g ? g.name : '')}</h2>
      <ol class="intro-steps">${steps.map(([e, t], i) => `<li style="--d:${i * 0.7}s"><span class="ie">${e}</span><span>${t}</span></li>`).join('')}</ol>
      <div class="intro-bar"><i></i></div>
      <form method="dialog"><button class="primary big">Let's play →</button></form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  const ICONS = {
    size: '<rect x="3" y="14" width="9" height="15" rx="2" class="l-ref"/><rect x="15" y="4" width="14" height="25" rx="2" class="l-guess"/>',
    weight: '<path d="M16 4v4M6 8h20M6 8l-4 10h8L6 8Zm20 0-4 10h8l-4-10ZM10 28h12" class="l-stroke"/><circle cx="16" cy="6" r="2" class="l-guess"/>',
    sort: '<rect x="3" y="20" width="5" height="9" rx="1" class="l-ref"/><rect x="10" y="15" width="5" height="14" rx="1" class="l-ref"/><rect x="17" y="10" width="5" height="19" rx="1" class="l-ref"/><rect x="24" y="4" width="5" height="25" rx="1" class="l-guess"/>',
    speed: '<path d="M3 10h14M6 16h16M3 22h12" class="l-stroke"/><circle cx="25" cy="16" r="5" class="l-guess"/>',
    ballpark: '<rect x="2" y="10" width="7" height="12" rx="2" class="l-ref"/><rect x="12.5" y="10" width="7" height="12" rx="2" class="l-guess"/><rect x="23" y="10" width="7" height="12" rx="2" class="l-ref"/>',
    fit: '<rect x="2" y="20" width="28" height="8" rx="2" class="l-guess"/><rect x="3" y="11" width="7" height="7" rx="1.5" class="l-ref"/><rect x="12.5" y="11" width="7" height="7" rx="1.5" class="l-ref"/><rect x="22" y="11" width="7" height="7" rx="1.5" class="l-ref"/>',
    far: '<circle cx="7" cy="23" r="4" class="l-ref"/><circle cx="25" cy="9" r="4" class="l-guess"/><path d="M10 20 22 12" class="l-stroke" stroke-dasharray="3 3"/>',
    number: '<rect x="3" y="5" width="26" height="22" rx="4" class="l-ref"/><text x="16" y="22" text-anchor="middle" font-size="14" font-weight="800" class="l-text">42</text>',
    survival: '<path d="M16 28 C6 21 2 15 2 10 a6.5 6.5 0 0 1 14 -2 a6.5 6.5 0 0 1 14 2 c0 5 -4 11 -14 18Z" class="l-guess"/><path d="M8 14h4l2-4 3 8 2-4h5" class="l-stroke"/>'
  };
  const icon = (name, cls) => `<svg class="${cls || ''}" viewBox="0 0 32 32" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // Shared header: brand, game links, and a #tools slot for the page
  function header(activeId) {
    const live = SITE.games.filter(g => g.status === 'live');
    const active = live.find(g => g.id === activeId);
    const menu = live.map(g => `<a class="gm-item${g.id === activeId ? ' active' : ''}" href="${ROOT}${g.path}">${icon(g.icon, 'gm-icon')}${esc(g.name)}</a>`).join('');
    const pages = SITE.pages.map(p => `<a class="glink${p.id === activeId ? ' active' : ''}" href="${ROOT}${p.path}">${esc(p.name)}</a>`).join('');
    const h = document.createElement('header');
    h.className = 'top';
    h.innerHTML = `
      <div class="top-in">
        <a class="brand" href="${ROOT}">
          <span class="logo">${logo()}</span>
          <span class="name">${esc(SITE.name)}</span>
        </a>
        <nav class="glinks" aria-label="Site">
          <details class="gmenu"><summary class="glink${active ? ' active' : ''}">${active ? esc(active.name) : 'Games'}</summary><div class="gm-list">${menu}<a class="gm-item gm-random" href="${ROOT}categories/">🗂️ Play by category</a><a class="gm-item gm-random" href="${ROOT}" data-random>🎲 Random Challenge</a><a class="gm-item gm-all" href="${ROOT}">All games →</a></div></details>
          ${pages}
        </nav>
        <div class="tools" id="tools"></div>
      </div>
      <div class="ruler"></div>`;
    document.body.prepend(h);
    // close the games menu on outside click or Escape
    const dm = h.querySelector('.gmenu');
    document.addEventListener('click', e => { if (dm.open && !dm.contains(e.target)) dm.open = false; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') dm.open = false; });
    if (archiveDate) {
      const bar = document.createElement('div');
      bar.className = 'archive-bar'; bar.id = 'archiveBar';
      bar.innerHTML = `<span>📅 Archive: playing the Daily from <b>${esc(fmtDate(archiveDate))}</b> (#${dayNumber(archiveDate)}). It won't count towards your streak.</span>
        <a href="${location.pathname}">Back to today</a>`;
      h.after(bar);
    }
    if (HOWTO[activeId]) {
      const show = () => setTimeout(() => intro(activeId), 0);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
    }
    const f = document.createElement('footer');
    f.className = 'foot';
    const gameLinks = live.map(g => `<a href="${ROOT}${g.path}">${esc(g.name)}</a>`).join('');
    const pageLinks = SITE.pages.map(p => `<a href="${ROOT}${p.path}">${esc(p.name)}</a>`).join('');
    f.innerHTML = `<div class="ruler"></div><div class="foot-in">
      <div><span class="name">${esc(SITE.name)}</span><br>${esc(SITE.tagline)}</div>
      <div class="foot-links">${gameLinks}<br>${pageLinks}<a href="${ROOT}">All games</a><a href="${ROOT}suggest/">Suggest an object</a><br><a href="${ROOT}about/">About us</a><a href="${ROOT}contact/">Contact</a><a href="${ROOT}privacy/">Privacy</a><a href="${ROOT}terms/">Terms</a><br>© 2026 ${esc(SITE.name)}</div>
    </div>`;
    document.body.appendChild(f);
  }

  // Brand mark: three bars of growing height, like a size chart
  function logo() {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="11" fill="var(--text)"/>
      <rect x="8" y="23" width="6" height="9" rx="1.5" fill="var(--bg)"/><rect x="17" y="16" width="6" height="16" rx="1.5" fill="var(--bg)"/>
      <rect x="26" y="8" width="6" height="24" rx="1.5" fill="var(--guess)"/></svg>`;
  }

  function confetti(n = 70) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#ff7a1a', '#ffd166', '#12a150', '#e83f6f', '#3a3f73', '#5aa9ff'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      p.style.animationDelay = Math.random() * 0.4 + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  // Five-band rank for a score out of 1000
  function rankFor(score, max) {
    const f = score / max;
    if (f >= 0.9) return 'Scale Master';
    if (f >= 0.75) return 'Sharp Eye';
    if (f >= 0.55) return 'Good Guesser';
    if (f >= 0.35) return 'Getting There';
    return 'Keep Practising';
  }

  function unitButton() {
    const b = document.createElement('button');
    b.className = 'icon';
    b.title = 'Switch units';
    const label = () => { b.textContent = units === 'metric' ? 'kg·m' : 'lb·ft'; };
    label();
    b.addEventListener('click', toggleUnits);
    unitListeners.push(label);
    return b;
  }

  // ---------- Facts with sources ----------
  // Writes a fact into an element, with a small "Source" link when the data has `src` (an https URL)
  function setFact(node, text, src) {
    node.textContent = text;
    if (src && /^https:\/\//.test(src)) {
      const a = document.createElement('a');
      a.className = 'src'; a.href = src; a.target = '_blank'; a.rel = 'noopener nofollow'; a.textContent = 'Source';
      node.append(' ', a);
    }
  }

  // ---------- Today's total ----------
  // Every Daily counts for up to 100 points, so 8 games make a total out of 800
  const dailyGames = () => SITE.games.filter(g => g.status === 'live' && g.daily);
  function todayTotal(day = todayKey()) {
    const rows = dailyGames().map(g => {
      const r = store.get(g.daily.key, {})[day], done = !!(r && r.done);
      return { g, done, pts: done ? Math.round(g.daily.score(r) / g.daily.max * 100) : 0 };
    });
    return { day, rows, total: sum(rows.map(x => x.pts)), max: rows.length * 100, done: rows.filter(x => x.done).length, count: rows.length };
  }
  const totalBlock = x => !x.done ? '⬜' : x.pts >= 80 ? '🟩' : x.pts >= 55 ? '🟨' : x.pts >= 30 ? '🟧' : '🟥';
  function totalShareText(t = todayTotal()) {
    return challengeText(`${SITE.name} · Daily #${dayNumber(t.day)} total: ${t.total}/${t.max}`, `${t.rows.map(totalBlock).join('')} (${t.done}/${t.count} games)`, new URL(ROOT, location.href).href);
  }
  function totalCard(t = todayTotal()) {
    return {
      game: "Today's total", kicker: `Daily #${dayNumber(t.day)} · ${fmtDate(t.day)}`, score: String(t.total), of: `/${t.max}`,
      rank: t.done === t.count ? rankFor(t.total, t.max) : `${t.done} of ${t.count} games played`,
      rows: t.rows.map(x => [`${totalBlock(x)} ${x.g.name}`, x.done ? `${x.pts}` : '–'])
    };
  }
  // A compact panel: score, one chip per game, share buttons. Used on the home page and the Stats page.
  function renderTotal(box) {
    const t = todayTotal();
    const next = t.rows.find(x => !x.done);
    box.innerHTML = `
      <div class="tt-head">
        <div class="tt-ring" style="--p:${(t.total / t.max * 100).toFixed(1)}" aria-hidden="true"><span>${t.done}/${t.count}</span></div>
        <div><div class="kicker">Today's total · Daily #${dayNumber(t.day)}</div>
          <div class="tt-score"><b>${t.total}</b><span>/${t.max}</span></div>
          <div class="tt-sub">${t.done === t.count ? `All ${t.count} done. ${esc(rankFor(t.total, t.max))}!` : `${t.done} of ${t.count} played${next ? ` · next up: <a href="${ROOT}${next.g.path}">${esc(next.g.name)} →</a>` : ''}`}</div></div>
        <div class="tt-actions">${t.done ? `<button class="primary" data-tt="text">Share total</button><button class="secondary" data-tt="img">📸 Image</button>` : `<a class="primary" href="${ROOT}${next.g.path}">Start playing →</a>`}</div>
      </div>
      <div class="tt-bar" aria-hidden="true"><i style="width:${(t.total / t.max * 100).toFixed(1)}%"></i></div>
      <div class="tt-games">${t.rows.map(x => `<a class="tt-g ${x.done ? 'done' : ''}" href="${ROOT}${x.g.path}" title="${esc(x.g.name)}">${icon(x.g.icon, 'gm-icon')}<span>${esc(x.g.name)}</span><b>${x.done ? x.pts : 'Play'}</b></a>`).join('')}</div>`;
    box.querySelectorAll('[data-tt]').forEach(b => b.addEventListener('click', () =>
      b.dataset.tt === 'text' ? share(totalShareText(t)) : shareCard(totalCard(t), totalShareText(t))));
  }
  // After a Daily: show how today's total stands and which game to play next
  function afterDaily(gameId, date, result) {
    checkBadges();
    if (!result || date !== todayKey() || archiveDate) return;
    const t = todayTotal(), next = t.rows.find(x => !x.done);
    let line = result.querySelector('.tt-next');
    if (!line) { line = document.createElement('p'); line.className = 'tt-next'; (result.querySelector('.actions') || result.lastElementChild).before(line); }
    line.innerHTML = `Today's total: <b>${t.total}/${t.max}</b> · ${t.done} of ${t.count} played` +
      (next ? ` · <a href="${ROOT}${next.g.path}">Next: ${esc(next.g.name)} →</a>` : ` · <a href="${ROOT}stats/">See your day →</a>`);
    // Friends Leagues: send members to their standings, and everyone else to start one
    if (board.on && !result.querySelector('.lg-next')) {
      const mine = myLeagues(), a = document.createElement('a');
      a.className = 'lg-next';
      a.href = `${ROOT}league/${mine.length === 1 ? '?code=' + encodeURIComponent(mine[0].code) : ''}`;
      a.innerHTML = mine.length ? `🏆 See where you stand in ${mine.length === 1 ? esc(mine[0].name) : 'your leagues'} →` : '🏆 Start a league with your WhatsApp group →';
      line.after(a);
    }
  }
  // Leagues this browser has joined: [{ code, name }]. The server is the source of truth for members and points.
  const myLeagues = () => store.get('sg_leagues', []).filter(l => l && /^[A-Z0-9]{6}$/.test(l.code));

  // ---------- Random Challenge ----------
  // A random game in a non-Daily mode, so there's always something new to play
  const RANDOM_MODES = {
    'how-big': '?mode=unlimited', heavier: '?mode=endless', sort: '?mode=unlimited', ballpark: '?mode=rush',
    speed: '?mode=endless', fit: '?mode=unlimited', far: '?mode=unlimited', number: '?mode=unlimited', survival: ''
  };
  function randomGameUrl() {
    const here = SITE.games.find(g => location.pathname.includes('/' + g.path));
    const pool = SITE.games.filter(g => g.status === 'live' && g.id in RANDOM_MODES && g !== here);
    const g = pool[Math.floor(Math.random() * pool.length)];
    return `${ROOT}${g.path}${RANDOM_MODES[g.id]}`;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-random]');
    if (!a) return;
    e.preventDefault();
    track('random', { from: location.pathname });
    location.href = randomGameUrl();
  });

  // ---------- Badges ----------
  // Worked out from what's saved in this browser. Earned dates are kept so a badge only pops up once.
  const BADGES = [
    { id: 'first', icon: '🎯', name: 'First guess', desc: 'Finish your first Daily.' },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Finish the Daily of every game at least once.' },
    { id: 'fullhouse', icon: '🏆', name: 'Full house', desc: 'Finish every Daily on the same day.' },
    { id: 'streak3', icon: '🔥', name: 'On a roll', desc: 'Play a Daily 3 days in a row.' },
    { id: 'streak7', icon: '📅', name: 'Week warrior', desc: 'Play a Daily 7 days in a row.' },
    { id: 'streak30', icon: '💎', name: 'Habit formed', desc: 'Play a Daily 30 days in a row.' },
    { id: 'allround7', icon: '👑', name: 'All-rounder', desc: 'Finish every Daily, 7 days in a row.' },
    { id: 'perfect', icon: '💯', name: 'Perfect', desc: 'Get full marks on any Daily.' },
    { id: 'master10', icon: '🎖️', name: 'Scale Master ×10', desc: 'Score 90% or more on 10 Dailies.' },
    { id: 'total600', icon: '🚀', name: '600 club', desc: "Reach 600 in one day's total." },
    { id: 'century', icon: '🏛️', name: 'Centurion', desc: 'Finish 100 Dailies.' },
    { id: 'weekly', icon: '🗓️', name: 'Weekly regular', desc: 'Finish a Weekly Challenge.' },
    { id: 'archive', icon: '⏳', name: 'Time traveller', desc: 'Play a past Daily from the archive.' },
    { id: 'survive10', icon: '❤️', name: 'Survivor', desc: 'Reach 10 in Survival.' },
    { id: 'survive25', icon: '🛡️', name: 'Unbreakable', desc: 'Reach 25 in Survival.' }
  ];
  function badgeProgress() {
    const games = dailyGames();
    const recs = games.map(g => ({ g, rec: store.get(g.daily.key, {}) }));
    const done = recs.flatMap(({ g, rec }) => Object.entries(rec).filter(([, r]) => r && r.done).map(([day, r]) => ({ g, day, r, pct: g.daily.score(r) / g.daily.max })));
    const onTime = (day, every) => (every ? recs.every : recs.some).call(recs, ({ rec }) => rec[day] && rec[day].done && !rec[day].late);
    const run = every => {   // longest run of consecutive days
      const days = [...new Set(done.map(d => d.day))].filter(d => onTime(d, every)).map(dayNumber).sort((a, b) => a - b);
      let best = 0, cur = 0;
      days.forEach((n, i) => { cur = i && n === days[i - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); });
      return best;
    };
    const anyRun = run(false), allRun = run(true);
    const perDay = {};
    done.forEach(d => { perDay[d.day] = (perDay[d.day] || 0) + Math.round(d.pct * 100); });
    const surv = store.get('sg_survival_best', 0);
    return {
      first: done.length >= 1, explorer: games.every(g => done.some(d => d.g === g)),
      fullhouse: allRun >= 1, streak3: anyRun >= 3, streak7: anyRun >= 7, streak30: anyRun >= 30, allround7: allRun >= 7,
      perfect: done.some(d => d.pct >= 1), master10: done.filter(d => d.pct >= 0.9).length >= 10,
      total600: Object.values(perDay).some(v => v >= 600), century: done.length >= 100,
      weekly: Object.values(store.get('sg_weekly', {})).some(w => w && w.done), archive: done.some(d => d.r.late),
      survive10: surv >= 10, survive25: surv >= 25
    };
  }
  function checkBadges() {
    const got = store.get('sg_badges', {}), now = badgeProgress(), added = [];
    for (const b of BADGES) if (now[b.id] && !got[b.id]) { got[b.id] = todayKey(); added.push(b); }
    if (added.length) {
      store.set('sg_badges', got);
      toast(added.length === 1 ? `${added[0].icon} Badge unlocked: ${added[0].name}` : `🏅 ${added.length} badges unlocked!`);
    }
    return got;
  }

  // ---------- Share image ----------
  // A 1080×1350 PNG of a result, for WhatsApp, Instagram and friends.
  // c: { game, kicker, score, of, rank, blocks, rows: [[left, right]], note }
  async function drawCard(c) {
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const F = (w, s) => `${w} ${s}px "Bricolage Grotesque", system-ui, sans-serif`;
    try { await Promise.all([document.fonts.load(F(800, 60)), document.fonts.load(F(600, 40))]); } catch { /* system font */ }
    const bg = '#1b1740', ink = '#f5f2ff', muted = '#a9a3c9', orange = '#ff7a1a';
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    // ruler ticks along the top and bottom, like the site header
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i <= W; i += 27) { const h = i % 135 === 0 ? 34 : 16; x.fillRect(i, 0, 3, h); x.fillRect(i, H - h, 3, h); }
    // brand mark and name
    const bx = 80, by = 92;
    x.fillStyle = ink; roundRect(x, bx, by, 84, 84, 24); x.fill();
    x.fillStyle = bg; x.fillRect(bx + 17, by + 50, 13, 20); x.fillRect(bx + 36, by + 35, 13, 35);
    x.fillStyle = orange; x.fillRect(bx + 55, by + 17, 13, 53);
    x.fillStyle = ink; x.font = F(800, 46); x.textBaseline = 'middle'; x.fillText(SITE.name, bx + 110, by + 44);
    // panel
    const px = 64, py = 230, pw = W - 128, ph = H - 400;
    x.fillStyle = '#0b0920'; roundRect(x, px + 12, py + 12, pw, ph, 44); x.fill();
    x.fillStyle = '#221d4a'; roundRect(x, px, py, pw, ph, 44); x.fill();
    x.textAlign = 'center';
    let y = py + 90;
    x.fillStyle = orange; x.font = F(800, 58); x.fillText(c.game || '', W / 2, y); y += 70;
    x.fillStyle = muted; x.font = F(600, 36); x.fillText(c.kicker || '', W / 2, y); y += 150;
    // the big score
    x.font = F(800, 210); const sw = x.measureText(c.score || '').width;
    x.font = F(700, 80); const ow = x.measureText(c.of || '').width;
    let sx = W / 2 - (sw + ow) / 2;
    x.textAlign = 'left'; x.fillStyle = ink; x.font = F(800, 210); x.fillText(c.score || '', sx, y);
    x.fillStyle = muted; x.font = F(700, 80); x.fillText(c.of || '', sx + sw + 8, y + 30);
    x.textAlign = 'center'; y += 140;
    if (c.rank) { x.fillStyle = '#3ddc84'; x.font = F(800, 54); x.fillText(c.rank, W / 2, y); y += 90; }
    if (c.blocks) {
      x.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      const chars = [...c.blocks.replace(/\s+/g, '')], per = 10;
      for (let i = 0; i < chars.length && i < 30; i += per) { x.fillText(chars.slice(i, i + per).join(''), W / 2, y); y += 84; }
      y += 10;
    }
    if (c.rows && c.rows.length) {
      x.font = F(600, 34);
      for (const [l, r] of c.rows.slice(0, 9)) {
        x.textAlign = 'left'; x.fillStyle = ink; x.fillText(l, px + 90, y);
        x.textAlign = 'right'; x.fillStyle = orange; x.fillText(r, px + pw - 90, y);
        y += 50;
      }
      x.textAlign = 'center';
    }
    if (c.note) { x.fillStyle = muted; x.font = F(600, 34); x.fillText(c.note, W / 2, Math.min(y + 20, py + ph - 50)); }
    // footer
    x.fillStyle = ink; x.font = F(800, 44); x.fillText('Can you beat it?', W / 2, H - 120);
    x.fillStyle = muted; x.font = F(600, 32); x.fillText(location.host || SITE.name, W / 2, H - 70);
    return cv;
  }
  function roundRect(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  async function shareCard(c, text) {
    try {
      const cv = await drawCard(c);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const name = `${(c.game || 'score').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Image saved');
    } catch { toast("Couldn't make the image"); }
  }
  // Read a finished result screen (every game uses the same ids) into a card
  function cardFromResult(res) {
    const t = id => { const n = res.querySelector('#' + id); return n ? n.textContent.trim() : ''; };
    const page = SITE.games.find(g => location.pathname.includes('/' + g.path));
    const total = res.querySelector('.total');
    const of = t('resOf') || (total && total.querySelector('span') ? total.querySelector('span').textContent.trim() : '');
    const lb = res.querySelector('.lb-line:not(.lb-wait)');
    return {
      game: page ? page.name : (document.querySelector('h1') || {}).textContent || SITE.name,
      kicker: t('resKicker') || t('resTitle'), score: t('resTotal'), of, rank: t('resRank'),
      blocks: t('resBlocks'), note: lb ? lb.textContent.replace(/^🌍\s*/, '') : ''
    };
  }
  // Every result screen gets a "Save image" button next to its Share button
  function addImageButtons() {
    document.querySelectorAll('.result #shareBtn').forEach(btn => {
      if (btn.nextElementSibling && btn.nextElementSibling.classList.contains('img-btn')) return;
      const b = document.createElement('button');
      b.className = 'secondary img-btn'; b.type = 'button'; b.textContent = '📸 Save image';
      b.addEventListener('click', () => { const res = btn.closest('.result'); shareCard(cardFromResult(res), document.title); });
      btn.after(b);
    });
  }
  const decorateResults = () => { addImageButtons(); addNameBoxes(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorateResults); else decorateResults();
  window.addEventListener('load', () => checkBadges());

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(ROOT + 'sw.js').catch(() => {});
  }

  window.SG = {
    SITE, ROOT, store, rng, randomSeed, hash, dateKey, todayKey, dayNumber, untilMidnight, streakInfo,
    get archiveDate() { return archiveDate; }, leaveArchive, lateFlag, fmtDate, pastDays, board,
    fmtLen, fmtKg, get units() { return units; }, onUnits: f => unitListeners.push(f), unitButton,
    measureShapes, shapeSvg, boxOf, lineup, noun, theNoun, weightFact, isOne, isProper, esc, toast, share, copyText, track,
    vs, vsFor, challengeUrl, myLeagues, randomGameUrl, challengeText, vsBanner, vsResult, intro, icon, header, logo, confetti, rankFor,
    region, playDate, fresh, setFact, todayTotal, renderTotal, totalShareText, BADGES, badgeProgress, checkBadges, shareCard, drawCard
  };
})();

// Lean stand-in for assets/common.js, used only by the CrazyGames build.
// It offers the same window.SG helpers that size-it-up/game.js calls, but has no header links, no leaderboard,
// no analytics, no service worker and no share links, because CrazyGames does not allow outside links or tracking.
(() => {
  'use strict';

  const SITE = {
    name: 'Size It Up',
    epoch: '2026-11-01',
    games: [{ id: 'how-big', name: 'Size It Up', path: 'size-it-up/', status: 'live' }]
  };
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
  // Objects added later carry `since: 'YYYY-MM-DD'` and only join puzzles from that day on
  const fresh = list => list.filter(x => !x.since || x.since <= todayKey());
  function untilMidnight() {
    const now = new Date();
    const mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
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

  // ---------- Units ----------
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
  const isUS = /^(America\/(New_York|Detroit|Chicago|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/.test(tz);
  let units = store.get('sg_units', isUS ? 'imperial' : 'metric');
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
  const unitListeners = [];
  function toggleUnits() {
    units = units === 'metric' ? 'imperial' : 'metric';
    store.set('sg_units', units);
    unitListeners.forEach(f => f(units));
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

  // ---------- Object names in sentences ----------
  const PROPER_START = /^(Boeing|Indian|A4|Titanic|T\. rex|Bengal|Asian|Mona Lisa|Statue|Eiffel|Big Ben)/;
  const isPerson = o => o.id === 'wadlow';
  const COMMON_IN_LANDMARKS = new Set(['coconut']);
  const isProper = o => isPerson(o) || o.proper || (['landmarks', 'famous'].includes(o.cat) && !COMMON_IN_LANDMARKS.has(o.id)) || PROPER_START.test(o.name);
  const shortName = o => isPerson(o) ? o.name.split(',')[0] : o.name.replace(/ \(.*\)$/, '');
  const noun = o => { const n = shortName(o); return isProper(o) ? n : n.charAt(0).toLowerCase() + n.slice(1); };
  const theNoun = o => isPerson(o) || o.bare ? shortName(o) : 'the ' + noun(o);

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
  // "Share" only copies the result text. No social links: CrazyGames does not allow outside links.
  async function share(text) {
    try { await navigator.clipboard.writeText(text); toast('Result copied'); }
    catch { toast('Could not copy'); }
  }
  // Facts show plain text only: no "Source" link
  function setFact(node, text) { node.textContent = text; }

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

  function rankFor(score, max) {
    const f = score / max;
    if (f >= 0.9) return 'Scale Master';
    if (f >= 0.75) return 'Sharp Eye';
    if (f >= 0.55) return 'Good Guesser';
    if (f >= 0.35) return 'Getting There';
    return 'Keep Practising';
  }

  // ---------- Header and first-visit intro ----------
  function logo() {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="11" fill="var(--text)"/>
      <rect x="8" y="23" width="6" height="9" rx="1.5" fill="var(--bg)"/><rect x="17" y="16" width="6" height="16" rx="1.5" fill="var(--bg)"/>
      <rect x="26" y="8" width="6" height="24" rx="1.5" fill="var(--guess)"/></svg>`;
  }
  const STEPS = [
    ['👀', 'The <b class="c-ref">grey</b> thing is drawn at its real size.'],
    ['↔️', 'Drag or slide to resize the <b class="c-guess">orange</b> one until it looks right.'],
    ['🎯', 'Lock in and see the true size. Within 5% scores full points.']
  ];
  function intro() {
    if (store.get('sg_intro_how-big', false)) return;
    store.set('sg_intro_how-big', true);
    const dlg = document.createElement('dialog');
    dlg.className = 'intro-dlg';
    dlg.innerHTML = `<div class="kicker">How to play</div><h2>Size It Up</h2>
      <ol class="intro-steps">${STEPS.map(([e, t], i) => `<li style="--d:${i * 0.7}s"><span class="ie">${e}</span><span>${t}</span></li>`).join('')}</ol>
      <div class="intro-bar"><i></i></div>
      <form method="dialog"><button class="primary big">Let's play →</button></form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
  function header() {
    const h = document.createElement('header');
    h.className = 'top';
    h.innerHTML = `<div class="top-in">
        <span class="brand"><span class="logo">${logo()}</span><span class="name">${esc(SITE.name)}</span></span>
        <div class="tools" id="tools"></div>
      </div><div class="ruler"></div>`;
    document.body.prepend(h);
    setTimeout(intro, 0);
  }

  const noop = () => {};
  window.SG = {
    SITE, fresh, store, rng, randomSeed, hash, dateKey, todayKey, dayNumber, untilMidnight, streakInfo,
    archiveDate: null, leaveArchive: noop, lateFlag: () => ({}), board: { on: false, show: noop },
    fmtLen, onUnits: f => unitListeners.push(f), unitButton,
    measureShapes, noun, theNoun, esc, toast, share, setFact, confetti, rankFor, header,
    challengeUrl: () => '', challengeText: (head, blocks) => `${head}${blocks ? '\n' + blocks : ''}`,
    vsBanner: noop, vsResult: noop
  };
})();

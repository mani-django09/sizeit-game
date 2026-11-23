(() => {
  'use strict';
  const { store, rng, dateKey, todayKey, esc, share, fmtLen, fmtKg, fmtDate } = SG;

  const ROUNDS = 10;
  const KEY = 'sg_weekly';
  const MIN_RATIO = 1.3;

  SG.header('weekly');
  SG.measureShapes(OBJECTS);

  // ---------- Themes ----------
  // Each week gets one theme, in this order, forever. objects/numbers/racers say what the rounds may use.
  const THEMES = [
    { id: 'india', name: 'India Week', emoji: '🇮🇳', blurb: 'Monuments, cricket, autos and tigers.',
      objects: ['qutub', 'indiagate', 'unity', 'taj', 'gateway', 'auto', 'coin', 'bat', 'pitch', 'cball', 'tiger', 'peacock', 'cobra', 'elephant', 'coconut'],
      numbers: ['india'], racers: ['vande', 'auto', 'tiger', 'elephant', 'scooter', 'cyclist', 'walker', 'horse'] },
    { id: 'space', name: 'Space Week', emoji: '🚀', blurb: 'Planets, light, orbits and the speed of sound.',
      objects: [], numbers: ['space'], racers: ['iss', 'orbit', 'spin', 'sound', 'concorde', 'b747', 'falcon', 'f1'] },
    { id: 'animals', name: 'Animal Week', emoji: '🐾', blurb: 'Whales, cheetahs, cobras and snails.',
      objects: OBJECTS.filter(o => o.cat === 'animals').map(o => o.id), numbers: ['nature'],
      racers: ['snail', 'tortoise', 'mamba', 'elephant', 'cat', 'giraffe', 'tiger', 'horse', 'cheetah', 'falcon'] },
    { id: 'builds', name: 'Big Builds Week', emoji: '🏗️', blurb: 'Towers, statues, ships and jumbo jets.',
      objects: [...OBJECTS.filter(o => o.cat === 'landmarks' || o.cat === 'famous').map(o => o.id).filter(id => !['monalisa', 'wadlow'].includes(id)), 'b747', 'titanic', 'coach', 'bus'],
      numbers: ['world'], racers: ['titanic', 'vande', 'f1', 'b747', 'concorde', 'scooter', 'auto'] },
    { id: 'sports', name: 'Sports Week', emoji: '🏏', blurb: 'Bats, balls, pitches and the fastest people alive.',
      objects: [...OBJECTS.filter(o => o.cat === 'sports').map(o => o.id), 'human', 'wadlow'],
      numbers: ['sports'], racers: ['bolt', 'horse', 'cyclist', 'f1', 'walker', 'cheetah'] },
    { id: 'everyday', name: 'Everyday Week', emoji: '🏠', blurb: 'Phones, doors, bodies and the maths of a day.',
      objects: [...OBJECTS.filter(o => o.cat === 'everyday').map(o => o.id), 'monalisa', 'car', 'scooter', 'cat'],
      numbers: ['body', 'everyday'], racers: ['walker', 'cyclist', 'cat', 'scooter', 'auto', 'snail'] }
  ];

  // Weeks start on Monday. Week 0 is the week of 3 Nov 2025; the theme order rolls on from there.
  function weekStart(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  const REF = new Date(2025, 10, 3);
  const weekIndex = ws => Math.round((ws - REF) / (7 * 86400000));
  const themeFor = ws => THEMES[((weekIndex(ws) % THEMES.length) + THEMES.length) % THEMES.length];

  // ---------- Round builders ----------
  const O = id => OBJECTS.find(o => o.id === id);
  const R = id => RACERS.find(o => o.id === id);
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const ratio = (x, y) => Math.max(x / y, y / x);
  const nf = v => Number(v.toPrecision(4)).toLocaleString('en');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const BIG = { h: 'taller', l: 'longer', d: 'wider' };

  // two items far enough apart; each item may appear in at most two rounds a week
  let seen = {};
  function pairRound(r, pool, val, minR) {
    for (let g = 0; g < 400; g++) {
      const a = pick(r, pool), b = pick(r, pool);
      if (a === b || ratio(val(a), val(b)) < minR || (seen[a.id] || 0) >= 2 || (seen[b.id] || 0) >= 2) continue;
      seen[a.id] = (seen[a.id] || 0) + 1; seen[b.id] = (seen[b.id] || 0) + 1;
      return r() < 0.5 ? [a, b] : [b, a];
    }
    return null;
  }
  const BUILD = {
    size(r, th) {
      const objs = th.objects.map(O).filter(Boolean);
      const dims = ['h', 'l', 'd'].filter(d => objs.filter(o => o.dim === d).length >= 2);
      if (!dims.length) return null;
      const dim = pick(r, dims);   // both things must be measured the same way
      const p = pairRound(r, objs.filter(o => o.dim === dim), o => o.size, MIN_RATIO);
      if (!p) return null;
      const word = BIG[p[0].dim];
      return { type: 'size', q: `Which is ${word}?`, options: p.map(o => cap(SG.theNoun(o))),
        answer: p[0].size > p[1].size ? 0 : 1, values: p.map(o => fmtLen(o.size)),
        fact: `${cap(SG.theNoun(p[0].size > p[1].size ? p[0] : p[1]))} is about ${ratio(p[0].size, p[1].size).toFixed(1)}× ${word}.` };
    },
    weight(r, th) {
      const objs = th.objects.map(O).filter(o => o && o.kg);
      const p = pairRound(r, objs, o => o.kg, MIN_RATIO);
      if (!p) return null;
      const w = p[0].kg > p[1].kg ? 0 : 1, rr = ratio(p[0].kg, p[1].kg);
      return { type: 'weight', q: 'Which is heavier?', options: p.map(o => cap(SG.theNoun(o))), answer: w, values: p.map(o => fmtKg(o.kg)),
        fact: `${cap(SG.theNoun(p[w]))} is about ${rr < 10 ? rr.toFixed(1) : Number(rr.toPrecision(2)).toLocaleString('en')}× heavier.` };
    },
    speed(r, th) {
      const p = pairRound(r, th.racers.map(R).filter(Boolean), o => o.kmh, MIN_RATIO);
      if (!p) return null;
      const w = p[0].kmh > p[1].kmh ? 0 : 1, kmh = v => `${v < 1 ? v : Math.round(v).toLocaleString('en')} km/h`;
      return { type: 'speed', q: 'Which is faster?', options: p.map(o => cap(o.as)), answer: w, values: p.map(o => kmh(o.kmh)), fact: p[w].fact, src: p[w].src };
    },
    range(r, th, used) {
      const qs = QUESTIONS.filter(q => th.numbers.includes(q.cat) && !used.has(q.id));
      if (!qs.length) return null;
      const q = pick(r, qs);
      used.add(q.id);
      const k = Math.floor(Math.log10(q.a) + 1e-9);
      const start = Math.max(0, k - Math.floor(r() * 4));
      const ks = [0, 1, 2, 3].map(i => start + i);
      return { type: 'range', q: q.q, options: ks.map(rangeLabel), answer: ks.indexOf(k), values: null,
        exact: `${nf(q.a)}${q.unit ? ' ' + q.unit : ''}`, fact: q.fact, src: q.src };
    }
  };
  function rangeLabel(k) {
    const S = ['', 'k', 'M', 'B', 'T'];
    if (k <= 2) return `${Math.pow(10, k)}–${Math.pow(10, k + 1) - 1}`;
    if (k === 3) return '1,000–9,999';
    if (k <= 14) return `${Math.pow(10, k % 3)}${S[Math.floor(k / 3)]}–${['9.9', '99', '999'][k % 3]}${S[Math.floor(k / 3)]}`;
    return `10^${k}–10^${k + 1}`;
  }
  function makeRounds(seed, th) {
    const r = rng(seed), used = new Set(), out = [];
    seen = {};
    // round types come in shuffled groups of four, so every kind appears and none dominates
    const seq = [];
    while (seq.length < 200) {
      const t = ['size', 'weight', 'speed', 'range'];
      for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
      seq.push(...t);
    }
    for (const t of seq) {
      if (out.length >= ROUNDS) break;
      const rd = BUILD[t](r, th, used);
      // avoid asking the exact same pair twice
      if (rd && !out.some(x => x.q === rd.q && x.options.join() === rd.options.join())) out.push(rd);
    }
    return out;
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), progress: $('progress'), scoreLine: $('scoreLine'), prompt: $('prompt'),
    theme: $('theme'), kind: $('kind'), options: $('options'), reveal: $('reveal'), verdict: $('verdict'), detail: $('detail'), fact: $('fact'),
    nextBtn: $('nextBtn'), dots: $('dots'), resTitle: $('resTitle'), resRank: $('resRank'), resTotal: $('resTotal'), resBlocks: $('resBlocks'),
    resNote: $('resNote'), shareBtn: $('shareBtn'), countdown: $('countdown'), upcoming: $('upcoming')
  };
  const KIND = { size: '📏 Size', weight: '⚖️ Weight', speed: '🏁 Speed', range: '🔢 Ballpark' };

  // ---------- State ----------
  const ws = weekStart(), wkey = dateKey(ws), theme = themeFor(ws);
  const S = { rounds: makeRounds('weekly-' + wkey, theme), i: 0, answers: [], phase: 'ask' };
  const loadAll = () => store.get(KEY, {});

  function renderTheme() {
    const end = new Date(ws); end.setDate(end.getDate() + 6);
    el.theme.innerHTML = `<span class="wk-emoji">${theme.emoji}</span><div><b>${esc(theme.name)}</b><span>${esc(theme.blurb)} · ${esc(fmtDate(wkey))} to ${esc(fmtDate(dateKey(end)))}</span></div>`;
    const next = new Date(ws); next.setDate(next.getDate() + 7);
    const nt = themeFor(next);
    el.upcoming.innerHTML = `Next week: <b>${nt.emoji} ${esc(nt.name)}</b>, starting ${esc(fmtDate(dateKey(next)))}.`;
  }

  function ask() {
    S.phase = 'ask';
    const rd = S.rounds[S.i];
    el.kind.textContent = KIND[rd.type];
    el.prompt.textContent = rd.q;
    el.options.className = `wk-options ${rd.options.length > 2 ? 'four' : 'two'}`;
    el.options.innerHTML = rd.options.map((o, i) => `<button class="wk-opt" data-i="${i}"><span class="bp-key">${i + 1}</span><span class="wk-label">${esc(o)}</span></button>`).join('');
    el.reveal.hidden = true;
    renderMeta();
  }
  function choose(i) {
    if (S.phase !== 'ask') return;
    S.phase = 'reveal';
    const rd = S.rounds[S.i], ok = i === rd.answer;
    S.answers.push(ok);
    const all = loadAll();
    all[wkey] = { answers: S.answers.slice(), done: S.answers.length >= S.rounds.length, theme: theme.id };
    store.set(KEY, all);
    el.options.querySelectorAll('.wk-opt').forEach((b, j) => {
      b.disabled = true;
      if (j === rd.answer) b.classList.add('ok'); else if (j === i) b.classList.add('no');
      if (rd.values) b.insertAdjacentHTML('beforeend', `<span class="wk-val">${esc(rd.values[j])}</span>`);
    });
    el.verdict.textContent = ok ? 'Correct!' : 'Not quite';
    el.verdict.style.color = ok ? 'var(--true)' : 'var(--bad)';
    el.detail.innerHTML = rd.type === 'range' ? `The answer is <b>${esc(rd.exact)}</b>.` : '';
    SG.setFact(el.fact, rd.fact, rd.src);
    el.nextBtn.textContent = S.answers.length >= S.rounds.length ? 'See result' : 'Next →';
    el.reveal.hidden = false;
    renderMeta();
    el.nextBtn.focus({ preventScroll: true });
  }
  function next() {
    if (S.phase !== 'reveal') return;
    S.i++;
    if (S.i >= S.rounds.length) showResult(); else ask();
  }
  function renderMeta() {
    el.progress.textContent = `Round ${Math.min(S.answers.length + (S.phase === 'ask' ? 1 : 0), S.rounds.length)} of ${S.rounds.length}`;
    el.scoreLine.innerHTML = `<b>${S.answers.filter(Boolean).length}</b> / ${S.rounds.length}`;
    el.dots.innerHTML = S.rounds.map((_, i) => `<i class="${S.answers[i] == null ? '' : S.answers[i] ? 'ok' : 'no'}"></i>`).join('');
  }
  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    const right = S.answers.filter(Boolean).length;
    el.resTitle.textContent = `${theme.emoji} ${theme.name}`;
    el.resRank.textContent = SG.rankFor(right, S.rounds.length);
    el.resTotal.textContent = right;
    el.resBlocks.textContent = S.answers.map(a => a ? '🟩' : '🟥').join('');
    const weeks = Object.values(loadAll()).filter(w => w.done);
    el.resNote.textContent = `You've finished ${weeks.length} weekly ${weeks.length === 1 ? 'challenge' : 'challenges'}.`;
    if (right >= 9) SG.confetti();
    SG.vsResult(el.result, { mode: 'week', seed: wkey }, right);
    SG.checkBadges();
    tick();
  }
  function tick() {
    const next = new Date(ws); next.setDate(next.getDate() + 7);
    const s = Math.max(0, Math.floor((next - new Date()) / 1000));
    const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
    el.countdown.textContent = `Next challenge in ${d ? d + 'd ' : ''}${h}h ${m}m`;
    if (s === 0) location.reload();
  }
  setInterval(tick, 30000);

  el.options.addEventListener('click', e => { const b = e.target.closest('.wk-opt'); if (b) choose(+b.dataset.i); });
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => {
    const right = S.answers.filter(Boolean).length;
    share(SG.challengeText(`${SG.SITE.name} Weekly · ${theme.emoji} ${theme.name}: ${right}/${S.rounds.length}`, S.answers.map(a => a ? '🟩' : '🟥').join(''),
      SG.challengeUrl({ mode: 'week', seed: wkey, score: right })));
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (S.phase === 'ask' && n >= 1 && n <= S.rounds[S.i].options.length) { e.preventDefault(); choose(n - 1); }
    else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
  });

  // ---------- Boot: resume or show the finished result ----------
  renderTheme();
  SG.vsBanner({ mode: 'week', seed: wkey }, `/${S.rounds.length}`);
  const rec = loadAll()[wkey];
  if (rec) { S.answers = rec.answers.slice(); S.i = S.answers.length; }
  if (rec && rec.done) showResult(); else ask();
  window.__weekly = { S, THEMES, themeFor, weekStart, makeRounds };
})();

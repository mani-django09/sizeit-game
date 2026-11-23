(() => {
  'use strict';
  const { store, esc, share, fmtLen, fmtKg } = SG;

  const LIVES = 3;
  const BEST_KEY = 'sg_survival_best';
  const RUNS_KEY = 'sg_survival_runs';

  SG.header('survival');
  SG.measureShapes(OBJECTS);

  // ---------- Helpers ----------
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const ratio = (x, y) => Math.max(x / y, y / x);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const nf = v => Number(v.toPrecision(3)).toLocaleString('en');
  const times = r => r < 10 ? r.toFixed(1) : Number(r.toPrecision(2)).toLocaleString('en');
  const BIG = { h: 'taller', l: 'longer', d: 'wider' };
  const R_EARTH = 6371, rad = d => d * Math.PI / 180;
  function distKm(a, b) {
    const p = rad(b.lat - a.lat), q = rad(b.lon - a.lon);
    const h = Math.sin(p / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(q / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.sqrt(h));
  }
  const fmtKm = km => SG.units === 'imperial' ? `${nf(km * 0.621371)} miles` : `${nf(km)} km`;
  const kmh = v => SG.units === 'imperial' ? `${v < 1 ? (v * 0.621371).toFixed(2) : nf(v * 0.621371)} mph` : `${v < 1 ? v : nf(v)} km/h`;

  // ---------- Questions ----------
  // Every question is a choice between two. `gap` is how far apart the two values must be:
  // it starts wide and narrows as the run goes on, so later questions are closer calls.
  function twoApart(pool, val, gap, recent) {
    for (let g = 0; g < 600; g++) {
      const a = pick(pool), b = pick(pool);
      if (a === b || recent.has(a.id) || recent.has(b.id)) continue;
      const r = ratio(val(a), val(b));
      if (r >= gap && r <= gap * 6) return [a, b];
    }
    return null;
  }
  const BUILD = {
    size(gap, recent) {
      const dim = pick(['h', 'l', 'd']);
      const p = twoApart(OBJECTS.filter(o => o.dim === dim), o => o.size, gap, recent);
      if (!p) return null;
      const w = p[0].size > p[1].size ? 0 : 1;
      return { kind: '📏 Size', q: `Which is ${BIG[dim]}?`, options: p.map(o => cap(SG.theNoun(o))), answer: w, values: p.map(o => fmtLen(o.size)),
        ids: p.map(o => o.id), fact: `${cap(SG.theNoun(p[w]))} is about ${times(ratio(p[0].size, p[1].size))}× ${BIG[dim]}.`, src: p[w].src };
    },
    weight(gap, recent) {
      const p = twoApart(OBJECTS.filter(o => o.kg), o => o.kg, gap, recent);
      if (!p) return null;
      const w = p[0].kg > p[1].kg ? 0 : 1;
      return { kind: '⚖️ Weight', q: 'Which is heavier?', options: p.map(o => cap(SG.theNoun(o))), answer: w, values: p.map(o => fmtKg(o.kg)),
        ids: p.map(o => o.id), fact: `${cap(SG.theNoun(p[w]))} is about ${times(ratio(p[0].kg, p[1].kg))}× heavier.`, src: p[w].src };
    },
    speed(gap, recent) {
      const p = twoApart(RACERS, o => o.kmh, gap, recent);
      if (!p) return null;
      const w = p[0].kmh > p[1].kmh ? 0 : 1;
      return { kind: '🏁 Speed', q: 'Which is faster?', options: p.map(o => cap(o.as)), answer: w, values: p.map(o => kmh(o.kmh)),
        ids: p.map(o => 'r-' + o.id), fact: p[w].fact, src: p[w].src };
    },
    far(gap) {
      // two city pairs: which two are farther apart?
      const mk = () => { const a = pick(CITIES); let b = pick(CITIES); while (b === a) b = pick(CITIES); return { a, b, km: distKm(a, b) }; };
      for (let g = 0; g < 400; g++) {
        const p = [mk(), mk()];
        const r = ratio(p[0].km, p[1].km);
        if (p[0].km < 150 || p[1].km < 150 || r < gap || r > gap * 6) continue;
        const w = p[0].km > p[1].km ? 0 : 1;
        return { kind: '🗺️ Distance', q: 'Which two cities are farther apart, as the crow flies?', options: p.map(x => `${x.a.name} – ${x.b.name}`),
          answer: w, values: p.map(x => fmtKm(x.km)), ids: [], fact: `${p[w].a.name} to ${p[w].b.name} is about ${times(r)}× as far.` };
      }
      return null;
    },
    number(gap, recent) {
      const qs = QUESTIONS.filter(q => !recent.has('q-' + q.id));
      if (!qs.length) return null;
      const q = pick(qs);
      // the line to beat is a "gap" away from the true answer, above or below it
      const up = Math.random() < 0.5, f = gap * (1 + Math.random() * 0.6);
      let line = up ? q.a * f : q.a / f;
      line = Number(line.toPrecision(2));
      if (q.int) line = Math.max(1, Math.round(line));
      if (line === q.a) return null;
      const unit = q.unit ? ' ' + q.unit : '';
      return { kind: '🔢 Number', q: q.q, options: [`More than ${nf(line)}${unit}`, `Less than ${nf(line)}${unit}`], answer: q.a > line ? 0 : 1,
        values: null, ids: ['q-' + q.id], exact: `${nf(q.a)}${unit}`, fact: q.fact, src: q.src };
    }
  };
  const KINDS = Object.keys(BUILD);
  const gapFor = n => Math.max(1.25, 3.2 - n * 0.09);        // 3.2× apart at the start, 1.25× by question 22
  const secondsFor = n => Math.max(7, 14 - Math.floor(n / 4)); // 14 s at the start, 7 s from question 28

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    start: $('start'), startBtn: $('startBtn'), bestLine: $('bestLine'),
    game: $('game'), lives: $('lives'), kind: $('kind'), scoreLine: $('scoreLine'), timer: $('timer'), timerBar: $('timerBar'),
    prompt: $('prompt'), options: $('options'), reveal: $('reveal'), verdict: $('verdict'), detail: $('detail'), fact: $('fact'), nextBtn: $('nextBtn'),
    result: $('result'), resTitle: $('resTitle'), resRank: $('resRank'), resTotal: $('resTotal'), resBlocks: $('resBlocks'), resNote: $('resNote'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn')
  };
  $('tools').append(SG.unitButton());

  // ---------- State ----------
  const S = { lives: LIVES, score: 0, n: 0, log: [], rd: null, phase: 'idle', recent: new Set(), kinds: [], deadline: 0, raf: 0 };

  function begin() {
    Object.assign(S, { lives: LIVES, score: 0, n: 0, log: [], phase: 'ask', recent: new Set(), kinds: [] });
    el.start.hidden = true; el.result.hidden = true; el.game.hidden = false;
    store.set(RUNS_KEY, store.get(RUNS_KEY, 0) + 1);
    ask();
  }
  function nextKind() {
    // shuffled groups of all five kinds, so every kind keeps turning up
    if (!S.kinds.length) { S.kinds = KINDS.slice(); for (let i = S.kinds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S.kinds[i], S.kinds[j]] = [S.kinds[j], S.kinds[i]]; } }
    return S.kinds.pop();
  }
  function ask() {
    let rd = null;
    for (let g = 0; !rd && g < 20; g++) rd = BUILD[nextKind()](gapFor(S.n), S.recent);
    if (!rd) { S.recent.clear(); rd = BUILD.weight(1.5, S.recent); }
    rd.ids.forEach(id => S.recent.add(id));
    if (S.recent.size > 40) S.recent = new Set([...S.recent].slice(-30));
    S.rd = rd; S.phase = 'ask';
    el.kind.textContent = rd.kind;
    el.prompt.textContent = rd.q;
    el.options.className = 'wk-options two';
    el.options.innerHTML = rd.options.map((o, i) => `<button class="wk-opt" data-i="${i}"><span class="bp-key">${i + 1}</span><span>${esc(o)}</span></button>`).join('');
    el.reveal.hidden = true;
    renderMeta();
    const secs = secondsFor(S.n);
    S.deadline = performance.now() + secs * 1000;
    S.total = secs * 1000;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(tickTimer);
  }
  function tickTimer(t) {
    if (S.phase !== 'ask') return;
    const left = Math.max(0, S.deadline - t);
    el.timerBar.style.transform = `scaleX(${(left / S.total).toFixed(3)})`;
    el.timer.classList.toggle('low', left < 3000);
    if (left <= 0) return choose(-1);
    S.raf = requestAnimationFrame(tickTimer);
  }
  function choose(i) {
    if (S.phase !== 'ask') return;
    S.phase = 'reveal';
    cancelAnimationFrame(S.raf);
    const rd = S.rd, ok = i === rd.answer;
    S.n++;
    if (ok) S.score++; else S.lives--;
    S.log.push(ok ? '🟩' : i < 0 ? '⏱️' : '🟥');
    el.options.querySelectorAll('.wk-opt').forEach((b, j) => {
      b.disabled = true;
      if (j === rd.answer) b.classList.add('ok'); else if (j === i) b.classList.add('no');
      if (rd.values) b.insertAdjacentHTML('beforeend', `<span class="wk-val">${esc(rd.values[j])}</span>`);
    });
    el.verdict.textContent = ok ? 'Correct!' : i < 0 ? 'Time\'s up' : 'Not quite';
    el.verdict.style.color = ok ? 'var(--true)' : 'var(--bad)';
    el.detail.innerHTML = rd.exact ? `The answer is <b>${esc(rd.exact)}</b>.` : '';
    SG.setFact(el.fact, rd.fact, rd.src);
    el.nextBtn.textContent = S.lives > 0 ? 'Next →' : 'See result';
    el.reveal.hidden = false;
    renderMeta();
    if (ok && S.score % 10 === 0) SG.confetti(40);
    el.nextBtn.focus({ preventScroll: true });
  }
  function next() {
    if (S.phase !== 'reveal') return;
    if (S.lives <= 0) showResult(); else ask();
  }
  function renderMeta() {
    el.lives.textContent = '❤️'.repeat(S.lives) + '🖤'.repeat(LIVES - S.lives);
    el.lives.setAttribute('aria-label', `${S.lives} of ${LIVES} lives left`);
    el.scoreLine.innerHTML = `<b>${S.score}</b> · best ${store.get(BEST_KEY, 0)}`;
  }
  function rankOf(n) {
    return n >= 40 ? 'Legendary' : n >= 25 ? 'Unbreakable' : n >= 15 ? 'Sharp Eye' : n >= 10 ? 'Survivor' : n >= 5 ? 'Getting There' : 'Keep Practising';
  }
  function showResult() {
    S.phase = 'done';
    const prev = store.get(BEST_KEY, 0), best = Math.max(prev, S.score);
    store.set(BEST_KEY, best);
    el.game.hidden = true; el.result.hidden = false;
    el.resTitle.textContent = 'Survival';
    el.resRank.textContent = S.score > prev && S.score > 0 ? `New best! ${rankOf(S.score)}` : rankOf(S.score);
    el.resTotal.textContent = S.score;
    el.resBlocks.textContent = S.log.slice(-30).join('');
    el.resNote.textContent = `${S.n} questions · best ${best} · ${store.get(RUNS_KEY, 0)} runs`;
    if (S.score > prev && S.score >= 5) SG.confetti();
    SG.vsResult(el.result, { mode: 'run' }, S.score);
    SG.checkBadges();
  }
  const shareText = () => SG.challengeText(`${SG.SITE.name} Survival: ${S.score} correct before running out of lives ❤️`, S.log.slice(-30).join(''), SG.challengeUrl({ mode: 'run', score: S.score }));

  // ---------- Input ----------
  el.startBtn.addEventListener('click', begin);
  el.againBtn.addEventListener('click', begin);
  el.options.addEventListener('click', e => { const b = e.target.closest('.wk-opt'); if (b) choose(+b.dataset.i); });
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.phase === 'ask' && (e.key === '1' || e.key === '2')) { e.preventDefault(); choose(+e.key - 1); }
    else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
    else if (S.phase === 'idle' && e.key === 'Enter') { e.preventDefault(); begin(); }
  });
  SG.onUnits(() => { if (S.phase !== 'idle') renderMeta(); });

  const best = store.get(BEST_KEY, 0);
  el.bestLine.textContent = best ? `Your best: ${best}` : '';
  SG.vsBanner({ mode: 'run' }, ' correct');
  window.__survival = { S, BUILD, gapFor, secondsFor };
})();

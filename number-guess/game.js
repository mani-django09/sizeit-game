(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, esc, share } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'number');
  const ROUNDS = 5;
  const MAX_PER_ROUND = 200;
  const FULL_MARKS = Math.log(1.05);   // within 5% = full points
  const ZERO_MARKS = Math.log(5);      // 5x off = zero
  const SPAN = 3;                      // decades either side of the answer on the slider
  const KEY = 'sg_number_daily';
  const STEPS = 1000;

  SG.header('number');

  // ---------- Questions and scoring ----------
  function makeRounds(seed, cat) {
    const r = rng(seed + (cat && cat !== 'all' ? ':' + cat : ''));
    const pool = cat && cat !== 'all' ? QUESTIONS.filter(q => q.cat === cat) : QUESTIONS;
    const left = pool.slice();
    const rounds = [];
    const usedCats = new Set();
    while (rounds.length < ROUNDS && left.length) {
      // in mixed play, prefer a category not used yet today
      let cands = left.filter(q => !usedCats.has(q.cat));
      if (!cands.length) cands = left;
      const q = cands[Math.floor(r() * cands.length)];
      left.splice(left.indexOf(q), 1);
      usedCats.add(q.cat);
      // The slider range is shifted by a random amount so the answer is never simply in the middle
      const c = Math.log10(q.a), off = (r() - 0.5) * 2.4;
      let lo = c - SPAN + off, hi = c + SPAN + off;
      if (q.int && lo < 0) { hi = Math.max(hi - lo, 3); lo = 0; }
      rounds.push({ q, lo, hi, start: 0.2 + r() * 0.6 });
    }
    return rounds;
  }
  function scoreFor(guess, truth) {
    const err = Math.abs(Math.log(guess / truth));
    const f = Math.min(1, Math.max(0, (err - FULL_MARKS) / (ZERO_MARKS - FULL_MARKS)));
    return Math.round(MAX_PER_ROUND * (1 - f) * (1 - f));
  }
  const block = s => s >= 180 ? '🟩' : s >= 120 ? '🟨' : s >= 60 ? '🟧' : '🟥';

  // ---------- Numbers ----------
  const WORDS = [[1e21, 'sextillion'], [1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  const sig = (v, n) => Number(v.toPrecision(n));
  function plain(v) {
    if (v >= 1e21) return v.toExponential(2).replace('e+', ' × 10^');
    if (v >= 1000) return Math.round(v).toLocaleString('en');
    return String(sig(v, 4));
  }
  function words(v) {
    for (const [n, w] of WORDS) if (v >= n) return `${sig(v / n, 3)} ${w}`;
    return '';
  }
  // Short form for the reveal and result rows
  const short = v => words(v) || plain(v);
  // Snap a raw guess to something a person would say
  function tidy(v, q) {
    if (q.int) return Math.max(1, v >= 100 ? sig(v, 3) : Math.round(v));
    return sig(v, 3);
  }
  function parseGuess(str) {
    let s = String(str).toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
    if (!s) return NaN;
    const mult = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, m: 1e6, mn: 1e6, million: 1e6, crore: 1e7, crores: 1e7, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12, quadrillion: 1e15, quintillion: 1e18, sextillion: 1e21 };
    const m = s.match(/^([0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)\s*([a-z]*)$/);
    if (!m) return NaN;
    const n = parseFloat(m[1]);
    if (!m[2]) return n;
    return mult[m[2]] ? n * mult[m[2]] : NaN;
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), pips: $('pips'), scoreInfo: $('scoreInfo'), prompt: $('prompt'),
    banner: $('banner'), catWrap: $('catWrap'), catSelect: $('catSelect'), sub: $('sub'),
    bigNum: $('bigNum'), bigUnit: $('bigUnit'), bigWords: $('bigWords'), line: $('line'),
    controls: $('controls'), slider: $('slider'), minusBtn: $('minusBtn'), plusBtn: $('plusBtn'), typeInput: $('typeInput'), lockBtn: $('lockBtn'),
    reveal: $('reveal'), revealPts: $('revealPts'), revealNums: $('revealNums'), revealMeter: $('revealMeter'), revealFact: $('revealFact'), nextBtn: $('nextBtn'),
    resKicker: $('resKicker'), resRank: $('resRank'), resTotal: $('resTotal'), resBlocks: $('resBlocks'), resRows: $('resRows'), resVs: $('resVs'),
    shareBtn: $('shareBtn'), challengeBtn: $('challengeBtn'), nameInput: $('nameInput'), againBtn: $('againBtn'), countdown: $('countdown'),
    helpDlg: $('helpDlg'), statsDlg: $('statsDlg'), statsGrid: $('statsGrid')
  };
  el.catSelect.innerHTML = NUMBER_CATS.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  const statsBtn = document.createElement('button'); statsBtn.className = 'icon'; statsBtn.title = 'Statistics'; statsBtn.setAttribute('aria-label', 'Statistics');
  statsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z"/></svg>';
  const helpBtn = document.createElement('button'); helpBtn.className = 'icon'; helpBtn.title = 'How to play'; helpBtn.textContent = '?';
  tools.append(streakEl, statsBtn, helpBtn);

  // ---------- State ----------
  const S = {
    mode: 'daily', seed: '', cat: store.get('sg_number_cat', 'all'), date: '', rounds: [], i: 0,
    t: 0.5, guess: 1, scores: [], guesses: [], phase: 'guess', challenge: null, roundCat: 'all'
  };
  if (!NUMBER_CATS.some(c => c.id === S.cat)) S.cat = 'all';
  el.catSelect.value = S.cat;
  const round = () => S.rounds[S.i];
  const total = () => S.scores.reduce((a, b) => a + b, 0);
  const loadDaily = () => store.get(KEY, {});

  function start(mode, opts = {}) {
    S.mode = mode;
    S.challenge = opts.challenge || null;
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    if (mode === 'daily') { S.seed = 'number-' + S.date; S.roundCat = 'all'; }
    else if (mode === 'challenge') { S.seed = opts.seed; S.roundCat = opts.cat || 'all'; }
    else { S.seed = randomSeed(); S.roundCat = S.cat; }
    S.rounds = makeRounds(S.seed, S.roundCat);
    S.scores = []; S.guesses = []; S.i = 0;
    if (mode === 'daily') {
      const rec = loadDaily()[S.date];
      if (rec) { S.scores = rec.scores.slice(); S.guesses = rec.guesses.slice(); S.i = S.scores.length; }
      if (rec && rec.done) { updateChrome(); showResult(); return; }
    }
    el.result.hidden = true;
    el.game.hidden = false;
    updateChrome();
    startRound();
  }

  function startRound() {
    const r = round();
    S.phase = 'guess';
    el.prompt.textContent = r.q.q;
    el.controls.hidden = false;
    el.reveal.hidden = true;
    el.typeInput.value = '';
    setT(r.start);
    renderPips();
    el.scoreInfo.textContent = total();
  }

  // t in 0..1 maps onto the round's log range
  const valueAt = (r, t) => Math.pow(10, r.lo + t * (r.hi - r.lo));
  const tAt = (r, v) => (Math.log10(v) - r.lo) / (r.hi - r.lo);
  function setT(t, fromTyping) {
    const r = round();
    S.t = Math.min(1, Math.max(0, t));
    if (!fromTyping) S.guess = tidy(valueAt(r, S.t), r.q);
    el.slider.value = Math.round(S.t * STEPS);
    renderGuess();
  }
  function setGuess(v) {
    const r = round();
    S.guess = v;
    setT(tAt(r, v), true);
  }
  function renderGuess() {
    const r = round();
    el.bigNum.textContent = plain(S.guess);
    el.bigUnit.textContent = r.q.unit;
    el.bigWords.textContent = words(S.guess) ? `about ${words(S.guess)}` : ' ';
    drawLine();
  }

  // ---------- Number line ----------
  function tickLabel(p) {
    const v = Math.pow(10, p);
    if (p < 0) return String(sig(v, 1));
    if (p < 3) return String(v);
    if (p < 6) return (v / 1e3) + 'k';
    if (p >= 15) return `10<tspan dy="-5" font-size="9">${p}</tspan>`;
    const [n, w] = WORDS.find(([n]) => v >= n);
    return `${Math.round(v / n)}${TICK_SUFFIX[w]}`;
  }
  const TICK_SUFFIX = { million: 'M', billion: 'B', trillion: 'T', quadrillion: 'Qd', quintillion: 'Qn', sextillion: 'Sx' };
  function drawLine() {
    const r = round();
    // draw at the element's real width so text stays readable on phones
    const W = Math.max(300, Math.round(el.line.clientWidth) || 600), L = 24, R = W - 24, Y = 58;
    let lo = r.lo, hi = r.hi;
    const showTrue = S.phase === 'reveal';
    if (showTrue) {
      // keep both markers on the line even when the guess was typed outside the slider range
      lo = Math.min(lo, Math.log10(S.guess), Math.log10(r.q.a)) ;
      hi = Math.max(hi, Math.log10(S.guess), Math.log10(r.q.a));
    }
    const x = v => L + (Math.log10(v) - lo) / (hi - lo) * (R - L);
    let s = `<line x1="${L}" x2="${R}" y1="${Y}" y2="${Y}" class="ng-axis"/>`;
    const every = Math.max(1, Math.ceil(52 / ((R - L) / (hi - lo))));   // keep tick labels ~52px apart
    for (let p = Math.ceil(lo); p <= Math.floor(hi); p++) {
      if (p % every) continue;
      const px = x(Math.pow(10, p));
      s += `<line x1="${px}" x2="${px}" y1="${Y - 6}" y2="${Y + 6}" class="ng-tick"/><text x="${px}" y="${Y + 22}" class="ng-tl">${tickLabel(p)}</text>`;
    }
    const mark = (v, cls, label, up) => {
      const px = Math.min(R, Math.max(L, x(v)));
      const ty = up ? Y - 26 : Y + 38;
      const anchor = px < 70 ? 'start' : px > W - 70 ? 'end' : 'middle';
      return `<g class="${cls}"><line x1="${px}" x2="${px}" y1="${Y - 16}" y2="${Y + 16}" class="ng-m"/><circle cx="${px}" cy="${Y}" r="7"/><text x="${px}" y="${ty}" text-anchor="${anchor}" class="ng-ml">${esc(label)}</text></g>`;
    };
    if (showTrue) s += mark(r.q.a, 'ng-true', 'Answer: ' + short(r.q.a), false);
    s += mark(S.guess, 'ng-you', showTrue ? 'You: ' + short(S.guess) : short(S.guess), true);
    el.line.setAttribute('viewBox', `0 0 ${W} ${showTrue ? 104 : 86}`);
    el.line.innerHTML = s;
  }

  // ---------- Rounds ----------
  function lock() {
    if (S.phase !== 'guess') return;
    const typed = el.typeInput.value.trim();
    if (typed) {
      const v = parseGuess(typed);
      if (!(v > 0)) { SG.toast('That number doesn\'t look right'); el.typeInput.focus(); return; }
      setGuess(v);
    }
    const r = round();
    const sc = scoreFor(S.guess, r.q.a);
    S.scores.push(sc);
    S.guesses.push(S.guess);
    S.phase = 'reveal';
    if (S.mode === 'daily') {
      const d = loadDaily();
      d[S.date] = { scores: S.scores.slice(), guesses: S.guesses.slice(), done: S.scores.length >= ROUNDS, ...SG.lateFlag() };
      store.set(KEY, d);
    }
    el.controls.hidden = true;
    el.reveal.hidden = false;
    el.scoreInfo.textContent = total();
    renderReveal();
    drawLine();
    renderPips();
    updateChrome();
    if (sc >= 190) SG.confetti(40);
    el.nextBtn.focus({ preventScroll: true });
  }

  function renderReveal() {
    const r = round();
    const sc = S.scores[S.i], g = S.guesses[S.i], a = r.q.a;
    let verdict;
    if (Math.abs(Math.log(g / a)) <= FULL_MARKS) verdict = 'Spot on!';
    else if (g / a >= 1000) verdict = `Way too high (${Math.round(Math.log10(g / a))} zeros too many)`;
    else if (a / g >= 1000) verdict = `Way too low (${Math.round(Math.log10(a / g))} zeros short)`;
    else if (g / a >= 2) verdict = `${sig(g / a, 2)}× too high`;
    else if (a / g >= 2) verdict = `${sig(a / g, 2)}× too low`;
    else if (g > a) verdict = `${Math.round((g / a - 1) * 100)}% too high`;
    else verdict = `${Math.round((1 - g / a) * 100)}% too low`;
    const unit = r.q.unit ? ' ' + r.q.unit : '';
    el.revealPts.innerHTML = `+${sc}<small>points</small>`;
    el.revealPts.style.color = sc >= 180 ? 'var(--true)' : sc >= 60 ? 'var(--guess-deep)' : 'var(--bad)';
    el.revealNums.innerHTML = `<b>${verdict}</b> · Answer: <b>${esc(short(a) + unit)}</b> · You: <b>${esc(short(g) + unit)}</b>`;
    el.revealMeter.style.width = '0%';
    requestAnimationFrame(() => { el.revealMeter.style.width = (sc / MAX_PER_ROUND * 100) + '%'; });
    SG.setFact(el.revealFact, r.q.fact, r.q.src);
    el.nextBtn.textContent = S.i >= ROUNDS - 1 ? 'See result' : 'Next question';
  }

  function renderPips() {
    let h = '';
    for (let i = 0; i < ROUNDS; i++) {
      const sc = S.scores[i];
      const cls = sc == null ? (i === S.i && S.phase !== 'done' ? 'cur' : '') : sc >= 180 ? 's3' : sc >= 120 ? 's2' : sc >= 60 ? 's1' : 's0';
      h += `<span class="pip ${cls}"></span>`;
    }
    el.pips.innerHTML = h + `<span class="round-label">Question ${Math.min(S.i + 1, ROUNDS)}/${ROUNDS}</span>`;
  }

  function next() {
    if (S.phase !== 'reveal') return;
    S.i++;
    if (S.i >= ROUNDS) showResult(); else startRound();
  }

  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    const tot = total();
    el.resKicker.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)}` : S.mode === 'challenge' ? 'Challenge' : 'Unlimited';
    el.resRank.textContent = SG.rankFor(tot, ROUNDS * MAX_PER_ROUND);
    el.resTotal.textContent = tot;
    el.resBlocks.textContent = S.scores.map(block).join('');
    el.resRows.innerHTML = S.rounds.map((r, i) => {
      const sc = S.scores[i] ?? 0, unit = r.q.unit ? ' ' + r.q.unit : '';
      return `<li><span>${esc(r.q.q)}<br><small class="c-true">${esc(short(r.q.a) + unit)}</small> <small class="c-guess">· you said ${esc(short(S.guesses[i] ?? 0))}</small></span><span class="bar"><i style="width:${sc / MAX_PER_ROUND * 100}%"></i></span><b>${sc}</b></li>`;
    }).join('');
    if (tot >= 800) SG.confetti();
    SG.vsResult(el.result, S, tot);
    if (S.challenge) {
      const by = S.challenge.by || 'Your friend', vs = S.challenge.vs;
      const msg = tot > vs ? 'You win!' : tot < vs ? `${esc(by)} wins this time.` : 'It\'s a tie!';
      el.resVs.innerHTML = `You: ${tot} · ${esc(by)}: ${vs}<br>${msg}`;
      el.resVs.hidden = false;
    } else el.resVs.hidden = true;
    el.againBtn.textContent = S.mode === 'challenge' ? 'Play today\'s Daily' : S.mode === 'daily' ? 'Play Unlimited' : 'Play again';
    el.nameInput.value = store.get('sg_name', '');
    if (S.mode === 'daily') SG.board.show('number', S.date, el.result);
    tick();
    updateChrome();
  }

  function shareText() {
    const head = S.mode === 'daily' ? `${GAME.name} #${dayNumber(S.date)}` : `${GAME.name} ${S.mode === 'challenge' ? 'Challenge' : 'Unlimited'}`;
    const link = S.mode === 'daily' ? SG.challengeUrl({ mode: 'daily', date: S.date, score: total() }) : challengeUrl();
    return SG.challengeText(`${head}: ${total()}/1000`, S.scores.map(block).join(''), link);
  }
  function challengeUrl() {
    const name = el.nameInput.value.trim().slice(0, 20);
    store.set('sg_name', name);
    const q = new URLSearchParams({ c: S.seed, vs: String(total()) });
    if (S.roundCat !== 'all') q.set('k', S.roundCat);
    if (name) q.set('by', name);
    return `${location.origin}${location.pathname}?${q}`;
  }

  function tick() {
    if (el.result.hidden || S.mode !== 'daily') { el.countdown.textContent = ''; return; }
    el.countdown.textContent = `Next Daily in ${untilMidnight()}`;
    if (S.date !== todayKey() && !SG.archiveDate) start('daily');
  }
  setInterval(tick, 1000);

  function updateChrome() {
    document.querySelectorAll('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === S.mode));
    const st = streakInfo(loadDaily());
    streakEl.textContent = st.cur ? `🔥 ${st.cur}` : '';
    el.catWrap.hidden = S.mode !== 'unlimited';
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · 5 questions · same for everyone`
      : S.mode === 'challenge' ? 'Challenge · the same five questions your friend played'
      : 'Unlimited · pick a category and keep going';
    SG.vsBanner(S, '/1000');
    if (S.mode === 'challenge' && S.challenge) {
      el.banner.innerHTML = `<b>${esc(S.challenge.by || 'A friend')}</b> scored <b>${S.challenge.vs}/1000</b> on these questions. Can you beat it?`;
      el.banner.hidden = false;
    } else el.banner.hidden = true;
  }

  // ---------- Input ----------
  el.slider.addEventListener('input', () => { el.typeInput.value = ''; setT(el.slider.value / STEPS); });
  const nudge = d => { if (S.phase !== 'guess') return; el.typeInput.value = ''; setT(S.t + d); };
  el.minusBtn.addEventListener('click', () => nudge(-0.01));
  el.plusBtn.addEventListener('click', () => nudge(0.01));
  el.typeInput.addEventListener('input', () => {
    if (S.phase !== 'guess') return;
    const v = parseGuess(el.typeInput.value);
    if (v > 0) setGuess(v);
  });
  el.typeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lock(); } });
  el.lockBtn.addEventListener('click', lock);
  el.nextBtn.addEventListener('click', next);
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'range') return;
    if (document.querySelector('dialog[open]')) return;
    if (S.phase === 'guess') {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); nudge(step); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step); }
      else if (e.key === 'Enter') { e.preventDefault(); lock(); }
    } else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
  });
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.challengeBtn.addEventListener('click', () => {
    const by = el.nameInput.value.trim() || 'Your friend';
    share(`${GAME.name}: ${by} scored ${total()}/1000 on these questions. Can you beat it?\n${challengeUrl()}`);
  });
  el.againBtn.addEventListener('click', () => {
    if (S.mode === 'challenge') { history.replaceState(null, '', location.pathname); start('daily'); }
    else start('unlimited');
  });
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
    SG.leaveArchive();
    if (S.mode === 'challenge') history.replaceState(null, '', location.pathname);
    start(b.dataset.mode);
  }));
  el.catSelect.addEventListener('change', () => {
    S.cat = el.catSelect.value;
    store.set('sg_number_cat', S.cat);
    start('unlimited');
  });
  helpBtn.addEventListener('click', () => el.helpDlg.showModal());
  statsBtn.addEventListener('click', () => {
    const rec = loadDaily();
    const st = streakInfo(rec);
    const totals = st.keys.map(k => rec[k].scores.reduce((a, b) => a + b, 0));
    const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
    el.statsGrid.innerHTML = [
      [totals.length, 'Played'], [avg, 'Average'], [totals.length ? Math.max(...totals) : 0, 'Best'], [st.cur, 'Streak'], [st.max, 'Max streak']
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    el.statsDlg.showModal();
  });

  let lastW = 0;
  new ResizeObserver(() => {
    const w = Math.round(el.line.clientWidth);
    if (w && w !== lastW && S.phase !== 'done' && round()) { lastW = w; drawLine(); }
  }).observe(el.line);

  // ---------- Boot ----------
  const q = new URLSearchParams(location.search);
  if (q.get('c')) {
    const vs = Math.max(0, Math.min(1000, parseInt(q.get('vs'), 10) || 0));
    const cat = NUMBER_CATS.some(c => c.id === q.get('k')) ? q.get('k') : 'all';
    start('challenge', { seed: q.get('c').slice(0, 40), cat, challenge: { vs, by: (q.get('by') || '').slice(0, 20) } });
  } else {
    start(q.get('mode') === 'unlimited' ? 'unlimited' : 'daily');
  }
  window.__number = { S, makeRounds, scoreFor, parseGuess };
})();

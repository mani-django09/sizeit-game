(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, fmtLen, fmtKg, esc, share, shapeSvg, lineup } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'sort');
  const N = 5;                       // items per round
  const PAIRS = N * (N - 1) / 2;     // 10
  const KEY = 'sg_sort_daily';
  const ROUNDS = [
    { kind: 'size', label: 'size', icon: '📏', ask: 'Sort by size, smallest first', small: 'smallest', minGap: 1.2, maxSpread: 25 },
    { kind: 'weight', label: 'weight', icon: '⚖️', ask: 'Sort by weight, lightest first', small: 'lightest', minGap: 1.3, maxSpread: 1e9 }
  ];

  SG.header('sort');
  SG.measureShapes(OBJECTS);
  const REAL = OBJECTS.filter(o => o.cat !== 'story');
  // Size uses each object's documented measurement (height, length or width), not the drawing
  const DIM = { h: 'height', l: 'length', d: 'width' };
  const valueOf = (o, kind) => kind === 'size' ? o.size : o.kg;
  const fmtVal = (o, kind) => kind === 'size' ? fmtLen(o.size) : fmtKg(o.kg);

  // ---------- Sets ----------
  // Five items whose values are clearly apart (no near ties), shown in a shuffled order
  function makeSet(r, spec) {
    const pool = REAL.filter(o => spec.kind === 'size' || o.kg);
    for (let guard = 0; guard < 5000; guard++) {
      const pick = [];
      while (pick.length < N) {
        const o = pool[Math.floor(r() * pool.length)];
        if (!pick.includes(o)) pick.push(o);
      }
      const vals = pick.map(o => valueOf(o, spec.kind)).sort((a, b) => a - b);
      let ok = vals[N - 1] / vals[0] <= spec.maxSpread;
      for (let i = 1; i < N && ok; i++) if (vals[i] / vals[i - 1] < spec.minGap) ok = false;
      if (ok) return pick;
    }
    return pool.slice(0, N);
  }
  function makeRounds(seed) {
    const r = rng(seed);
    return ROUNDS.map(spec => ({ spec, items: makeSet(r, spec) }));
  }
  const truthOf = rd => rd.items.slice().sort((a, b) => valueOf(a, rd.spec.kind) - valueOf(b, rd.spec.kind));
  // One point for every pair placed the right way round
  function scoreOrder(order, rd) {
    const rank = new Map(truthOf(rd).map((o, i) => [o.id, i]));
    let s = 0;
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (rank.get(order[i]) < rank.get(order[j])) s++;
    return s;
  }
  const slotBlocks = (order, rd) => { const t = truthOf(rd); return order.map((id, i) => id === t[i].id ? '🟩' : '⬜').join(''); };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), pips: $('pips'), scoreLine: $('scoreLine'), prompt: $('prompt'), sub: $('sub'),
    slots: $('slots'), pool: $('pool'), actions: $('actions'), clearBtn: $('clearBtn'), checkBtn: $('checkBtn'), hint: $('hint'),
    reveal: $('reveal'), scene: $('scene'), revealPts: $('revealPts'), revealNums: $('revealNums'), revealFact: $('revealFact'), nextBtn: $('nextBtn'),
    resKicker: $('resKicker'), resRank: $('resRank'), resTotal: $('resTotal'), resBlocks: $('resBlocks'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn'), countdown: $('countdown')
  };
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  tools.append(streakEl, SG.unitButton());

  // ---------- State ----------
  const S = { mode: 'daily', date: '', rounds: [], i: 0, picks: [], scores: [], orders: [], phase: 'pick' };
  const loadDaily = () => store.get(KEY, {});
  const round = () => S.rounds[S.i];
  const total = () => S.scores.reduce((a, b) => a + b, 0);
  const byId = id => OBJECTS.find(o => o.id === id);

  function start(mode, seed) {
    S.mode = mode;
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    S.seed = mode === 'daily' ? '' : seed || randomSeed();
    S.rounds = makeRounds(mode === 'daily' ? 'sort-' + S.date : S.seed);
    S.i = 0; S.scores = []; S.orders = [];
    if (mode === 'daily') {
      const rec = loadDaily()[S.date];
      if (rec) { S.scores = rec.scores.slice(); S.orders = rec.orders.slice(); S.i = S.scores.length; }
      if (rec && rec.done) { updateChrome(); showResult(); return; }
    }
    el.result.hidden = true;
    el.game.hidden = false;
    updateChrome();
    startRound();
  }

  function startRound() {
    S.phase = 'pick';
    S.picks = [];
    const rd = round();
    el.prompt.innerHTML = `${esc(rd.spec.ask)}<small>Tap the ${rd.spec.small} one first.${rd.spec.kind === 'size' ? ' Each card says what is measured.' : ''}</small>`;
    el.reveal.hidden = true;
    el.actions.hidden = false;
    el.hint.hidden = false;
    el.pool.hidden = false;
    renderPick();
    renderMeta();
  }

  const card = (o, extra = '') => `<span class="so-art">${shapeSvg(o, 'so-fig')}</span><span class="so-name">${esc(o.name)}</span>${round().spec.kind === 'size' && !extra ? `<span class="so-dim">${DIM[o.dim]}</span>` : ''}${extra}`;
  function renderPick() {
    const rd = round();
    let slots = '';
    for (let i = 0; i < N; i++) {
      const o = S.picks[i] ? byId(S.picks[i]) : null;
      slots += o
        ? `<li><button class="so-card placed" data-unpick="${i}" aria-label="Remove ${esc(o.name)}"><span class="so-num">${i + 1}</span>${card(o)}</button></li>`
        : `<li><span class="so-card empty"><span class="so-num">${i + 1}</span><span class="so-name">${i === 0 ? rd.spec.small : i === N - 1 ? (rd.spec.kind === 'size' ? 'biggest' : 'heaviest') : ''}</span></span></li>`;
    }
    el.slots.innerHTML = slots;
    el.pool.innerHTML = rd.items.map((o, k) => S.picks.includes(o.id) ? `<span class="so-card gone"></span>`
      : `<button class="so-card" data-pick="${o.id}"><span class="so-key">${k + 1}</span>${card(o)}</button>`).join('');
    el.checkBtn.disabled = S.picks.length < N;
    el.clearBtn.disabled = !S.picks.length;
  }
  function pick(id) {
    if (S.phase !== 'pick' || S.picks.includes(id) || S.picks.length >= N) return;
    S.picks.push(id);
    // the last item has only one place to go
    if (S.picks.length === N - 1) S.picks.push(round().items.find(o => !S.picks.includes(o.id)).id);
    renderPick();
  }
  function unpick(i) {
    if (S.phase !== 'pick') return;
    S.picks.splice(i, 1);
    renderPick();
  }

  function check() {
    if (S.phase !== 'pick' || S.picks.length < N) return;
    const rd = round();
    const sc = scoreOrder(S.picks, rd);
    S.scores.push(sc);
    S.orders.push(S.picks.slice());
    S.phase = 'reveal';
    if (S.mode === 'daily') {
      const d = loadDaily();
      d[S.date] = { scores: S.scores.slice(), orders: S.orders.slice(), done: S.scores.length >= ROUNDS.length, ...SG.lateFlag() };
      store.set(KEY, d);
    }
    renderReveal();
    renderMeta();
    updateChrome();
    if (sc === PAIRS) SG.confetti(50);
    el.nextBtn.focus({ preventScroll: true });
  }

  function renderReveal() {
    const rd = round(), truth = truthOf(rd), order = S.orders[S.i], sc = S.scores[S.i];
    const kind = rd.spec.kind;
    // slots now show the player's order, marked right or wrong
    el.slots.innerHTML = order.map((id, i) => {
      const o = byId(id), ok = truth[i].id === id;
      return `<li><span class="so-card placed ${ok ? 'ok' : 'no'}"><span class="so-num">${i + 1}</span>${card(o, `<span class="so-val">${esc(fmtVal(o, kind))}</span>`)}</span></li>`;
    }).join('');
    el.pool.hidden = true;
    el.actions.hidden = true;
    el.hint.hidden = true;
    el.reveal.hidden = false;
    // draw at the scene's real width so labels stay readable on phones
    el.reveal.hidden = false;
    const w = Math.max(300, el.scene.clientWidth - 20), h = Math.round(Math.min(300, Math.max(230, w * 0.5)));
    el.scene.innerHTML = kind === 'size'
      ? lineup(truth.map((o, i) => ({ o, cls: i === N - 1 ? 'ob' : 'oa', label: o.name.replace(/ \(.*\)$/, '') })), { w, h, gap: 10, labels: true, top: 6 })
      : weightBars(truth);
    el.revealPts.innerHTML = `${sc}<small>of ${PAIRS}</small>`;
    el.revealPts.style.color = sc >= 9 ? 'var(--true)' : sc >= 6 ? 'var(--guess-deep)' : 'var(--bad)';
    const right = order.filter((id, i) => truth[i].id === id).length;
    el.revealNums.innerHTML = sc === PAIRS ? '<b>Perfect order!</b>' : `<b>${sc} of ${PAIRS} pairs</b> the right way round · ${right} of ${N} in the exact spot`;
    const big = truth[N - 1], small = truth[0];
    const ratio = valueOf(big, kind) / valueOf(small, kind);
    const bigName = SG.theNoun(big);
    el.revealFact.textContent = `${bigName.charAt(0).toUpperCase() + bigName.slice(1)} is about ${ratio < 10 ? ratio.toFixed(1) : Number(ratio.toPrecision(2)).toLocaleString('en')} times ${kind === 'size' ? 'bigger' : 'heavier'} than ${SG.theNoun(small)}.`;
    el.nextBtn.textContent = S.i >= S.rounds.length - 1 ? 'See result' : 'Next: sort by weight';
  }
  // Weights span huge ranges, so the bars use a log scale
  function weightBars(truth) {
    const lo = Math.log10(truth[0].kg), hi = Math.log10(truth[N - 1].kg);
    return `<div class="so-bars">${truth.map((o, i) => {
      const f = hi > lo ? (Math.log10(o.kg) - lo) / (hi - lo) : 1;
      return `<div class="so-bar"><span class="so-bn">${esc(o.name.replace(/ \(.*\)$/, ''))}</span><span class="so-bt"><i class="${i === N - 1 ? 'ob' : ''}" style="width:${(12 + f * 88).toFixed(1)}%"></i></span><b>${esc(fmtKg(o.kg))}</b></div>`;
    }).join('')}<p class="so-note">Bars use a log scale, so each step is a multiple, not an amount.</p></div>`;
  }

  function next() {
    if (S.phase !== 'reveal') return;
    S.i++;
    if (S.i >= S.rounds.length) showResult(); else startRound();
  }

  function renderMeta() {
    el.pips.innerHTML = S.rounds.map((rd, i) => {
      const sc = S.scores[i];
      const cls = sc == null ? (i === S.i ? 'cur' : '') : sc >= 9 ? 's3' : sc >= 7 ? 's2' : sc >= 5 ? 's1' : 's0';
      return `<span class="pip ${cls}"></span>`;
    }).join('') + `<span class="round-label">Round ${Math.min(S.i + 1, S.rounds.length)}/${S.rounds.length} · ${round() ? round().spec.label : ''}</span>`;
    el.scoreLine.innerHTML = `<b>${total()}</b> / ${S.rounds.length * PAIRS}`;
  }

  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    const tot = total();
    el.resKicker.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)}` : 'Unlimited';
    el.resRank.textContent = SG.rankFor(tot, S.rounds.length * PAIRS);
    el.resTotal.textContent = tot;
    el.resBlocks.innerHTML = S.rounds.map((rd, i) => `<div>${rd.spec.icon} ${slotBlocks(S.orders[i] || [], rd)} <b>${S.scores[i] ?? 0}/${PAIRS}</b></div>`).join('');
    el.againBtn.textContent = S.mode === 'daily' ? 'Play Unlimited' : 'Play again';
    if (tot >= 18) SG.confetti();
    SG.vsResult(el.result, S, tot);
    if (S.mode === 'daily') SG.board.show('sort', S.date, el.result);
    tick();
    updateChrome();
  }
  function shareText() {
    const head = S.mode === 'daily' ? `${GAME.name} #${dayNumber(S.date)}` : `${GAME.name} Unlimited`;
    const lines = S.rounds.map((rd, i) => `${rd.spec.icon} ${slotBlocks(S.orders[i] || [], rd)}`).join('\n');
    return SG.challengeText(`${head}: ${total()}/${S.rounds.length * PAIRS}`, lines, SG.challengeUrl({ mode: S.mode, date: S.date, seed: S.seed, score: total() }));
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
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · one size round, one weight round` : 'Unlimited · a fresh pair of rounds every time';
    SG.vsBanner(S, `/${S.rounds.length * PAIRS}`);
  }

  // ---------- Input ----------
  el.pool.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) pick(b.dataset.pick); });
  el.slots.addEventListener('click', e => { const b = e.target.closest('[data-unpick]'); if (b) unpick(+b.dataset.unpick); });
  el.clearBtn.addEventListener('click', () => { if (S.phase === 'pick') { S.picks = []; renderPick(); } });
  el.checkBtn.addEventListener('click', check);
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.againBtn.addEventListener('click', () => start('unlimited'));
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { SG.leaveArchive(); start(b.dataset.mode); }));
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.phase === 'pick') {
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= N) { const o = round().items[k - 1]; if (o) pick(o.id); }
      else if (e.key === 'Backspace' && S.picks.length) { e.preventDefault(); unpick(S.picks.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); check(); }
    } else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
  });
  SG.onUnits(() => { if (S.phase === 'reveal') renderReveal(); });

  start(new URLSearchParams(location.search).get('mode') === 'unlimited' ? 'unlimited' : 'daily', SG.vs && SG.vs.seed);
  window.__sort = { S, makeRounds, scoreOrder, truthOf };
})();

(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, fmtKg, esc, share } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'heavier');
  const DAILY_Q = 10;
  const KEY = 'sg_heavier_daily';
  const BEST_KEY = 'sg_heavier_best';

  SG.header('heavier');
  SG.measureShapes(OBJECTS);
  const POOL = OBJECTS.filter(o => o.kg);

  // ---------- Sequences ----------
  const ratioOf = (a, b) => Math.max(a.kg / b.kg, b.kg / a.kg);
  function pickNext(r, cur, avoid, minR, maxR) {
    let cands = POOL.filter(o => o !== cur && !avoid.has(o.id) && ratioOf(o, cur) >= minR && ratioOf(o, cur) <= maxR);
    if (!cands.length) cands = POOL.filter(o => o !== cur && ratioOf(o, cur) >= minR);
    return cands[Math.floor(r() * cands.length)];
  }
  function dailySequence(seed) {
    const r = rng(seed);
    const seq = [POOL[Math.floor(r() * POOL.length)]];
    const used = new Set([seq[0].id]);
    while (seq.length < DAILY_Q + 1) {
      const n = pickNext(r, seq[seq.length - 1], used, 1.5, 30);
      seq.push(n); used.add(n.id);
    }
    return seq;
  }
  // Endless gets harder: the allowed gap between weights shrinks as the streak grows
  const endlessMax = streak => Math.max(1.8, 40 / (1 + streak * 0.35));
  // "the <span>giraffe</span>" or "<span>Robert Wadlow</span>", for use inside a sentence
  const named = (o, cls) => (SG.theNoun(o) === SG.noun(o) ? '' : 'the ') + `<span class="${cls}">${esc(SG.noun(o))}</span>`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), progress: $('progress'), scoreLine: $('scoreLine'), prompt: $('prompt'), sub: $('sub'),
    beam: $('beam'), panA: $('panA'), panB: $('panB'), objA: $('objA'), objB: $('objB'),
    ropeA1: $('ropeA1'), ropeA2: $('ropeA2'), ropeB1: $('ropeB1'), ropeB2: $('ropeB2'),
    labA: $('labA'), labB: $('labB'), nameA: $('nameA'), nameB: $('nameB'), wA: $('wA'), wB: $('wB'),
    choose: $('choose'), heavierBtn: $('heavierBtn'), lighterBtn: $('lighterBtn'),
    reveal: $('reveal'), verdict: $('verdict'), ratio: $('ratio'), fact: $('fact'), nextBtn: $('nextBtn'), dots: $('dots'),
    resTitle: $('resTitle'), resRank: $('resRank'), resTotal: $('resTotal'), resOf: $('resOf'), resBlocks: $('resBlocks'), resNote: $('resNote'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn'), countdown: $('countdown')
  };
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  tools.append(streakEl, SG.unitButton());

  // ---------- Balance scale ----------
  const PIVOT = { x: 300, y: 78 }, ARM = 200, DROP = 118, RIM = 78;
  let angle = 0, target = 0;
  const onPan = o => SG.shapeSvg(o).replace('<svg ', '<svg x="-66" y="-104" width="132" height="102" preserveAspectRatio="xMidYMax meet" ');
  function drawScale(t) {
    const wobble = S.phase === 'ask' ? Math.sin(t / 650) * 1.6 : 0;
    angle += (target + wobble - angle) * 0.08;
    const rad = angle * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const A = { x: PIVOT.x - ARM * c, y: PIVOT.y - ARM * s };
    const B = { x: PIVOT.x + ARM * c, y: PIVOT.y + ARM * s };
    el.beam.setAttribute('transform', `rotate(${angle.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`);
    const hang = (P, pan, r1, r2) => {
      const py = P.y + DROP;
      pan.setAttribute('transform', `translate(${P.x.toFixed(1)} ${py.toFixed(1)})`);
      r1.setAttribute('x1', P.x); r1.setAttribute('y1', P.y); r1.setAttribute('x2', P.x - RIM); r1.setAttribute('y2', py);
      r2.setAttribute('x1', P.x); r2.setAttribute('y1', P.y); r2.setAttribute('x2', P.x + RIM); r2.setAttribute('y2', py);
    };
    hang(A, el.panA, el.ropeA1, el.ropeA2);
    hang(B, el.panB, el.ropeB1, el.ropeB2);
    requestAnimationFrame(drawScale);
  }

  // ---------- State ----------
  const S = { mode: 'daily', date: '', seq: [], i: 0, answers: [], A: null, B: null, phase: 'ask', r: null, recent: [] };
  const loadDaily = () => store.get(KEY, {});

  function start(mode, seed) {
    S.mode = mode;
    S.seed = mode === 'daily' ? '' : seed || randomSeed();
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    S.answers = [];
    S.i = 0;
    if (mode === 'daily') {
      S.seq = dailySequence('heavier-' + S.date);
      const rec = loadDaily()[S.date];
      if (rec) { S.answers = rec.answers.slice(); S.i = S.answers.length; }
      if (rec && rec.done) { showResult(); return; }
      S.A = S.seq[S.i]; S.B = S.seq[S.i + 1];
    } else {
      S.r = rng(S.seed);
      S.A = POOL[Math.floor(S.r() * POOL.length)];
      S.recent = [S.A.id];
      S.B = pickNext(S.r, S.A, new Set(S.recent), 1.25, endlessMax(0));
      S.recent.push(S.B.id);
    }
    el.result.hidden = true;
    el.game.hidden = false;
    ask();
    updateChrome();
  }

  function ask() {
    S.phase = 'ask';
    target = 0;
    el.objA.innerHTML = onPan(S.A);
    el.objB.innerHTML = onPan(S.B);
    el.nameA.textContent = S.A.name;
    el.nameB.textContent = S.B.name;
    el.wA.textContent = fmtKg(S.A.kg);
    el.wB.textContent = '?';
    el.labB.classList.remove('right', 'wrong');
    el.prompt.innerHTML = `Is ${named(S.B, 'c-guess')} heavier or lighter than ${named(S.A, 'c-ref')}?`;
    el.choose.hidden = false;
    el.reveal.hidden = true;
    renderMeta();
  }

  function answer(choice) {
    if (S.phase !== 'ask') return;
    S.phase = 'reveal';
    const heavier = S.B.kg > S.A.kg;
    const ok = (choice === 'heavier') === heavier;
    S.answers.push(ok);
    if (S.mode === 'daily') {
      const d = loadDaily();
      d[S.date] = { answers: S.answers.slice(), done: S.answers.length >= DAILY_Q, ...SG.lateFlag() };
      store.set(KEY, d);
    } else if (ok) {
      store.set(BEST_KEY, Math.max(store.get(BEST_KEY, 0), S.answers.length));
    }
    target = heavier ? 13 : -13;   // the heavier side drops
    el.wB.textContent = fmtKg(S.B.kg);
    el.labB.classList.add(ok ? 'right' : 'wrong');
    el.verdict.textContent = ok ? 'Correct!' : 'Not quite';
    el.verdict.style.color = ok ? 'var(--true)' : 'var(--bad)';
    const ratio = ratioOf(S.A, S.B);
    const times = ratio < 10 ? ratio.toFixed(1) : Number(ratio.toPrecision(2)).toLocaleString('en');
    const [hv, lt] = heavier ? [S.B, S.A] : [S.A, S.B];
    el.ratio.innerHTML = `${esc(cap(SG.theNoun(hv)))} is about <b>${times}×</b> heavier than ${esc(SG.theNoun(lt))}.`;
    SG.setFact(el.fact, SG.weightFact(S.B, fmtKg(S.B.kg)), S.B.src);
    const last = S.mode === 'daily' ? S.answers.length >= DAILY_Q : !ok;
    el.nextBtn.textContent = last ? 'See result' : 'Next →';
    el.choose.hidden = true;
    el.reveal.hidden = false;
    renderMeta();
    updateChrome();
    if (ok && S.mode === 'endless' && S.answers.length % 10 === 0) SG.confetti(40);
    el.nextBtn.focus({ preventScroll: true });
  }

  function next() {
    if (S.phase !== 'reveal') return;
    if (S.mode === 'daily') {
      S.i++;
      if (S.i >= DAILY_Q) return showResult();
      S.A = S.seq[S.i]; S.B = S.seq[S.i + 1];
    } else {
      if (!S.answers[S.answers.length - 1]) return showResult();
      S.A = S.B;
      S.B = pickNext(S.r, S.A, new Set(S.recent.slice(-10)), 1.25, endlessMax(S.answers.length));
      S.recent.push(S.B.id);
    }
    ask();
  }

  function renderMeta() {
    const right = S.answers.filter(Boolean).length;
    if (S.mode === 'daily') {
      el.progress.textContent = `Question ${Math.min(S.answers.length + (S.phase === 'ask' ? 1 : 0), DAILY_Q)} of ${DAILY_Q}`;
      el.scoreLine.innerHTML = `<b>${right}</b> correct`;
      let d = '';
      for (let i = 0; i < DAILY_Q; i++) d += `<i class="${S.answers[i] == null ? '' : S.answers[i] ? 'ok' : 'no'}"></i>`;
      el.dots.innerHTML = d;
    } else {
      el.progress.textContent = `Streak ${right}`;
      el.scoreLine.innerHTML = `Best <b>${store.get(BEST_KEY, 0)}</b>`;
      el.dots.innerHTML = '';
    }
  }

  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    const right = S.answers.filter(Boolean).length;
    if (S.mode === 'daily') {
      el.resTitle.textContent = `Daily #${dayNumber(S.date)}`;
      el.resRank.textContent = SG.rankFor(right, DAILY_Q);
      el.resTotal.textContent = right;
      el.resOf.textContent = `/${DAILY_Q}`;
      el.resBlocks.textContent = S.answers.map(a => a ? '✅' : '❌').join('');
      el.resNote.textContent = '';
      el.againBtn.textContent = 'Play Endless';
      if (right >= 9) SG.confetti();
    } else {
      const best = store.get(BEST_KEY, 0);
      el.resTitle.textContent = 'Endless';
      el.resRank.textContent = right >= best && right > 0 ? 'New best!' : 'Your streak';
      el.resTotal.textContent = right;
      el.resOf.textContent = '';
      el.resBlocks.textContent = '';
      el.resNote.textContent = `Best streak: ${best}`;
      el.againBtn.textContent = 'Play again';
      if (right >= best && right >= 5) SG.confetti();
    }
    SG.vsResult(el.result, S, right);
    if (S.mode === 'daily') SG.board.show('heavier', S.date, el.result);
    tick();
    updateChrome();
  }

  function shareText() {
    const right = S.answers.filter(Boolean).length;
    const url = SG.challengeUrl({ mode: S.mode, date: S.date, seed: S.seed, score: right });
    if (S.mode === 'daily') return SG.challengeText(`${GAME.name} #${dayNumber(S.date)}: ${right}/${DAILY_Q}`, S.answers.map(a => a ? '✅' : '❌').join(''), url);
    return SG.challengeText(`${GAME.name}: I got a streak of ${right} in Endless mode. Same run for you.`, '', url);
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
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · 10 questions · same for everyone` : 'Endless · one wrong answer ends the run';
    SG.vsBanner(S, S.mode === 'daily' ? `/${DAILY_Q}` : ' in a row');
  }

  // ---------- Input ----------
  el.heavierBtn.addEventListener('click', () => answer('heavier'));
  el.lighterBtn.addEventListener('click', () => answer('lighter'));
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.againBtn.addEventListener('click', () => start('endless'));
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { SG.leaveArchive(); start(b.dataset.mode); }));
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (S.phase === 'ask') {
      if (k === 'arrowdown' || k === 'h') { e.preventDefault(); answer('heavier'); }
      else if (k === 'arrowup' || k === 'l') { e.preventDefault(); answer('lighter'); }
    } else if (S.phase === 'reveal' && k === 'enter') { e.preventDefault(); next(); }
  });
  SG.onUnits(() => {
    if (S.phase === 'done') return;
    el.wA.textContent = fmtKg(S.A.kg);
    if (S.phase === 'reveal') { el.wB.textContent = fmtKg(S.B.kg); SG.setFact(el.fact, SG.weightFact(S.B, fmtKg(S.B.kg)), S.B.src); }
  });

  start(new URLSearchParams(location.search).get('mode') === 'endless' ? 'endless' : 'daily', SG.vs && SG.vs.seed);
  requestAnimationFrame(drawScale);
  window.__heavier = { S, dailySequence, POOL };
})();

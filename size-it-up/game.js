(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, fmtLen, esc, share, toast } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'how-big');
  const ROUNDS = 5;
  const MAX_PER_ROUND = 200;
  const MIN_RATIO = 1.3, MAX_RATIO = 15;   // how far apart the two sizes in a pair may be
  const LOG_RANGE = Math.log(40);
  const FULL_MARKS = Math.log(1.05);       // within 5% = full points
  const ZERO_MARKS = Math.log(5);          // 5x off = zero
  const KEY = 'sg_howbig_daily';
  // Category Dailies (?daily=animals): five pairs from one category, the same for everyone that day.
  // Saved separately, keyed "date|category", so they never touch the main Daily's streak or leaderboard.
  const CAT_KEY = 'sg_howbig_cat_daily';
  const isDaily = m => m === 'daily' || m === 'catdaily';
  const keyFor = m => m === 'catdaily' ? CAT_KEY : KEY;
  const catName = id => (CATEGORIES.find(c => c.id === id) || { name: 'Mixed' }).name;
  const REAL = OBJECTS;

  SG.header('how-big');
  const BBOX = SG.measureShapes(OBJECTS);

  // ---------- Pairs and scoring ----------
  function makePairs(seed, cat) {
    const r = rng(seed + (cat && cat !== 'all' ? ':' + cat : ''));
    const targets = cat && cat !== 'all' ? OBJECTS.filter(o => inCategory(o, cat)) : REAL;
    const used = new Set();
    const pairs = [];
    for (let pass = 0; pass < 2 && pairs.length < ROUNDS; pass++) {
      let guard = 0;
      while (pairs.length < ROUNDS && guard++ < 20000) {
        const b = targets[Math.floor(r() * targets.length)];
        const a = REAL[Math.floor(r() * REAL.length)];
        // second pass allows a target to repeat when a category is small
        if (a === b || used.has(a.id) || (pass === 0 && used.has(b.id))) continue;
        const ratio = Math.max(a.size / b.size, b.size / a.size);
        if (ratio < MIN_RATIO || ratio > MAX_RATIO) continue;
        pairs.push({ ref: a, tgt: b, start: (r() - 0.5) * 0.6 });
        used.add(a.id); used.add(b.id);
      }
    }
    return pairs;
  }
  function scoreFor(guess, truth) {
    const err = Math.abs(Math.log(guess / truth));
    const f = Math.min(1, Math.max(0, (err - FULL_MARKS) / (ZERO_MARKS - FULL_MARKS)));
    return Math.round(MAX_PER_ROUND * (1 - f) * (1 - f));
  }
  const block = s => s >= 180 ? '🟩' : s >= 120 ? '🟨' : s >= 60 ? '🟧' : '🟥';
  const dimName = { h: 'height', l: 'length', d: 'diameter' };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    board: $('board'), ground: $('ground'),
    refG: $('refG'), guessG: $('guessG'), trueG: $('trueG'),
    refM: $('refM'), guessM: $('guessM'), trueM: $('trueM'),
    refName: $('refName'), tgtName: $('tgtName'),
    slider: $('slider'), lockBtn: $('lockBtn'), minusBtn: $('minusBtn'), plusBtn: $('plusBtn'),
    controls: $('controls'), hint: $('hint'),
    reveal: $('reveal'), revealPts: $('revealPts'), revealNums: $('revealNums'), revealFact: $('revealFact'), nextBtn: $('nextBtn'),
    game: $('game'), result: $('result'), pips: $('pips'), scoreInfo: $('scoreInfo'), prompt: $('prompt'),
    banner: $('banner'), catWrap: $('catWrap'), catSelect: $('catSelect'), sub: $('sub'),
    earth: $('earth'), dragHint: $('dragHint'), revealMeter: $('revealMeter'), resRank: $('resRank'), resKicker: $('resKicker'),
    resTotal: $('resTotal'), resBlocks: $('resBlocks'), resRows: $('resRows'), resVs: $('resVs'),
    shareBtn: $('shareBtn'), challengeBtn: $('challengeBtn'), nameInput: $('nameInput'), againBtn: $('againBtn'), countdown: $('countdown'),
    helpDlg: $('helpDlg'), statsDlg: $('statsDlg'), statsGrid: $('statsGrid')
  };
  el.slider.min = -LOG_RANGE; el.slider.max = LOG_RANGE; el.slider.step = 0.001;
  el.catSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  // Header tools
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak';
  const statsBtn = document.createElement('button'); statsBtn.className = 'icon'; statsBtn.title = 'Statistics'; statsBtn.setAttribute('aria-label', 'Statistics');
  statsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z"/></svg>';
  const helpBtn = document.createElement('button'); helpBtn.className = 'icon'; helpBtn.title = 'How to play'; helpBtn.textContent = '?';
  tools.append(streakEl, SG.unitButton(), statsBtn, helpBtn);

  // ---------- State ----------
  const S = {
    mode: 'daily', seed: '', cat: store.get('sg_howbig_cat', 'all'), date: '', pairs: [], i: 0, lr: 0,
    scores: [], guesses: [], phase: 'guess', scale: null, challenge: null, dirty: true
  };
  el.catSelect.value = S.cat;
  const pair = () => S.pairs[S.i];
  const guessSize = () => pair().ref.size * Math.exp(S.lr);
  const total = () => S.scores.reduce((a, b) => a + b, 0);
  const loadDaily = (m = S.mode) => store.get(keyFor(m), {});
  const recKey = () => S.mode === 'catdaily' ? `${S.date}|${S.dcat}` : S.date;

  // ---------- Flow ----------
  function start(mode, opts = {}) {
    S.mode = mode;
    S.challenge = opts.challenge || null;
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    if (mode === 'daily') { S.seed = 'howbig-' + S.date; S.pairs = makePairs(S.seed, 'all'); S.pairCat = 'all'; }
    else if (mode === 'catdaily') {
      S.dcat = opts.cat || S.dcat;
      S.date = SG.archiveDate || todayKey();
      S.seed = 'howbig-' + S.date;
      S.pairs = makePairs(S.seed, S.dcat);   // seeded with "howbig-<date>:<category>", so it differs from the main Daily
      S.pairCat = S.dcat;
    } else {
      S.seed = opts.seed || randomSeed();
      const cat = mode === 'challenge' ? (opts.cat || 'all') : S.cat;
      S.pairs = makePairs(S.seed, cat);
      S.pairCat = cat;
    }
    S.i = 0; S.scores = []; S.guesses = [];
    showResult.celebrated = false;
    if (isDaily(mode)) {
      const rec = loadDaily()[recKey()];
      if (rec) { S.scores = rec.scores.slice(); S.guesses = rec.guesses.slice(); S.i = S.scores.length; }
      if (rec && rec.done) { showResult(); return; }
    }
    el.result.hidden = true;
    el.game.hidden = false;
    startRound();
    updateChrome();
  }

  function startRound() {
    const p = pair();
    S.phase = 'guess';
    S.lr = p.start;
    S.scale = null;
    el.refG.innerHTML = p.ref.svg;
    el.guessG.innerHTML = p.tgt.svg;
    el.trueG.innerHTML = p.tgt.svg;
    el.trueG.style.display = 'none';
    el.trueM.style.display = 'none';
    el.guessG.classList.remove('dim');
    el.reveal.hidden = true;
    el.controls.hidden = false;
    el.hint.hidden = false;
    el.slider.value = S.lr;
    renderPips();
    // keep the "(with tail)" style notes, since they say what is measured
    const named = (o, cls) => {
      const full = SG.noun(o) === o.name.replace(/ \(.*\)$/, '') ? o.name : o.name.charAt(0).toLowerCase() + o.name.slice(1);
      return (SG.theNoun(o) === SG.noun(o) ? '' : 'the ') + `<b class="${cls}">${esc(o.id === 'wadlow' ? SG.noun(o) : full)}</b>`;
    };
    el.prompt.innerHTML = `Make ${named(p.tgt, 'c-guess')} the right size next to ${named(p.ref, 'c-ref')}.` +
      `<small>Compared by ${dimName[p.tgt.dim]}.</small>`;
    el.scoreInfo.textContent = total();
    S.dirty = true;
  }

  function lock() {
    if (S.phase !== 'guess') return;
    const p = pair();
    const g = guessSize();
    S.scores.push(scoreFor(g, p.tgt.size));
    S.guesses.push(g);
    S.phase = 'reveal';
    if (isDaily(S.mode)) {
      const d = loadDaily();
      d[recKey()] = { scores: S.scores.slice(), guesses: S.guesses.slice(), done: S.scores.length >= ROUNDS, ...SG.lateFlag() };
      store.set(keyFor(S.mode), d);
    }
    el.trueG.style.display = '';
    el.trueM.style.display = '';
    el.guessG.classList.add('dim');
    el.controls.hidden = true;
    el.hint.hidden = true;
    el.reveal.hidden = false;
    el.scoreInfo.textContent = total();
    renderReveal();
    renderPips();
    updateChrome();
    if (S.scores[S.i] >= 190) SG.confetti(40);
    S.dirty = true;
    el.nextBtn.focus({ preventScroll: true });
  }

  function renderPips() {
    let h = '';
    for (let i = 0; i < ROUNDS; i++) {
      const sc = S.scores[i];
      const cls = sc == null ? (i === S.i && S.phase !== 'done' ? 'cur' : '') : sc >= 180 ? 's3' : sc >= 120 ? 's2' : sc >= 60 ? 's1' : 's0';
      h += `<span class="pip ${cls}"></span>`;
    }
    el.pips.innerHTML = h + `<span class="round-label">Round ${Math.min(S.i + 1, ROUNDS)}/${ROUNDS}</span>`;
  }

  function next() {
    if (S.phase !== 'reveal') return;
    S.i++;
    if (S.i >= ROUNDS) showResult(); else startRound();
  }

  function renderReveal() {
    const p = pair();
    const sc = S.scores[S.i], g = S.guesses[S.i], tr = p.tgt.size;
    let verdict;
    if (Math.abs(Math.log(g / tr)) <= FULL_MARKS) verdict = 'Spot on!';
    // percentages for near misses, "3.2× too big" once it is double or more
    else if (g / tr >= 2) verdict = `${(g / tr).toFixed(1)}× too big`;
    else if (tr / g >= 2) verdict = `${(tr / g).toFixed(1)}× too small`;
    else if (g > tr) verdict = `${Math.round((g / tr - 1) * 100)}% too big`;
    else verdict = `${Math.round((1 - g / tr) * 100)}% too small`;
    el.revealPts.innerHTML = `+${sc}<small>points</small>`;
    el.revealPts.style.color = sc >= 180 ? 'var(--true)' : sc >= 60 ? 'var(--guess-deep)' : 'var(--bad)';
    el.revealNums.innerHTML = `<b>${verdict}</b> · Real: <b>${fmtLen(tr)}</b> · You: <b>${fmtLen(g)}</b>`;
    el.revealMeter.style.width = '0%';
    requestAnimationFrame(() => { el.revealMeter.style.width = (sc / MAX_PER_ROUND * 100) + '%'; });
    SG.setFact(el.revealFact, p.tgt.fact, p.tgt.src);
    el.nextBtn.textContent = S.i >= ROUNDS - 1 ? 'See result' : 'Next round';
  }

  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    const tot = total();
    el.resKicker.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)}` : S.mode === 'catdaily' ? `${catName(S.dcat)} Daily #${dayNumber(S.date)}`
      : S.mode === 'challenge' ? 'Challenge' : 'Unlimited';
    el.resRank.textContent = SG.rankFor(tot, ROUNDS * MAX_PER_ROUND);
    el.resTotal.textContent = tot;
    el.resBlocks.textContent = S.scores.map(block).join('');
    el.resRows.innerHTML = S.pairs.map((p, i) => {
      const sc = S.scores[i] ?? 0;
      return `<li><span>${esc(p.tgt.name)}<br><small class="c-ref">vs ${esc(p.ref.name)}</small></span><span class="bar"><i style="width:${sc / MAX_PER_ROUND * 100}%"></i></span><b>${sc}</b></li>`;
    }).join('');
    if (tot >= 800 && S.phase === 'done' && !showResult.celebrated) { SG.confetti(); showResult.celebrated = true; }
    SG.vsResult(el.result, S, tot);
    if (S.challenge) {
      const by = S.challenge.by || 'Your friend';
      const vs = S.challenge.vs;
      const msg = tot > vs ? 'You win!' : tot < vs ? `${esc(by)} wins this time.` : 'It\'s a tie!';
      el.resVs.innerHTML = `You: ${tot} · ${esc(by)}: ${vs}<br>${msg}`;
      el.resVs.hidden = false;
    } else el.resVs.hidden = true;
    el.againBtn.textContent = S.mode === 'daily' ? 'Play Unlimited' : S.mode === 'catdaily' ? `${catName(S.dcat)} Unlimited`
      : S.mode === 'challenge' ? 'Play today\'s Daily' : 'Play again';
    el.nameInput.value = store.get('sg_name', '');
    if (S.mode === 'daily') SG.board.show('how-big', S.date, el.result);
    tick();
    updateChrome();
  }

  function shareText() {
    const head = S.mode === 'daily' ? `${GAME.name} #${dayNumber(S.date)}`
      : S.mode === 'catdaily' ? `${GAME.name} · ${catName(S.dcat)} Daily #${dayNumber(S.date)}`
      : `${GAME.name} ${S.mode === 'challenge' ? 'Challenge' : 'Unlimited'}`;
    const link = S.mode === 'daily' ? SG.challengeUrl({ mode: 'daily', date: S.date, score: total() }) : challengeUrl();
    return SG.challengeText(`${head}: ${total()}/1000`, S.scores.map(block).join(''), link);
  }
  function challengeUrl() {
    const name = el.nameInput.value.trim().slice(0, 20);
    store.set('sg_name', name);
    const q = new URLSearchParams({ c: S.seed, vs: String(total()) });
    if (S.pairCat && S.pairCat !== 'all') q.set('k', S.pairCat);
    if (name) q.set('by', name);
    return `${location.origin}${location.pathname}?${q}`;
  }

  function tick() {
    if (el.result.hidden || !isDaily(S.mode)) { el.countdown.textContent = ''; return; }
    el.countdown.textContent = `Next puzzle in ${untilMidnight()}`;
    if (S.date !== todayKey() && !SG.archiveDate) start(S.mode);
  }
  setInterval(tick, 1000);

  function updateChrome() {
    document.querySelectorAll('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === S.mode));
    const st = streakInfo(loadDaily('daily'));
    streakEl.textContent = st.cur ? `🔥 ${st.cur}` : '';
    streakEl.title = 'Daily streak';
    el.catWrap.hidden = S.mode !== 'unlimited';
    el.sub.innerHTML = S.mode === 'catdaily' ? `<b>${esc(catName(S.dcat))} Daily</b> #${dayNumber(S.date)} · 5 rounds · same for everyone · <a href="../categories/">all categories</a>`
      : S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · 5 rounds · same for everyone · <a href="../categories/">play by category</a>`
      : S.mode === 'challenge' ? 'Challenge · the same five pairs your friend played'
      : 'Unlimited · fresh pairs every game';
    SG.vsBanner(S, '/1000');
    if (S.mode === 'challenge' && S.challenge) {
      el.banner.innerHTML = `<b>${esc(S.challenge.by || 'A friend')}</b> scored <b>${S.challenge.vs}/1000</b> on this set. Can you beat it?`;
      el.banner.hidden = false;
    } else el.banner.hidden = true;
  }

  // ---------- Drawing ----------
  function boxOf(o, size) {
    const b = BBOX[o.id];
    return o.dim === 'h' ? { w: size * b.w / b.h, h: size } : { w: size, h: size * b.h / b.w };
  }
  function place(g, o, x, ground, box, s) {
    const b = BBOX[o.id];
    const k = (box.w * s) / b.w;
    g.setAttribute('transform', `translate(${x.toFixed(2)} ${(ground - box.h * s).toFixed(2)}) scale(${k}) translate(${-b.x} ${-b.y})`);
  }
  function measure(g, o, x, ground, box, s, text, lift, W) {
    const w = box.w * s, top = ground - box.h * s;
    let lines, ty;
    if (o.dim === 'h') {
      const lx = x - 7;
      lines = `<line x1="${lx}" y1="${ground}" x2="${lx}" y2="${top}"/><line x1="${lx - 4}" y1="${top}" x2="${lx + 4}" y2="${top}"/><line x1="${lx - 4}" y1="${ground}" x2="${lx + 4}" y2="${ground}"/>`;
      ty = top - 8 - lift;
    } else {
      const ly = top - 6;
      lines = `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}"/><line x1="${x}" y1="${ly - 4}" x2="${x}" y2="${ly + 4}"/><line x1="${x + w}" y1="${ly - 4}" x2="${x + w}" y2="${ly + 4}"/>`;
      ty = top - 18 - lift;
    }
    const pw = text.length * 7.4 + 16;
    const tx = Math.min(W - pw / 2 - 6, Math.max(pw / 2 + 6, x + w / 2));
    const y = Math.max(14, ty - 4);
    g.innerHTML = `${lines}<rect x="${tx - pw / 2}" y="${y - 11}" width="${pw}" height="22"/><text x="${tx}" y="${y}">${esc(text)}</text>`;
  }

  function draw() {
    if (!S.pairs.length || S.phase === 'done' || el.game.hidden) return false;
    const W = el.board.clientWidth, H = el.board.clientHeight;
    if (!W || !H) return false;
    el.board.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const ground = H - 30, top = 58, side = 26, gap = Math.max(34, W * 0.07);
    const p = pair();
    const rb = boxOf(p.ref, p.ref.size);
    const gb = boxOf(p.tgt, guessSize());
    const tb = boxOf(p.tgt, p.tgt.size);
    const reveal = S.phase === 'reveal';
    const tw = reveal ? Math.max(gb.w, tb.w) : gb.w;
    const th = reveal ? Math.max(gb.h, tb.h) : gb.h;
    // Zoom depends only on the reference and the current guess (and the truth after lock-in),
    // so it never gives the answer away.
    const want = Math.min((ground - top) / Math.max(rb.h, th), (W - 2 * side - gap) / (rb.w + tw));
    S.scale = S.scale == null ? want : S.scale + (want - S.scale) * 0.22;
    const animating = Math.abs(want - S.scale) / want > 0.001;
    const s = S.scale;
    const totalW = (rb.w + tw) * s + gap;
    const xr = Math.max(side, (W - totalW) / 2);
    const xt = xr + rb.w * s + gap;

    el.earth.setAttribute('x', 0); el.earth.setAttribute('y', ground); el.earth.setAttribute('width', W); el.earth.setAttribute('height', H - ground);
    el.ground.setAttribute('x1', 0); el.ground.setAttribute('x2', W);
    el.ground.setAttribute('y1', ground); el.ground.setAttribute('y2', ground);
    place(el.refG, p.ref, xr, ground, rb, s);
    place(el.guessG, p.tgt, xt, ground, gb, s);
    measure(el.refM, p.ref, xr, ground, rb, s, fmtLen(p.ref.size), 0, W);
    measure(el.guessM, p.tgt, xt, ground, gb, s, fmtLen(guessSize()), 0, W);
    if (reveal) {
      place(el.trueG, p.tgt, xt, ground, tb, s);
      const gTop = ground - gb.h * s, tTop = ground - tb.h * s;
      const lift = Math.abs(gTop - tTop) < 28 ? 26 : 0;
      const trueHigher = tTop <= gTop;
      measure(el.trueM, p.tgt, xt, ground, tb, s, `Real: ${fmtLen(p.tgt.size)}`, trueHigher ? lift : 0, W);
      if (lift && !trueHigher) measure(el.guessM, p.tgt, xt, ground, gb, s, fmtLen(guessSize()), lift, W);
    }
    const nameY = ground + 19;
    el.refName.setAttribute('x', Math.min(W - 70, Math.max(70, xr + rb.w * s / 2)));
    el.refName.setAttribute('y', nameY);
    el.refName.textContent = p.ref.name;
    el.tgtName.setAttribute('x', Math.min(W - 70, Math.max(70, xt + tw * s / 2)));
    el.tgtName.setAttribute('y', nameY);
    el.tgtName.textContent = p.tgt.name;
    return animating;
  }
  (function loop() {
    if (S.dirty) S.dirty = draw();
    requestAnimationFrame(loop);
  })();

  // ---------- Input ----------
  function setLr(v) {
    if (S.phase !== 'guess') return;
    S.lr = Math.max(-LOG_RANGE, Math.min(LOG_RANGE, v));
    el.slider.value = S.lr;
    S.dirty = true;
  }
  el.slider.addEventListener('input', () => setLr(parseFloat(el.slider.value)));
  el.minusBtn.addEventListener('click', () => setLr(S.lr - 0.02));
  el.plusBtn.addEventListener('click', () => setLr(S.lr + 0.02));
  el.lockBtn.addEventListener('click', lock);
  el.nextBtn.addEventListener('click', next);

  let drag = null;
  el.board.addEventListener('pointerdown', e => {
    if (S.phase !== 'guess') return;
    drag = { x: e.clientX, y: e.clientY };
    el.board.setPointerCapture(e.pointerId);
    el.dragHint.hidden = true;
  });
  el.board.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    setLr(S.lr + (dx - dy) * 0.006);
  });
  el.board.addEventListener('pointerup', () => { drag = null; });
  el.board.addEventListener('pointercancel', () => { drag = null; });
  el.board.addEventListener('wheel', e => {
    if (S.phase !== 'guess') return;
    e.preventDefault();
    setLr(S.lr - e.deltaY * 0.0015);
  }, { passive: false });

  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'range') return;
    if (document.querySelector('dialog[open]')) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    if (S.phase === 'guess') {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setLr(S.lr + step); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setLr(S.lr - step); }
      else if (e.key === 'Enter') { e.preventDefault(); lock(); }
    } else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
  });

  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.challengeBtn.addEventListener('click', () => {
    const by = el.nameInput.value.trim() || 'A friend';
    share(`${GAME.name}: ${by} scored ${total()}/1000 on this set. Can you beat it?\n${challengeUrl()}`);
  });
  el.againBtn.addEventListener('click', () => {
    if (S.mode === 'challenge') { history.replaceState(null, '', location.pathname); start('daily'); }
    else {
      if (S.mode === 'catdaily') { S.cat = S.dcat; el.catSelect.value = S.cat; store.set('sg_howbig_cat', S.cat); history.replaceState(null, '', location.pathname); }
      start('unlimited');
    }
  });
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
    SG.leaveArchive();
    if (S.mode === 'challenge' || S.mode === 'catdaily') history.replaceState(null, '', location.pathname);
    start(b.dataset.mode);
  }));
  el.catSelect.addEventListener('change', () => {
    S.cat = el.catSelect.value;
    store.set('sg_howbig_cat', S.cat);
    start('unlimited');
  });
  SG.onUnits(() => { S.dirty = true; if (S.phase === 'reveal') renderReveal(); });
  helpBtn.addEventListener('click', () => el.helpDlg.showModal());
  statsBtn.addEventListener('click', () => {
    const rec = loadDaily('daily');
    const st = streakInfo(rec);
    const totals = st.keys.map(k => rec[k].scores.reduce((a, b) => a + b, 0));
    const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
    el.statsGrid.innerHTML = [
      [totals.length, 'Played'], [avg, 'Average'], [totals.length ? Math.max(...totals) : 0, 'Best'], [st.cur, 'Streak'], [st.max, 'Max streak']
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    el.statsDlg.showModal();
  });
  new ResizeObserver(() => { S.dirty = true; }).observe(el.board);

  // ---------- Boot ----------
  const q = new URLSearchParams(location.search);
  if (q.get('c')) {
    const vs = Math.max(0, Math.min(1000, parseInt(q.get('vs'), 10) || 0));
    const cat = CATEGORIES.some(c => c.id === q.get('k')) ? q.get('k') : 'all';
    start('challenge', { seed: q.get('c').slice(0, 40), cat, challenge: { vs, by: (q.get('by') || '').slice(0, 20) } });
  } else if (CATEGORIES.some(c => c.id !== 'all' && c.id === q.get('daily'))) {
    start('catdaily', { cat: q.get('daily') });
  } else {
    // ?mode=unlimited&cat=animals opens Unlimited in that category
    if (CATEGORIES.some(c => c.id === q.get('cat'))) { S.cat = q.get('cat'); el.catSelect.value = S.cat; store.set('sg_howbig_cat', S.cat); }
    start(q.get('mode') === 'unlimited' ? 'unlimited' : 'daily');
  }
  window.__howbig = { S, makePairs, scoreFor };
})();

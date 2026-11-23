(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, fmtLen, esc, share, shapeSvg, boxOf } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'fit');
  const ROUNDS = 5;
  const MAX_PER_ROUND = 200;
  const MIN_N = 2, MAX_N = 120;          // how many copies a puzzle may need
  const SLIDER_MAX = 500;                // the slider runs from 1 to this, on a log scale
  const FULL_MARKS = Math.log(1.05);     // within 5% = full points
  const ZERO_MARKS = Math.log(4);        // 4x off = zero
  const KEY = 'sg_fit_daily';

  SG.header('fit');
  SG.measureShapes(OBJECTS);

  // ---------- Puzzles ----------
  // Two things measured the same way (both heights, both lengths or both widths)
  const PAIRS = [];
  for (const big of OBJECTS) for (const small of OBJECTS) {
    if (big === small || big.dim !== small.dim) continue;
    const n = big.size / small.size;
    if (n >= MIN_N && n <= MAX_N) PAIRS.push({ big, small, n });
  }
  function makeRounds(seed) {
    const r = rng(seed), used = new Set(), out = [];
    for (let g = 0; out.length < ROUNDS && g < 5000; g++) {
      const p = PAIRS[Math.floor(r() * PAIRS.length)];
      if (used.has(p.big.id) || used.has(p.small.id)) continue;
      // a mix of small and large counts
      const band = out.length % 3, logN = Math.log10(p.n);
      if ((band === 0 && logN > 1) || (band === 1 && (logN < 0.8 || logN > 1.6)) || (band === 2 && logN < 1.3)) continue;
      used.add(p.big.id); used.add(p.small.id);
      out.push({ ...p, start: 0.25 + r() * 0.4 });
    }
    return out;
  }
  function scoreFor(guess, truth) {
    const err = Math.abs(Math.log(guess / truth));
    const f = Math.min(1, Math.max(0, (err - FULL_MARKS) / (ZERO_MARKS - FULL_MARKS)));
    return Math.round(MAX_PER_ROUND * (1 - f) * (1 - f));
  }
  const block = s => s >= 180 ? '🟩' : s >= 120 ? '🟨' : s >= 60 ? '🟧' : '🟥';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const VERB = {
    h: (s, b) => `Stack copies of ${s} on top of each other. How many reach the top of ${b}?`,
    l: (s, b) => `Line up copies of ${s} end to end. How many match the length of ${b}?`,
    d: (s, b) => `Line up copies of ${s} side by side. How many match the width of ${b}?`
  };
  const MEASURE = { h: 'tall', l: 'long', d: 'wide' };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), pips: $('pips'), scoreInfo: $('scoreInfo'), prompt: $('prompt'), sub: $('sub'),
    cards: $('cards'), scene: $('scene'), bigNum: $('bigNum'),
    controls: $('controls'), slider: $('slider'), minusBtn: $('minusBtn'), plusBtn: $('plusBtn'), typeInput: $('typeInput'), lockBtn: $('lockBtn'),
    reveal: $('reveal'), revealPts: $('revealPts'), revealNums: $('revealNums'), revealMeter: $('revealMeter'), revealFact: $('revealFact'), nextBtn: $('nextBtn'),
    resKicker: $('resKicker'), resRank: $('resRank'), resTotal: $('resTotal'), resBlocks: $('resBlocks'), resRows: $('resRows'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn'), countdown: $('countdown')
  };
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  tools.append(streakEl, SG.unitButton());

  // ---------- State ----------
  const S = { mode: 'daily', date: '', rounds: [], i: 0, t: 0.5, guess: 1, scores: [], guesses: [], phase: 'guess' };
  const loadDaily = () => store.get(KEY, {});
  const round = () => S.rounds[S.i];
  const total = () => S.scores.reduce((a, b) => a + b, 0);

  function start(mode, seed) {
    S.mode = mode;
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    S.seed = mode === 'daily' ? '' : seed || randomSeed();
    S.rounds = makeRounds(mode === 'daily' ? 'fit-' + S.date : S.seed);
    S.i = 0; S.scores = []; S.guesses = [];
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
    const rd = round();
    S.phase = 'guess';
    el.prompt.textContent = VERB[rd.big.dim](SG.theNoun(rd.small), SG.theNoun(rd.big));
    // not to scale while guessing: two cards side by side
    el.cards.hidden = false;
    el.scene.hidden = true;
    el.cards.innerHTML = [[rd.small, 'oa', 'One of these'], [rd.big, 'ob', 'Has to match this']].map(([o, cls, cap]) =>
      `<div class="hf-card"><span class="hf-cap">${cap}</span><span class="hf-art">${shapeSvg(o, 'hf-fig ' + cls)}</span><b>${esc(o.name)}</b></div>`).join('<span class="hf-x">×&nbsp;?</span>');
    el.controls.hidden = false;
    el.reveal.hidden = true;
    el.typeInput.value = '';
    setT(rd.start);
    renderPips();
    el.scoreInfo.textContent = total();
  }

  const valueAt = t => Math.pow(SLIDER_MAX, t);
  function setT(t) {
    S.t = Math.min(1, Math.max(0, t));
    const v = valueAt(S.t);
    S.guess = v < 10 ? Math.round(v * 2) / 2 : Math.round(v);
    el.slider.value = Math.round(S.t * 1000);
    el.bigNum.textContent = S.guess.toLocaleString('en');
  }
  function setGuess(v) {
    S.guess = v;
    S.t = Math.min(1, Math.max(0, Math.log(v) / Math.log(SLIDER_MAX)));
    el.slider.value = Math.round(S.t * 1000);
    el.bigNum.textContent = v.toLocaleString('en');
  }

  function lock() {
    if (S.phase !== 'guess') return;
    const typed = el.typeInput.value.trim();
    if (typed) {
      const v = parseFloat(typed.replace(/,/g, ''));
      if (!(v > 0)) { SG.toast('Type a number, like 12'); el.typeInput.focus(); return; }
      setGuess(v);
    }
    const rd = round();
    const sc = scoreFor(S.guess, rd.n);
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
    renderPips();
    updateChrome();
    if (sc >= 190) SG.confetti(40);
    el.nextBtn.focus({ preventScroll: true });
  }

  // True-scale picture: the big thing, and the right number of copies stacked or lined up beside it
  function drawScene(rd) {
    const W = Math.max(300, Math.round(el.scene.clientWidth || 600)), H = rd.big.dim === 'h' ? 300 : 220, pad = 18;
    const bb = boxOf(rd.big), sb = boxOf(rd.small);
    const full = Math.floor(rd.n + 1e-9), frac = rd.n - full;
    const place = (o, x, y, w, h, cls) => shapeSvg(o, cls).replace('<svg ', `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="none" `);
    let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${rd.n.toFixed(1)} copies of ${rd.small.name} next to ${rd.big.name}`)}">`;
    if (rd.big.dim === 'h') {
      // stack upwards next to the big thing
      const s = (H - 2 * pad - 14) / rd.big.size;
      const ground = H - pad - 14;
      const bw = bb.w * s, sw = sb.w * s, sh = sb.h * s;
      const gap = 16, totalW = bw + gap + sw;
      const x0 = Math.max(pad, (W - totalW) / 2);
      out += place(rd.big, x0, ground - bb.h * s, bw, bb.h * s, 'pfig ob');
      for (let k = 0; k < full; k++) out += place(rd.small, x0 + bw + gap, ground - (k + 1) * sh, sw, sh, `pfig oa ${k % 2 ? 'alt' : ''}`);
      if (frac > 0.05) out += `<rect x="${(x0 + bw + gap).toFixed(1)}" y="${(ground - full * sh - frac * sh).toFixed(1)}" width="${sw.toFixed(1)}" height="${(frac * sh).toFixed(1)}" class="hf-part"/>`;
      out += `<line x1="0" x2="${W}" y1="${ground}" y2="${ground}" stroke="var(--edge)" stroke-width="2.5"/>`;
      out += `<line x1="${x0 - 4}" x2="${x0 + totalW + 4}" y1="${ground - rd.big.size * s}" y2="${ground - rd.big.size * s}" class="hf-top"/>`;
    } else {
      // a row of copies under the big thing
      // one scale for both, so the row of copies is exactly as long as the big thing
      const s = Math.min((W - 2 * pad) / rd.big.size, (H * 0.55) / bb.h);
      const bw = rd.big.size * s, bh = bb.h * s, sw = sb.w * s, sh = sb.h * s;
      const x0 = (W - bw) / 2, rowY = pad + bh + 16;
      out += place(rd.big, x0, pad, bw, bh, 'pfig ob');
      for (let k = 0; k < full; k++) out += place(rd.small, x0 + k * sw, rowY, sw, sh, `pfig oa ${k % 2 ? 'alt' : ''}`);
      if (frac > 0.05) out += `<rect x="${(x0 + full * sw).toFixed(1)}" y="${rowY.toFixed(1)}" width="${(frac * sw).toFixed(1)}" height="${Math.max(sh, 4).toFixed(1)}" class="hf-part"/>`;
      const y2 = rowY + Math.max(sh, 4) + 6;
      out += `<line x1="${x0}" x2="${x0}" y1="${pad - 6}" y2="${y2}" class="hf-top"/><line x1="${x0 + bw}" x2="${x0 + bw}" y1="${pad - 6}" y2="${y2}" class="hf-top"/>`;
      out = out.replace(`viewBox="0 0 ${W} ${H}"`, `viewBox="0 0 ${W} ${Math.ceil(y2 + pad)}"`);
    }
    return out + '</svg>';
  }

  function renderReveal() {
    const rd = round(), sc = S.scores[S.i], g = S.guesses[S.i];
    el.cards.hidden = true;
    el.scene.hidden = false;
    el.scene.innerHTML = drawScene(rd);
    const n = rd.n < 10 ? rd.n.toFixed(1) : Math.round(rd.n);
    const off = g / rd.n;
    const verdict = Math.abs(Math.log(off)) <= FULL_MARKS ? 'Spot on!' : off >= 2 ? `${off.toFixed(1)}× too many` : 1 / off >= 2 ? `${(1 / off).toFixed(1)}× too few`
      : off > 1 ? `${Math.round((off - 1) * 100)}% too many` : `${Math.round((1 - off) * 100)}% too few`;
    el.revealPts.innerHTML = `+${sc}<small>points</small>`;
    el.revealPts.style.color = sc >= 180 ? 'var(--true)' : sc >= 60 ? 'var(--guess-deep)' : 'var(--bad)';
    el.revealNums.innerHTML = `<b>${verdict}</b> · Real: <b>about ${n}</b> · You: <b>${g.toLocaleString('en')}</b>`;
    el.revealMeter.style.width = '0%';
    requestAnimationFrame(() => { el.revealMeter.style.width = (sc / MAX_PER_ROUND * 100) + '%'; });
    const m = MEASURE[rd.big.dim];
    SG.setFact(el.revealFact, `${cap(SG.theNoun(rd.big))} is ${fmtLen(rd.big.size)} ${m}, and ${SG.theNoun(rd.small)} is ${fmtLen(rd.small.size)}.`, rd.big.src);
    el.nextBtn.textContent = S.i >= ROUNDS - 1 ? 'See result' : 'Next round';
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

  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    const tot = total();
    el.resKicker.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)}` : 'Unlimited';
    el.resRank.textContent = SG.rankFor(tot, ROUNDS * MAX_PER_ROUND);
    el.resTotal.textContent = tot;
    el.resBlocks.textContent = S.scores.map(block).join('');
    el.resRows.innerHTML = S.rounds.map((rd, i) => {
      const sc = S.scores[i] ?? 0;
      return `<li><span>${esc(rd.small.name)} → ${esc(rd.big.name)}<br><small class="c-true">about ${rd.n < 10 ? rd.n.toFixed(1) : Math.round(rd.n)}</small> <small class="c-guess">· you said ${S.guesses[i] ?? '–'}</small></span><span class="bar"><i style="width:${sc / MAX_PER_ROUND * 100}%"></i></span><b>${sc}</b></li>`;
    }).join('');
    el.againBtn.textContent = S.mode === 'daily' ? 'Play Unlimited' : 'Play again';
    if (tot >= 800) SG.confetti();
    SG.vsResult(el.result, S, tot);
    if (S.mode === 'daily') SG.board.show('fit', S.date, el.result);
    tick();
    updateChrome();
  }
  function shareText() {
    const head = S.mode === 'daily' ? `${GAME.name} #${dayNumber(S.date)}` : `${GAME.name} Unlimited`;
    return SG.challengeText(`${head}: ${total()}/1000`, S.scores.map(block).join(''), SG.challengeUrl({ mode: S.mode, date: S.date, seed: S.seed, score: total() }));
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
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · 5 rounds · same for everyone` : 'Unlimited · fresh puzzles every game';
    SG.vsBanner(S, '/1000');
  }

  // ---------- Input ----------
  el.slider.addEventListener('input', () => { el.typeInput.value = ''; setT(el.slider.value / 1000); });
  const nudge = d => { if (S.phase !== 'guess') return; el.typeInput.value = ''; setT(S.t + d); };
  el.minusBtn.addEventListener('click', () => nudge(-0.01));
  el.plusBtn.addEventListener('click', () => nudge(0.01));
  el.typeInput.addEventListener('input', () => { if (S.phase !== 'guess') return; const v = parseFloat(el.typeInput.value.replace(/,/g, '')); if (v > 0) setGuess(v); });
  el.typeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lock(); } });
  el.lockBtn.addEventListener('click', lock);
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.againBtn.addEventListener('click', () => start('unlimited'));
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { SG.leaveArchive(); start(b.dataset.mode); }));
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'range') return;
    if (S.phase === 'guess') {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); nudge(step); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step); }
      else if (e.key === 'Enter') { e.preventDefault(); lock(); }
    } else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
  });
  SG.onUnits(() => { if (S.phase === 'reveal') renderReveal(); });

  start(new URLSearchParams(location.search).get('mode') === 'unlimited' ? 'unlimited' : 'daily', SG.vs && SG.vs.seed);
  window.__fit = { S, PAIRS, makeRounds, scoreFor };
})();

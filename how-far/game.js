(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, esc, share } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'far');
  const ROUNDS = 5;
  const MAX_PER_ROUND = 200;
  const MIN_KM = 50, MAX_KM = 20000;       // slider range, log scale, the same for every puzzle
  const FULL_MARKS = Math.log(1.05);       // within 5% = full points
  const ZERO_MARKS = Math.log(3);          // 3x off = zero
  const KEY = 'sg_far_daily';
  const JET_KMH = 900;

  SG.header('far');

  // ---------- Geography ----------
  const R_EARTH = 6371;
  const rad = d => d * Math.PI / 180;
  function distKm(a, b) {
    const p = rad(b.lat - a.lat), q = rad(b.lon - a.lon);
    const h = Math.sin(p / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(q / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.sqrt(h));
  }
  const IN = CITIES.filter(c => c.region === 'in');
  // The lower 48 states (Honolulu and Anchorage only appear in world rounds)
  const US = CITIES.filter(c => (c.region === 'us' || c.country === 'us') && c.lat < 50 && c.lon > -126);
  const WORLD = CITIES;   // world rounds may use Indian cities too
  // Map frames: [minLon, maxLon, minLat, maxLat]
  const FRAMES = { in: [67, 98, 6, 37.5], us: [-126, -66, 24, 50], w: [-170, 180, -50, 70] };
  const POOLS = { in: IN, us: US, w: WORLD };
  const NEW_MIX = '2026-11-24';   // from this day the Daily is 2 India + 2 USA + 1 world

  // ---------- Puzzles ----------
  function pickPair(r, pool, min, max, used) {
    for (let g = 0; g < 3000; g++) {
      const a = pool[Math.floor(r() * pool.length)], b = pool[Math.floor(r() * pool.length)];
      if (a === b || used.has(a.id) || used.has(b.id)) continue;
      const d = distKm(a, b);
      if (d < min || d > max) continue;
      used.add(a.id); used.add(b.id);
      return { a, b, km: d };
    }
    return null;
  }
  function makeRounds(seed, scope) {
    const r = rng(seed), used = new Set(), out = [];
    // Daily: two Indian pairs, two US pairs and one world pair (before NEW_MIX: three Indian, two world).
    // Unlimited can pick one region, or the mix.
    const mixed = SG.playDate() >= NEW_MIX && US.length >= 6 ? ['in', 'in', 'us', 'us', 'w'] : ['in', 'in', 'in', 'w', 'w'];
    const plan = POOLS[scope] && scope !== 'mix' ? [scope, scope, scope, scope, scope] : mixed;
    for (const kind of plan) {
      const p = kind === 'w' ? pickPair(r, WORLD, 1200, 19000, used) : pickPair(r, POOLS[kind], 200, 4500, used);
      if (p) out.push({ ...p, frame: kind, start: 0.3 + r() * 0.4 });
    }
    return out;
  }
  function scoreFor(guess, truth) {
    const err = Math.abs(Math.log(guess / truth));
    const f = Math.min(1, Math.max(0, (err - FULL_MARKS) / (ZERO_MARKS - FULL_MARKS)));
    return Math.round(MAX_PER_ROUND * (1 - f) * (1 - f));
  }
  const block = s => s >= 180 ? '🟩' : s >= 120 ? '🟨' : s >= 60 ? '🟧' : '🟥';

  // ---------- Units ----------
  const MI = 0.621371;
  const imperial = () => SG.units === 'imperial';
  const unitName = () => imperial() ? 'miles' : 'km';
  const toUnit = km => imperial() ? km * MI : km;
  const fromUnit = v => imperial() ? v / MI : v;
  const nice = v => v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
  const fmtDist = km => `${nice(toUnit(km)).toLocaleString('en')} ${unitName()}`;

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), pips: $('pips'), scoreInfo: $('scoreInfo'), prompt: $('prompt'), sub: $('sub'),
    map: $('map'), bigNum: $('bigNum'), bigUnit: $('bigUnit'), scope: $('scope'), scopeWrap: $('scopeWrap'),
    controls: $('controls'), slider: $('slider'), minusBtn: $('minusBtn'), plusBtn: $('plusBtn'), typeInput: $('typeInput'), lockBtn: $('lockBtn'),
    reveal: $('reveal'), revealPts: $('revealPts'), revealNums: $('revealNums'), revealMeter: $('revealMeter'), revealFact: $('revealFact'), nextBtn: $('nextBtn'),
    resKicker: $('resKicker'), resRank: $('resRank'), resTotal: $('resTotal'), resBlocks: $('resBlocks'), resRows: $('resRows'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn'), countdown: $('countdown')
  };
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  const unitBtn = SG.unitButton();
  tools.append(streakEl, unitBtn);

  // ---------- State ----------
  const S = { mode: 'daily', date: '', rounds: [], i: 0, t: 0.5, guessKm: 1000, scores: [], guesses: [], phase: 'guess', scope: store.get('sg_far_scope', 'mix') };
  if (US.length < 6 && S.scope === 'us') S.scope = 'mix';   // the US cities join on NEW_MIX
  if (US.length < 6) el.scope.querySelector('option[value="us"]').remove();
  el.scope.value = S.scope;
  const loadDaily = () => store.get(KEY, {});
  const round = () => S.rounds[S.i];
  const total = () => S.scores.reduce((a, b) => a + b, 0);

  function start(mode, seed) {
    S.mode = mode;
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    const sm = /^(mix|in|us|w)-/.exec(seed || '');
    if (mode !== 'daily' && sm && sm[1] !== S.scope) { S.scope = sm[1]; el.scope.value = S.scope; }
    S.seed = mode === 'daily' ? '' : sm ? seed : `${S.scope}-${randomSeed()}`;
    S.rounds = makeRounds(mode === 'daily' ? 'far-' + S.date : S.seed, mode === 'daily' ? 'mix' : S.scope);
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
    el.prompt.innerHTML = `How far is it from <span class="c-ref">${esc(rd.a.name)}</span> to <span class="c-guess">${esc(rd.b.name)}</span>, in a straight line?`;
    el.controls.hidden = false;
    el.reveal.hidden = true;
    el.typeInput.value = '';
    setT(rd.start);
    drawMap();
    renderPips();
    el.scoreInfo.textContent = total();
  }

  // the slider works in km on a log scale; the display follows the unit setting
  const kmAt = t => MIN_KM * Math.pow(MAX_KM / MIN_KM, t);
  function setT(t) {
    S.t = Math.min(1, Math.max(0, t));
    S.guessKm = fromUnit(nice(toUnit(kmAt(S.t))));
    el.slider.value = Math.round(S.t * 1000);
    renderGuess();
  }
  function setGuessKm(km) {
    S.guessKm = km;
    S.t = Math.min(1, Math.max(0, Math.log(km / MIN_KM) / Math.log(MAX_KM / MIN_KM)));
    el.slider.value = Math.round(S.t * 1000);
    renderGuess(true);
  }
  function renderGuess(exact) {
    const v = toUnit(S.guessKm);
    el.bigNum.textContent = (exact ? Math.round(v) : nice(v)).toLocaleString('en');
    el.bigUnit.textContent = unitName();
  }

  // A plain "dot map": every city in the frame as a faint dot, the two cities of the round highlighted
  function drawMap() {
    const rd = round(), [x0, x1, y0, y1] = FRAMES[rd.frame];
    const midLat = rad((y0 + y1) / 2), kx = rd.frame === 'w' ? 1 : Math.cos(midLat);
    const W = rd.frame === 'in' ? 380 : rd.frame === 'us' ? 560 : 640;
    const H = Math.round(W * (y1 - y0) / ((x1 - x0) * kx));
    const pad = 14;
    const px = c => pad + (c.lon - x0) / (x1 - x0) * (W - 2 * pad);
    const py = c => pad + (y1 - c.lat) / (y1 - y0) * (H - 2 * pad);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Map dots for ${rd.a.name} and ${rd.b.name}`)}">`;
    const step = rd.frame === 'w' ? 30 : rd.frame === 'us' ? 10 : 5;
    for (let lon = Math.ceil(x0 / step) * step; lon <= x1; lon += step) s += `<line x1="${px({ lon })}" x2="${px({ lon })}" y1="${pad}" y2="${H - pad}" class="hw-grid"/>`;
    for (let lat = Math.ceil(y0 / step) * step; lat <= y1; lat += step) s += `<line x1="${pad}" x2="${W - pad}" y1="${py({ lat })}" y2="${py({ lat })}" class="hw-grid${lat === 0 ? ' eq' : ''}"/>`;
    const pool = POOLS[rd.frame] || WORLD;
    for (const c of pool) if (c !== rd.a && c !== rd.b) s += `<circle cx="${px(c).toFixed(1)}" cy="${py(c).toFixed(1)}" r="2.5" class="hw-dot"><title>${esc(c.name)}</title></circle>`;
    const A = [px(rd.a), py(rd.a)], B = [px(rd.b), py(rd.b)];
    const shown = S.phase === 'reveal';
    s += `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" class="hw-line${shown ? ' on' : ''}"/>`;
    const label = (P, c, cls) => {
      const anchor = P[0] > W * 0.75 ? 'end' : P[0] < W * 0.25 ? 'start' : 'middle';
      return `<circle cx="${P[0].toFixed(1)}" cy="${P[1].toFixed(1)}" r="7" class="hw-city ${cls}"/><text x="${P[0].toFixed(1)}" y="${(P[1] - 12).toFixed(1)}" text-anchor="${anchor}" class="hw-label">${esc(c.name)}</text>`;
    };
    s += label(A, rd.a, 'a') + label(B, rd.b, 'b');
    if (shown) {
      const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      s += `<text x="${m[0].toFixed(1)}" y="${(m[1] + 20).toFixed(1)}" text-anchor="middle" class="hw-km">${esc(fmtDist(rd.km))}</text>`;
    }
    el.map.innerHTML = s + '</svg>';
  }

  function lock() {
    if (S.phase !== 'guess') return;
    const typed = el.typeInput.value.trim();
    if (typed) {
      const v = parseFloat(typed.replace(/,/g, ''));
      if (!(v > 0)) { SG.toast('Type a distance, like 1200'); el.typeInput.focus(); return; }
      setGuessKm(fromUnit(v));
    }
    const rd = round();
    const sc = scoreFor(S.guessKm, rd.km);
    S.scores.push(sc);
    S.guesses.push(Math.round(S.guessKm));
    S.phase = 'reveal';
    if (S.mode === 'daily') {
      const d = loadDaily();
      d[S.date] = { scores: S.scores.slice(), guesses: S.guesses.slice(), done: S.scores.length >= ROUNDS, ...SG.lateFlag() };
      store.set(KEY, d);
    }
    el.controls.hidden = true;
    el.reveal.hidden = false;
    el.scoreInfo.textContent = total();
    drawMap();
    renderReveal();
    renderPips();
    updateChrome();
    if (sc >= 190) SG.confetti(40);
    el.nextBtn.focus({ preventScroll: true });
  }

  function renderReveal() {
    const rd = round(), sc = S.scores[S.i], g = S.guesses[S.i];
    const off = g / rd.km;
    const verdict = Math.abs(Math.log(off)) <= FULL_MARKS ? 'Spot on!' : off >= 2 ? `${off.toFixed(1)}× too far` : 1 / off >= 2 ? `${(1 / off).toFixed(1)}× too short`
      : off > 1 ? `${Math.round((off - 1) * 100)}% too far` : `${Math.round((1 - off) * 100)}% too short`;
    el.revealPts.innerHTML = `+${sc}<small>points</small>`;
    el.revealPts.style.color = sc >= 180 ? 'var(--true)' : sc >= 60 ? 'var(--guess-deep)' : 'var(--bad)';
    el.revealNums.innerHTML = `<b>${verdict}</b> · Real: <b>${esc(fmtDist(rd.km))}</b> · You: <b>${esc(fmtDist(g))}</b>`;
    el.revealMeter.style.width = '0%';
    requestAnimationFrame(() => { el.revealMeter.style.width = (sc / MAX_PER_ROUND * 100) + '%'; });
    const h = rd.km / JET_KMH;
    const flight = h < 1 ? `about ${Math.max(5, Math.round(h * 60 / 5) * 5)} minutes` : `about ${h < 3 ? (Math.round(h * 2) / 2) : Math.round(h)} hours`;
    el.revealFact.textContent = `That's the straight-line distance, as the crow flies. A jet cruising at ${imperial() ? '560 mph' : '900 km/h'} would cover it in ${flight}. Roads and real routes are longer.`;
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
      return `<li><span>${esc(rd.a.name)} → ${esc(rd.b.name)}<br><small class="c-true">${esc(fmtDist(rd.km))}</small> <small class="c-guess">· you said ${S.guesses[i] != null ? esc(fmtDist(S.guesses[i])) : '–'}</small></span><span class="bar"><i style="width:${sc / MAX_PER_ROUND * 100}%"></i></span><b>${sc}</b></li>`;
    }).join('');
    el.againBtn.textContent = S.mode === 'daily' ? 'Play Unlimited' : 'Play again';
    if (tot >= 800) SG.confetti();
    SG.vsResult(el.result, S, tot);
    if (S.mode === 'daily') SG.board.show('far', S.date, el.result);
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
    el.scopeWrap.hidden = S.mode !== 'unlimited';
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · ${S.rounds.some(r => r.frame === 'us') ? '2 in India, 2 in the USA, 1 around the world' : '3 in India, 2 around the world'}` : 'Unlimited · fresh city pairs every game';
    SG.vsBanner(S, '/1000');
  }

  // ---------- Input ----------
  el.slider.addEventListener('input', () => { el.typeInput.value = ''; setT(el.slider.value / 1000); });
  const nudge = d => { if (S.phase !== 'guess') return; el.typeInput.value = ''; setT(S.t + d); };
  el.minusBtn.addEventListener('click', () => nudge(-0.01));
  el.plusBtn.addEventListener('click', () => nudge(0.01));
  el.typeInput.addEventListener('input', () => { if (S.phase !== 'guess') return; const v = parseFloat(el.typeInput.value.replace(/,/g, '')); if (v > 0) setGuessKm(fromUnit(v)); });
  el.typeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lock(); } });
  el.lockBtn.addEventListener('click', lock);
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.againBtn.addEventListener('click', () => start('unlimited'));
  el.scope.addEventListener('change', () => { S.scope = el.scope.value; store.set('sg_far_scope', S.scope); start('unlimited'); });
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
  SG.onUnits(() => {
    el.typeInput.placeholder = imperial() ? 'e.g. 700' : 'e.g. 1200';
    if (S.phase === 'guess') renderGuess(); else if (S.phase === 'reveal') { drawMap(); renderReveal(); }
  });

  start(new URLSearchParams(location.search).get('mode') === 'unlimited' ? 'unlimited' : 'daily', SG.vs && SG.vs.seed);
  window.__far = { S, makeRounds, distKm, scoreFor };
})();

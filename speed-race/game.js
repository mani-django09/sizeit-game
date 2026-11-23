(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, esc, share } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'speed');
  const DAILY_Q = 8;
  const KEY = 'sg_speed_daily';
  const BEST_KEY = 'sg_speed_best';
  const MIN_RATIO = 1.3;               // speeds vary, so never race two things closer than this
  const RACE_MS = 1800;
  const GAP_NAMES = ['a little faster', 'a lot faster', 'way faster'];

  SG.header('speed');

  // ---------- Speeds ----------
  const ratioOf = (a, b) => Math.max(a.kmh / b.kmh, b.kmh / a.kmh);
  const gapOf = r => r < 2 ? 0 : r <= 10 ? 1 : 2;
  // keep clear of the 2x and 10x boundaries so the gap answer is never a coin toss
  const clearOfEdges = r => !(r > 1.8 && r < 2.2) && !(r > 9 && r < 11);
  function fmtSpeed(kmh) {
    const imperial = SG.units === 'imperial';
    const v = imperial ? kmh * 0.621371 : kmh;
    const unit = imperial ? 'mph' : 'km/h';
    const n = v < 1 ? Number(v.toPrecision(2)) : v < 100 ? Number(v.toPrecision(3)) : Math.round(v).toLocaleString('en');
    return `${n} ${unit}`;
  }
  // "a cheetah" → "the cheetah" once it has been introduced; names like "Usain Bolt" stay as they are
  const theOf = o => o.as.replace(/^an? /, 'the ');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const times = r => r < 10 ? r.toFixed(1) : Number(r.toPrecision(2)).toLocaleString('en');

  function dailyRaces(seed) {
    const r = rng(seed);
    // a mix of close, medium and huge gaps, in a shuffled order
    const want = [0, 1, 2, 0, 1, 2, 0, 1];
    for (let i = want.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [want[i], want[j]] = [want[j], want[i]]; }
    const uses = {};
    return want.map(g => {
      for (let guard = 0; guard < 4000; guard++) {
        const a = RACERS[Math.floor(r() * RACERS.length)], b = RACERS[Math.floor(r() * RACERS.length)];
        const ra = ratioOf(a, b);
        if (a === b || ra < MIN_RATIO || !clearOfEdges(ra) || gapOf(ra) !== g) continue;
        if ((uses[a.id] || 0) >= 2 || (uses[b.id] || 0) >= 2) continue;
        uses[a.id] = (uses[a.id] || 0) + 1; uses[b.id] = (uses[b.id] || 0) + 1;
        return [a, b];
      }
      return [RACERS[0], RACERS[RACERS.length - 1]];
    });
  }
  // Endless: the allowed gap shrinks as the streak grows
  const endlessMax = streak => Math.max(1.7, 60 / (1 + streak * 0.5));
  function endlessRace(r, streak, recent) {
    for (let guard = 0; guard < 4000; guard++) {
      const a = RACERS[Math.floor(r() * RACERS.length)], b = RACERS[Math.floor(r() * RACERS.length)];
      const ra = ratioOf(a, b);
      if (a === b || ra < MIN_RATIO || ra > endlessMax(streak) || recent.includes(a.id) || recent.includes(b.id)) continue;
      return [a, b];
    }
    let a, b;
    do { a = RACERS[Math.floor(r() * RACERS.length)]; b = RACERS[Math.floor(r() * RACERS.length)]; } while (a === b || ratioOf(a, b) < MIN_RATIO);
    return [a, b];
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), progress: $('progress'), scoreLine: $('scoreLine'), prompt: $('prompt'), sub: $('sub'),
    track: $('track'), racers: [$('racerA'), $('racerB')], speeds: [$('speedA'), $('speedB')],
    gapBox: $('gapBox'), gapQ: $('gapQ'), hint: $('hint'),
    reveal: $('reveal'), verdict: $('verdict'), ratio: $('ratio'), fact: $('fact'), nextBtn: $('nextBtn'), dots: $('dots'),
    resTitle: $('resTitle'), resRank: $('resRank'), resTotal: $('resTotal'), resOf: $('resOf'), resBlocks: $('resBlocks'), resNote: $('resNote'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn'), countdown: $('countdown')
  };
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  tools.append(streakEl, SG.unitButton());

  // ---------- State ----------
  // answers: daily → [{ w: picked the winner, g: picked the gap }], endless → [true/false]
  const S = { mode: 'daily', date: '', races: [], i: 0, pair: null, pick: null, answers: [], phase: 'pick', r: null, recent: [], timer: 0 };
  const loadDaily = () => store.get(KEY, {});
  const pts = a => (a.w ? 1 : 0) + (a.g ? 1 : 0);
  const dailyTotal = () => S.answers.reduce((s, a) => s + pts(a), 0);
  const block = a => a.w && a.g ? '🟩' : a.w || a.g ? '🟨' : '🟥';
  const winnerIdx = () => S.pair[0].kmh > S.pair[1].kmh ? 0 : 1;

  function start(mode, seed) {
    clearTimeout(S.timer);
    S.mode = mode;
    S.seed = mode === 'daily' ? '' : seed || randomSeed();
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    S.answers = []; S.i = 0;
    el.result.hidden = true;
    el.game.hidden = false;
    if (mode === 'daily') {
      S.races = dailyRaces('speed-' + S.date);
      const rec = loadDaily()[S.date];
      if (rec) { S.answers = rec.answers.slice(); S.i = S.answers.length; }
      if (rec && rec.done) { updateChrome(); showResult(); return; }
      S.pair = S.races[S.i];
    } else {
      S.r = rng(S.seed);
      S.recent = [];
      S.pair = endlessRace(S.r, 0, S.recent);
    }
    updateChrome();
    ask();
  }

  function placeRacer(k, frac, animate) {
    const b = el.racers[k];
    b.style.transition = animate ? `left ${RACE_MS}ms linear` : 'none';
    b.style.left = `calc((100% - var(--racer)) * ${frac.toFixed(5)})`;
  }

  function ask() {
    S.phase = 'pick';
    S.pick = null;
    S.pair.forEach((o, k) => {
      el.racers[k].innerHTML = `<span class="sr-emoji" aria-hidden="true">${o.emoji}</span>`;
      el.racers[k].setAttribute('aria-label', o.name);
      el.racers[k].disabled = false;
      el.racers[k].classList.remove('picked', 'win', 'lose');
      el.speeds[k].innerHTML = `<b>${esc(o.name)}</b><span>?</span>`;
      placeRacer(k, 0, false);
    });
    el.track.classList.add('picking');
    el.prompt.innerHTML = `Which is faster: <span class="c-ref">${esc(S.pair[0].as)}</span> or <span class="c-guess">${esc(S.pair[1].as)}</span>?`;
    el.gapBox.hidden = true;
    el.reveal.hidden = true;
    el.hint.hidden = false;
    el.hint.textContent = 'Tap the faster racer, or press 1 or 2.';
    renderMeta();
  }

  function pickRacer(k) {
    if (S.phase !== 'pick') return;
    S.pick = k;
    el.racers.forEach((b, j) => { b.classList.toggle('picked', j === k); b.disabled = true; });
    el.track.classList.remove('picking');
    if (S.mode === 'daily') {
      S.phase = 'gap';
      el.gapQ.innerHTML = `How much faster is <b>${esc(theOf(S.pair[k]))}</b>?`;
      el.gapBox.hidden = false;
      el.hint.textContent = 'Press 1, 2 or 3.';
    } else race(null);
  }

  function race(gap) {
    if (S.phase !== 'pick' && S.phase !== 'gap') return;
    S.phase = 'race';
    el.gapBox.hidden = true;
    el.hint.hidden = true;
    const w = winnerIdx(), ra = ratioOf(S.pair[0], S.pair[1]);
    const won = S.pick === w;
    if (S.mode === 'daily') {
      S.answers.push({ w: won, g: gap === gapOf(ra) });
      const d = loadDaily();
      d[S.date] = { answers: S.answers.slice(), done: S.answers.length >= DAILY_Q, ...SG.lateFlag() };
      store.set(KEY, d);
    } else {
      S.answers.push(won);
      if (won) store.set(BEST_KEY, Math.max(store.get(BEST_KEY, 0), S.answers.length));
    }
    S.gapPick = gap;
    // both set off together; the slower one covers 1/ratio of the distance in the same time
    requestAnimationFrame(() => requestAnimationFrame(() => {
      placeRacer(w, 1, true);
      placeRacer(1 - w, 1 / ra, true);
    }));
    S.timer = setTimeout(() => reveal(won, gap, ra, w), RACE_MS + 150);
  }

  function reveal(won, gap, ra, w) {
    S.phase = 'reveal';
    el.racers[w].classList.add('win');
    el.racers[1 - w].classList.add('lose');
    S.pair.forEach((o, k) => { el.speeds[k].innerHTML = `<b>${esc(o.name)}</b><span>${esc(fmtSpeed(o.kmh))}</span>`; });
    const fast = S.pair[w], slow = S.pair[1 - w];
    const gapRight = gap === gapOf(ra);
    if (S.mode === 'daily') {
      const p = (won ? 1 : 0) + (gapRight ? 1 : 0);
      el.verdict.textContent = p === 2 ? 'Perfect!' : p === 1 ? 'Half right' : 'Not quite';
      el.verdict.style.color = p === 2 ? 'var(--true)' : p === 1 ? 'var(--guess-deep)' : 'var(--bad)';
    } else {
      el.verdict.textContent = won ? 'Correct!' : 'Not quite';
      el.verdict.style.color = won ? 'var(--true)' : 'var(--bad)';
    }
    el.ratio.innerHTML = `${esc(cap(theOf(fast)))} is about <b>${times(ra)}×</b> faster than ${esc(theOf(slow))}: ${GAP_NAMES[gapOf(ra)]}.` +
      (S.mode === 'daily' ? ` You picked ${esc(theOf(S.pair[S.pick]))}, ${GAP_NAMES[gap]}.` : '');
    SG.setFact(el.fact, fast.fact + (ra > 200 ? ` ${cap(theOf(slow))} barely left the start line.` : ''), fast.src);
    const last = S.mode === 'daily' ? S.answers.length >= DAILY_Q : !won;
    el.nextBtn.textContent = last ? 'See result' : 'Next race →';
    el.reveal.hidden = false;
    renderMeta();
    updateChrome();
    if (S.mode === 'daily' ? won && gapRight : won && S.answers.length % 10 === 0) SG.confetti(30);
    el.nextBtn.focus({ preventScroll: true });
  }

  function next() {
    if (S.phase !== 'reveal') return;
    if (S.mode === 'daily') {
      S.i++;
      if (S.i >= DAILY_Q) return showResult();
      S.pair = S.races[S.i];
    } else {
      if (!S.answers[S.answers.length - 1]) return showResult();
      S.recent = S.recent.concat(S.pair.map(o => o.id)).slice(-6);
      S.pair = endlessRace(S.r, S.answers.length, S.recent);
    }
    ask();
  }

  function renderMeta() {
    if (S.mode === 'daily') {
      el.progress.textContent = `Race ${Math.min(S.answers.length + (S.phase === 'reveal' ? 0 : 1), DAILY_Q)} of ${DAILY_Q}`;
      el.scoreLine.innerHTML = `<b>${dailyTotal()}</b> / ${DAILY_Q * 2}`;
      let d = '';
      for (let i = 0; i < DAILY_Q; i++) { const a = S.answers[i]; d += `<i class="${!a ? '' : pts(a) === 2 ? 'ok' : pts(a) === 1 ? 'near' : 'no'}"></i>`; }
      el.dots.innerHTML = d;
    } else {
      el.progress.textContent = `Streak ${S.answers.filter(Boolean).length}`;
      el.scoreLine.innerHTML = `Best <b>${store.get(BEST_KEY, 0)}</b>`;
      el.dots.innerHTML = '';
    }
  }

  function showResult() {
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    if (S.mode === 'daily') {
      const tot = dailyTotal();
      el.resTitle.textContent = `Daily #${dayNumber(S.date)}`;
      el.resRank.textContent = SG.rankFor(tot, DAILY_Q * 2);
      el.resTotal.textContent = tot;
      el.resOf.textContent = `/${DAILY_Q * 2}`;
      el.resBlocks.textContent = S.answers.map(block).join('');
      el.resNote.textContent = `${S.answers.filter(a => a.w).length} winners right, ${S.answers.filter(a => a.g).length} gaps right`;
      el.againBtn.textContent = 'Play Endless';
      if (tot >= 14) SG.confetti();
    } else {
      const right = S.answers.filter(Boolean).length, best = store.get(BEST_KEY, 0);
      el.resTitle.textContent = 'Endless';
      el.resRank.textContent = right >= best && right > 0 ? 'New best!' : 'Your streak';
      el.resTotal.textContent = right;
      el.resOf.textContent = '';
      el.resBlocks.textContent = '';
      el.resNote.textContent = `Best streak: ${best}`;
      el.againBtn.textContent = 'Play again';
      if (right >= best && right >= 5) SG.confetti();
    }
    SG.vsResult(el.result, S, S.mode === 'daily' ? dailyTotal() : S.answers.filter(Boolean).length);
    if (S.mode === 'daily') SG.board.show('speed', S.date, el.result);
    tick();
    updateChrome();
  }

  function shareText() {
    const score = S.mode === 'daily' ? dailyTotal() : S.answers.filter(Boolean).length;
    const url = SG.challengeUrl({ mode: S.mode, date: S.date, seed: S.seed, score });
    if (S.mode === 'daily') return SG.challengeText(`${GAME.name} #${dayNumber(S.date)}: ${score}/${DAILY_Q * 2}`, S.answers.map(block).join(''), url);
    return SG.challengeText(`${GAME.name}: I picked the faster racer ${score} times in a row. Same races for you.`, '', url);
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
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · 8 races · same for everyone` : 'Endless · one wrong pick ends the run';
    SG.vsBanner(S, S.mode === 'daily' ? `/${DAILY_Q * 2}` : ' in a row');
  }

  // ---------- Input ----------
  el.racers.forEach((b, k) => b.addEventListener('click', () => pickRacer(k)));
  el.gapBox.addEventListener('click', e => { const b = e.target.closest('[data-gap]'); if (b && S.phase === 'gap') race(+b.dataset.gap); });
  el.nextBtn.addEventListener('click', next);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.againBtn.addEventListener('click', () => start(S.mode === 'daily' ? 'endless' : S.mode));
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { SG.leaveArchive(); start(b.dataset.mode); }));
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'INPUT') return;
    const n = parseInt(e.key, 10);
    if (S.phase === 'pick' && (n === 1 || n === 2)) { e.preventDefault(); pickRacer(n - 1); }
    else if (S.phase === 'gap' && n >= 1 && n <= 3) { e.preventDefault(); race(n - 1); }
    else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
  });
  SG.onUnits(() => {
    if (S.phase === 'reveal') S.pair.forEach((o, k) => { el.speeds[k].innerHTML = `<b>${esc(o.name)}</b><span>${esc(fmtSpeed(o.kmh))}</span>`; });
  });

  start(new URLSearchParams(location.search).get('mode') === 'endless' ? 'endless' : 'daily', SG.vs && SG.vs.seed);
  window.__speed = { S, dailyRaces, ratioOf, gapOf };
})();

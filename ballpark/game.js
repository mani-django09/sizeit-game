(() => {
  'use strict';
  const { store, rng, randomSeed, todayKey, dayNumber, untilMidnight, streakInfo, esc, share } = SG;

  const GAME = SG.SITE.games.find(g => g.id === 'ballpark');
  const DAILY_Q = 10;
  const CHOICES = 5;
  const RUSH_SECONDS = 60, RUSH_PENALTY = 3;
  const KEY = 'sg_ballpark_daily';
  const BEST_KEY = 'sg_ballpark_best';

  SG.header('ballpark');

  // ---------- Question pool ----------
  // Number questions as they are, plus sizes and weights from the object library.
  // Every answer is expressed in a unit that makes it at least 1, so ranges start at 1-9.
  const plainName = o => o.name.replace(/ \(.*\)$/, '');
  const nf = v => Number(v.toPrecision(4)).toLocaleString('en');
  const HOW = { h: 'tall', l: 'long', d: 'wide' };
  const NO_WEIGHT = new Set(['wadlow']);   // a person's weight reads oddly as a quiz question
  const POOL = [];
  const asked = new Set(QUESTIONS.map(q => q.id));
  for (const q of QUESTIONS) POOL.push({ id: 'n-' + q.id, q: q.q, a: q.a, unit: q.unit, fact: q.fact, src: q.src });
  for (const o of OBJECTS) {
    if (o.cat === 'story') continue;
    if (!asked.has(o.id)) {
      const cm = o.size < 1;
      POOL.push({ id: 's-' + o.id, q: `${o.name}: how ${HOW[o.dim]} is it, in ${cm ? 'centimetres' : 'metres'}?`,
        a: cm ? o.size * 100 : o.size, unit: cm ? 'cm' : 'm', fact: o.fact, src: o.src });
    }
    if (o.kg && !NO_WEIGHT.has(o.id)) {
      const unit = o.kg < 1 ? 'grams' : o.kg >= 1000 ? 'tonnes' : 'kg';
      const a = unit === 'grams' ? o.kg * 1000 : unit === 'tonnes' ? o.kg / 1000 : o.kg;
      // one-of-a-kind things get "The", everything else is "a typical" one
      const who = SG.isOne(o) ? `${o.bare ? '' : 'The '}${plainName(o)}` : `A typical ${SG.isProper(o) ? plainName(o) : plainName(o).toLowerCase()}`;
      POOL.push({ id: 'w-' + o.id, q: `${plainName(o)}: how much does it weigh, in ${unit}?`, a, unit,
        fact: `${who} weighs about ${nf(a)} ${unit}.`, src: o.src });
    }
  }
  const bucketOf = a => Math.floor(Math.log10(a) + 1e-9);

  // ---------- Ranges ----------
  // k = number of digits minus one: 0 → 1–9, 4 → 10k–99k, 9 → 1B–9.9B
  const SUFFIX = ['', 'k', 'M', 'B', 'T'];
  function rangeLabel(k) {
    if (k <= 2) return `${Math.pow(10, k)}–${Math.pow(10, k + 1) - 1}`;
    if (k === 3) return '1,000–9,999';
    if (k <= 14) {
      const s = SUFFIX[Math.floor(k / 3)], m = k % 3;
      return `${Math.pow(10, m)}${s}–${['9.9', '99', '999'][m]}${s}`;
    }
    return `10<sup>${k}</sup>–10<sup>${k + 1}</sup>`;
  }
  const rangeWords = k => ['single digits', 'the tens', 'the hundreds', 'the thousands'][k] || `${k + 1}-digit numbers`;

  function withChoices(r, item) {
    const k = bucketOf(item.a);
    const start = Math.max(0, k - Math.floor(r() * CHOICES));
    return { ...item, k, start };
  }
  function dailySet(seed) {
    const r = rng(seed);
    const left = POOL.slice(), out = [], perRange = {};
    // mix sources (half number facts, half sizes and weights) and spread answers across ranges
    while (out.length < DAILY_Q) {
      const wantNum = out.length % 2 === 0;
      let cands = left.filter(p => p.id.startsWith('n-') === wantNum && (perRange[bucketOf(p.a)] || 0) < 2);
      if (!cands.length) cands = left;
      const p = cands[Math.floor(r() * cands.length)];
      left.splice(left.indexOf(p), 1);
      perRange[bucketOf(p.a)] = (perRange[bucketOf(p.a)] || 0) + 1;
      out.push(withChoices(r, p));
    }
    return out;
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    game: $('game'), result: $('result'), progress: $('progress'), scoreLine: $('scoreLine'), prompt: $('prompt'), sub: $('sub'),
    timerWrap: $('timerWrap'), timerBar: $('timerBar'), choices: $('choices'), hint: $('hint'),
    reveal: $('reveal'), revealPts: $('revealPts'), revealNums: $('revealNums'), revealFact: $('revealFact'), nextBtn: $('nextBtn'), dots: $('dots'),
    rushStart: $('rushStart'), goBtn: $('goBtn'),
    resKicker: $('resKicker'), resRank: $('resRank'), resTotal: $('resTotal'), resOf: $('resOf'), resBlocks: $('resBlocks'), resNote: $('resNote'),
    shareBtn: $('shareBtn'), againBtn: $('againBtn'), countdown: $('countdown')
  };
  const tools = $('tools');
  const streakEl = document.createElement('span'); streakEl.className = 'streak'; streakEl.title = 'Daily streak';
  tools.append(streakEl);

  // ---------- State ----------
  const S = { mode: 'daily', date: '', set: [], i: 0, answers: [], phase: 'ask', cur: null, r: null, used: new Set(), score: 0, endsAt: 0, timer: 0, lock: false };
  const loadDaily = () => store.get(KEY, {});
  const pts = d => d === 0 ? 3 : Math.abs(d) === 1 ? 1 : 0;
  const block = d => d === 0 ? '🟩' : Math.abs(d) === 1 ? '🟨' : '🟥';
  const dailyTotal = () => S.answers.reduce((a, d) => a + pts(d), 0);

  function start(mode, seed) {
    clearInterval(S.timer);
    S.mode = mode;
    S.seed = mode === 'daily' ? '' : seed || randomSeed();
    S.date = mode === 'daily' && SG.archiveDate ? SG.archiveDate : todayKey();
    S.answers = []; S.i = 0; S.score = 0;
    el.result.hidden = true;
    el.game.hidden = false;
    el.reveal.hidden = true;
    if (mode === 'daily') {
      S.set = dailySet('ballpark-' + S.date);
      const rec = loadDaily()[S.date];
      if (rec) { S.answers = rec.answers.slice(); S.i = S.answers.length; }
      if (rec && rec.done) { updateChrome(); showResult(); return; }
      el.rushStart.hidden = true;
      el.timerWrap.hidden = true;
      S.cur = S.set[S.i];
      ask();
    } else {
      // Rush waits for the player to start the clock
      S.phase = 'ready';
      el.rushStart.hidden = false;
      el.timerWrap.hidden = false;
      el.timerBar.style.width = '100%';
      el.prompt.textContent = 'How many can you get in a minute?';
      el.choices.innerHTML = '';
      el.hint.hidden = true;
      el.dots.innerHTML = '';
      renderMeta();
    }
    updateChrome();
  }

  function goRush() {
    S.r = rng(S.seed);
    S.used = new Set();
    S.score = 0; S.answers = [];
    S.endsAt = Date.now() + RUSH_SECONDS * 1000;
    el.rushStart.hidden = true;
    S.timer = setInterval(rushTick, 100);
    nextRush();
  }
  function nextRush() {
    let p;
    do { p = POOL[Math.floor(S.r() * POOL.length)]; } while (S.used.has(p.id) && S.used.size < POOL.length);
    S.used.add(p.id);
    S.cur = withChoices(S.r, p);
    ask();
  }
  function rushTick() {
    const left = Math.max(0, S.endsAt - Date.now());
    el.timerBar.style.width = (left / (RUSH_SECONDS * 1000) * 100) + '%';
    el.timerBar.classList.toggle('low', left < 10000);
    renderMeta();
    if (left <= 0) { clearInterval(S.timer); showResult(); }
  }

  function ask() {
    S.phase = 'ask';
    S.lock = false;
    const c = S.cur;
    el.prompt.textContent = c.q;
    let h = '';
    for (let j = 0; j < CHOICES; j++) {
      const k = c.start + j;
      h += `<button class="bp-choice" data-k="${k}"><span class="bp-key">${j + 1}</span><span class="bp-range">${rangeLabel(k)}</span></button>`;
    }
    el.choices.innerHTML = h;
    el.hint.hidden = S.mode !== 'daily';
    el.reveal.hidden = true;
    renderMeta();
  }

  function choose(k) {
    if (S.phase !== 'ask' || S.lock) return;
    const c = S.cur, d = k - c.k;
    el.choices.querySelectorAll('.bp-choice').forEach(b => {
      const bk = +b.dataset.k;
      b.disabled = true;
      if (bk === c.k) b.classList.add('ok');
      else if (bk === k) b.classList.add(Math.abs(d) === 1 ? 'near' : 'no');
    });
    S.answers.push(d);
    if (S.mode === 'rush') {
      S.lock = true;
      if (d === 0) S.score++;
      else S.endsAt -= RUSH_PENALTY * 1000;
      const btn = el.choices.querySelector(`[data-k="${c.k}"]`);
      if (btn) btn.insertAdjacentHTML('beforeend', `<span class="bp-exact">${esc(nf(c.a))}</span>`);
      renderMeta();
      setTimeout(() => { if (S.phase === 'ask' && S.mode === 'rush' && Date.now() < S.endsAt) nextRush(); }, d === 0 ? 450 : 1100);
      return;
    }
    S.phase = 'reveal';
    const d0 = loadDaily();
    d0[S.date] = { answers: S.answers.slice(), done: S.answers.length >= DAILY_Q, ...SG.lateFlag() };
    store.set(KEY, d0);
    const p = pts(d);
    el.revealPts.innerHTML = `+${p}<small>points</small>`;
    el.revealPts.style.color = p === 3 ? 'var(--true)' : p === 1 ? 'var(--guess-deep)' : 'var(--bad)';
    el.revealNums.innerHTML = `${d === 0 ? '<b>Right ballpark!</b>' : Math.abs(d) === 1 ? '<b>Close.</b>' : `<b>${Math.abs(d)} ranges ${d > 0 ? 'too high' : 'too low'}.</b>`} The answer is <b>${esc(nf(c.a))}${c.unit ? ' ' + esc(c.unit) : ''}</b>, in ${rangeWords(c.k)}.`;
    SG.setFact(el.revealFact, c.fact, c.src);
    el.nextBtn.textContent = S.answers.length >= DAILY_Q ? 'See result' : 'Next question';
    el.reveal.hidden = false;
    el.hint.hidden = true;
    renderMeta();
    updateChrome();
    el.nextBtn.focus({ preventScroll: true });
  }

  function next() {
    if (S.phase !== 'reveal') return;
    S.i++;
    if (S.i >= DAILY_Q) return showResult();
    S.cur = S.set[S.i];
    ask();
  }

  function renderMeta() {
    if (S.mode === 'daily') {
      el.progress.textContent = `Question ${Math.min(S.answers.length + (S.phase === 'ask' ? 1 : 0), DAILY_Q)} of ${DAILY_Q}`;
      el.scoreLine.innerHTML = `<b>${dailyTotal()}</b> / ${DAILY_Q * 3}`;
      let d = '';
      for (let i = 0; i < DAILY_Q; i++) { const a = S.answers[i]; d += `<i class="${a == null ? '' : a === 0 ? 'ok' : Math.abs(a) === 1 ? 'near' : 'no'}"></i>`; }
      el.dots.innerHTML = d;
    } else {
      const left = S.phase === 'ready' ? RUSH_SECONDS : Math.max(0, Math.ceil((S.endsAt - Date.now()) / 1000));
      el.progress.textContent = `⏱ ${left}s`;
      el.scoreLine.innerHTML = `<b>${S.score}</b> right · best ${store.get(BEST_KEY, 0)}`;
    }
  }

  function showResult() {
    clearInterval(S.timer);
    S.phase = 'done';
    el.game.hidden = true;
    el.result.hidden = false;
    if (S.mode === 'daily') {
      const tot = dailyTotal();
      el.resKicker.textContent = `Daily #${dayNumber(S.date)}`;
      el.resRank.textContent = SG.rankFor(tot, DAILY_Q * 3);
      el.resTotal.textContent = tot;
      el.resOf.textContent = `/${DAILY_Q * 3}`;
      el.resBlocks.textContent = S.answers.map(block).join('');
      el.resNote.textContent = `${S.answers.filter(d => d === 0).length} exact, ${S.answers.filter(d => Math.abs(d) === 1).length} one range off`;
      el.againBtn.textContent = 'Try the 60s Rush';
      if (tot >= 27) SG.confetti();
    } else {
      const prev = store.get(BEST_KEY, 0);
      const best = Math.max(prev, S.score);
      store.set(BEST_KEY, best);
      el.resKicker.textContent = '60-second Rush';
      el.resRank.textContent = S.score > prev && S.score > 0 ? 'New best!' : 'Time!';
      el.resTotal.textContent = S.score;
      el.resOf.textContent = ' right';
      el.resBlocks.textContent = S.answers.map(d => d === 0 ? '🟩' : '🟥').join('');
      el.resNote.textContent = `${S.answers.length} answered · best ${best}`;
      el.againBtn.textContent = 'Rush again';
      if (S.score > prev && S.score >= 5) SG.confetti();
    }
    SG.vsResult(el.result, S, S.mode === 'daily' ? dailyTotal() : S.score);
    if (S.mode === 'daily') SG.board.show('ballpark', S.date, el.result);
    tick();
    updateChrome();
  }

  function shareText() {
    const url = SG.challengeUrl({ mode: S.mode, date: S.date, seed: S.seed, score: S.mode === 'daily' ? dailyTotal() : S.score });
    if (S.mode === 'daily') return SG.challengeText(`${GAME.name} #${dayNumber(S.date)}: ${dailyTotal()}/${DAILY_Q * 3}`, S.answers.map(block).join(''), url);
    return SG.challengeText(`${GAME.name} 60s Rush: ${S.score} exact ranges in a minute. Same questions for you.`, '', url);
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
    el.sub.textContent = S.mode === 'daily' ? `Daily #${dayNumber(S.date)} · 10 questions · same for everyone` : '60 seconds · exact ranges only · misses cost 3s';
    SG.vsBanner(S, S.mode === 'daily' ? `/${DAILY_Q * 3}` : ' in 60s');
  }

  // ---------- Input ----------
  el.choices.addEventListener('click', e => { const b = e.target.closest('.bp-choice'); if (b) choose(+b.dataset.k); });
  el.nextBtn.addEventListener('click', next);
  el.goBtn.addEventListener('click', goRush);
  el.shareBtn.addEventListener('click', () => share(shareText()));
  el.againBtn.addEventListener('click', () => { start('rush'); });
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { SG.leaveArchive(); start(b.dataset.mode); }));
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.phase === 'ask') {
      const j = parseInt(e.key, 10);
      if (j >= 1 && j <= CHOICES) { e.preventDefault(); choose(S.cur.start + j - 1); }
    } else if (S.phase === 'reveal' && e.key === 'Enter') { e.preventDefault(); next(); }
    else if (S.phase === 'ready' && e.key === 'Enter') { e.preventDefault(); goRush(); }
  });

  start(new URLSearchParams(location.search).get('mode') === 'rush' ? 'rush' : 'daily', SG.vs && SG.vs.seed);
  window.__ballpark = { S, POOL, rangeLabel, bucketOf, dailySet };
})();

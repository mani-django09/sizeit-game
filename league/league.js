// Friends League: create or join a league with a 6-letter code, then see today's and this week's table.
// Talks to league_create / league_join / league_leave / league_board in supabase/schema.sql.
(() => {
  'use strict';
  const { SITE, ROOT, store, esc, todayKey, dateKey, dayNumber, board, share, toast, icon, copyText, track } = SG;
  SG.header('league');

  const view = document.getElementById('view');
  const daily = SITE.games.filter(g => g.status === 'live' && g.daily);
  const MAX = daily.length * 100;
  const KEY = 'sg_leagues';
  const params = new URLSearchParams(location.search);
  const codeParam = (params.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  let tab = store.get('sg_league_tab', 'today');

  const mine = () => SG.myLeagues();
  function remember(code, name) {
    const list = mine().filter(l => l.code !== code);
    list.unshift({ code, name });
    store.set(KEY, list.slice(0, 20));
  }
  const forget = code => store.set(KEY, mine().filter(l => l.code !== code));
  const leagueUrl = code => `${location.origin}${location.pathname}?code=${code}`;
  const myName = () => store.get('sg_name', '');
  const nameField = (id, label) => `<label class="lg-field"><span>${label}</span>
    <input type="text" id="${id}" maxlength="20" autocomplete="nickname" placeholder="e.g. Rahul" value="${esc(myName())}"></label>`;

  async function rpc(fn, body) {
    if (!board.on) throw new Error('off');
    return board.rpc(fn, body);
  }
  function unavailable() {
    view.innerHTML = `<div class="panel lg-empty"><p><b>Leagues aren't available right now.</b> Please try again in a little while.</p>
      <a class="secondary" href="${ROOT}">Back to the games</a></div>`;
  }
  const reasons = {
    not_found: "There's no league with that code. Check it and try again.",
    full: 'That league is full (200 players).',
    too_many: "You're already in 20 leagues. Leave one to join another.",
    limit: "Too many new leagues from your network today. Try again tomorrow."
  };

  // ---------- Home: your leagues, create, join ----------
  function renderHome() {
    const list = mine();
    view.innerHTML = `
      ${list.length ? `<h2 class="st-h">Your leagues</h2>
        <div class="lg-list">${list.map(l => `<a class="st-game lg-item" href="?code=${esc(l.code)}"><span class="lg-trophy">🏆</span>
          <div><b>${esc(l.name)}</b><span>Code ${esc(l.code)}</span></div><span class="lg-go">Open →</span></a>`).join('')}</div>` : ''}
      <div class="lg-grid">
        <form class="panel lg-card" id="createForm">
          <h2>Start a league</h2>
          <p>Make one for your family, friends, class or office group. You'll get a code and a WhatsApp invite.</p>
          <label class="lg-field"><span>League name</span><input type="text" id="lgName" maxlength="30" placeholder="e.g. Office Gang" required></label>
          ${nameField('createMe', 'Your name')}
          <button class="primary big" type="submit">Create league</button>
          <p class="lg-err" id="createErr" hidden></p>
        </form>
        <form class="panel lg-card" id="joinForm">
          <h2>Join with a code</h2>
          <p>Got a 6-letter code from a friend? Type it here.</p>
          <label class="lg-field"><span>League code</span><input type="text" id="joinCode" maxlength="6" placeholder="ABC234" autocapitalize="characters" autocomplete="off" required class="lg-code-in"></label>
          ${nameField('joinMe', 'Your name')}
          <button class="secondary big" type="submit">Join league</button>
          <p class="lg-err" id="joinErr" hidden></p>
        </form>
      </div>
      <div class="steps lg-steps">
        <div class="step-card"><h3>Make a league</h3><p>Give it a name. You get a code like <b>K7MPQX</b>.</p></div>
        <div class="step-card"><h3>Send it to the group</h3><p>One tap shares the invite on WhatsApp. Friends join with just a name.</p></div>
        <div class="step-card"><h3>Play the Dailies</h3><p>Everyone's scores land on one table. Post the standings back to the group.</p></div>
      </div>`;
    const busy = (form, on) => form.querySelectorAll('button, input').forEach(x => { x.disabled = on; });
    const err = (id, msg) => { const e = document.getElementById(id); e.textContent = msg; e.hidden = !msg; };
    document.getElementById('createForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget, name = f.lgName.value.trim(), me = f.createMe.value.trim();
      if (name.length < 2) return err('createErr', 'Give the league a name (at least 2 letters).');
      if (!me) return err('createErr', 'Add your name, so friends know who you are.');
      err('createErr', ''); busy(f, true);
      try {
        const r = await rpc('league_create', { p_name: name, p_device: board.deviceId(), p_member: me });
        if (!r.ok) { busy(f, false); return err('createErr', reasons[r.reason] || "Couldn't create the league."); }
        store.set('sg_name', me); remember(r.code, r.name);
        track('league_create', {});
        location.href = `?code=${r.code}&new=1`;
      } catch { busy(f, false); err('createErr', "Couldn't reach the server. Check your connection and try again."); }
    });
    document.getElementById('joinForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget, code = f.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) return err('joinErr', 'Codes have 6 letters and numbers.');
      await join(code, f.joinMe.value.trim(), f, m => err('joinErr', m));
    });
  }

  async function join(code, me, form, fail) {
    if (!me) return fail('Add your name, so friends know who you are.');
    fail('');
    form.querySelectorAll('button, input').forEach(x => { x.disabled = true; });
    try {
      const r = await rpc('league_join', { p_code: code, p_device: board.deviceId(), p_name: me });
      if (!r.ok) { form.querySelectorAll('button, input').forEach(x => { x.disabled = false; }); return fail(reasons[r.reason] || "Couldn't join the league."); }
      store.set('sg_name', me); remember(r.code, r.name);
      track('league_join', {});
      location.href = `?code=${r.code}`;
    } catch {
      form.querySelectorAll('button, input').forEach(x => { x.disabled = false; });
      fail("Couldn't reach the server. Check your connection and try again.");
    }
  }

  // ---------- One league ----------
  function streakOf(days) {
    const set = new Set(days), d = new Date();
    if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;

  function rows(L) {
    const all = L.members.map(m => ({ ...m, total: sum(m.today), played: Object.keys(m.today || {}).length, streak: streakOf(m.days || []) }));
    const key = tab === 'week' ? m => m.week : m => m.total;
    return all.sort((a, b) => key(b) - key(a) || b.played - a.played || a.name.localeCompare(b.name));
  }

  function standingsText(L) {
    const rs = rows(L), on = rs.filter(r => (tab === 'week' ? r.week : r.played) > 0), off = rs.filter(r => !on.includes(r));
    const head = tab === 'week' ? `🏆 ${L.name} · this week` : `🏆 ${L.name} · Daily #${dayNumber(todayKey())}`;
    const lines = on.map((r, i) => `${medal(i)} ${r.name} ${tab === 'week' ? r.week : r.total}${tab === 'week' ? '' : ` (${r.played}/${daily.length})`}${r.streak >= 3 ? ` 🔥${r.streak}` : ''}`);
    const sleepy = off.length ? `\n😴 Not played yet: ${off.map(r => r.name).join(', ')}` : '';
    return `${head}\n${lines.join('\n') || 'Nobody has played yet!'}${sleepy}\nPlay and climb the table 👇\n${leagueUrl(L.code)}`;
  }
  const inviteText = L => `Join my sizeit.games league "${L.name}" 🏆\nTwo-minute daily guessing games: how big, how heavy, how far. Let's see who wins!\nCode: ${L.code}\n${leagueUrl(L.code)}`;

  function table(L) {
    const rs = rows(L);
    if (!rs.length) return '<p class="hint">No members yet.</p>';
    return `<ol class="lg-table">${rs.map((r, i) => {
      const pts = tab === 'week' ? r.week : r.total, idle = tab === 'week' ? !r.weekDays : !r.played;
      const chips = tab === 'week'
        ? `<span class="lg-sub">${r.weekDays} of 7 days</span>`
        : `<span class="lg-games">${daily.map(g => `<i class="${g.id in (r.today || {}) ? 'on' : ''}" title="${esc(g.name)}${g.id in (r.today || {}) ? ': ' + r.today[g.id] : ''}">${icon(g.icon)}</i>`).join('')}</span>`;
      return `<li class="${r.me ? 'me' : ''}${idle ? ' idle' : ''}">
        <span class="lg-rank">${idle ? '–' : medal(i)}</span>
        <span class="lg-who"><b>${esc(r.name)}${r.me ? ' <em>you</em>' : ''}</b>${chips}</span>
        <span class="lg-streak" title="Days in a row">${r.streak ? `🔥${r.streak}` : ''}</span>
        <span class="lg-pts"><b>${pts}</b><small>${tab === 'week' ? 'pts' : `/${MAX}`}</small></span></li>`;
    }).join('')}</ol>`;
  }

  function renderLeague(L) {
    document.title = `${L.name} · Friends League | ${SITE.name}`;
    document.getElementById('sub').textContent = `${L.members.length} ${L.members.length === 1 ? 'player' : 'players'} · code ${L.code}`;
    if (!L.member) return renderInvite(L);
    remember(L.code, L.name);
    const me = L.members.find(m => m.me), t = SG.todayTotal(), next = t.rows.find(x => !x.done);
    const isNew = params.get('new') === '1';
    view.innerHTML = `
      ${isNew ? `<div class="banner lg-new">🎉 <b>${esc(L.name)}</b> is ready. Now invite your group: the league only gets fun with friends in it.</div>` : ''}
      <div class="panel lg-head">
        <div class="lg-codebox"><span>League code</span><b id="codeTxt">${esc(L.code)}</b><button class="secondary" id="copyCode" type="button">Copy</button></div>
        <div class="lg-actions">
          <button class="primary sh-wa-btn" id="inviteBtn" type="button">📲 Invite friends on WhatsApp</button>
          <button class="secondary" id="postBtn" type="button">📣 Post the table to the group</button>
        </div>
      </div>
      <div class="lg-tabs" role="tablist">
        <button class="mode${tab === 'today' ? ' active' : ''}" data-tab="today" role="tab">Today</button>
        <button class="mode${tab === 'week' ? ' active' : ''}" data-tab="week" role="tab">This week</button>
      </div>
      <div class="panel lg-board">${table(L)}</div>
      <div class="lg-foot">
        ${next ? `<a class="primary big" href="${ROOT}${next.g.path}">${t.done ? 'Keep playing' : 'Play today'}: ${esc(next.g.name)} →</a>`
          : `<span class="chip done">✓ You've played every Daily today</span>`}
        <p class="hint">Points are the same as Today's total: up to 100 per Daily. Scores show up here a moment after you finish.
          ${me ? `You're playing as <b>${esc(me.name)}</b> · <button class="linkish" id="renameBtn" type="button">change name</button> · ` : ''}
          <button class="linkish" id="leaveBtn" type="button">leave league</button> · <a href="./">all your leagues</a></p>
      </div>`;
    if (isNew) history.replaceState(null, '', `?code=${L.code}`);
    document.getElementById('copyCode').addEventListener('click', () => copyText(L.code));
    document.getElementById('inviteBtn').addEventListener('click', () => { track('league_invite', {}); share(inviteText(L)); });
    document.getElementById('postBtn').addEventListener('click', () => { track('league_post', {}); share(standingsText(L)); });
    view.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab; store.set('sg_league_tab', tab); renderLeague(L);
    }));
    document.getElementById('leaveBtn').addEventListener('click', async () => {
      if (!confirm(`Leave ${L.name}? You can join again with the code ${L.code}.`)) return;
      try { await rpc('league_leave', { p_code: L.code, p_device: board.deviceId() }); } catch { /* still forget it here */ }
      forget(L.code);
      location.href = './';
    });
    const rn = document.getElementById('renameBtn');
    if (rn) rn.addEventListener('click', async () => {
      const nm = (prompt('Your name in this league:', me.name) || '').trim().slice(0, 20);
      if (!nm || nm === me.name) return;
      try { await rpc('league_join', { p_code: L.code, p_device: board.deviceId(), p_name: nm }); store.set('sg_name', nm); load(); }
      catch { toast("Couldn't change your name. Try again."); }
    });
  }

  function renderInvite(L) {
    view.innerHTML = `
      <form class="panel lg-card lg-invite" id="inviteForm">
        <div class="kicker">You're invited</div>
        <h2>🏆 ${esc(L.name)}</h2>
        <p>${L.members.length ? `${esc(L.members.slice(0, 3).map(m => m.name).join(', '))}${L.members.length > 3 ? ` and ${L.members.length - 3} more` : ''} ${L.members.length === 1 ? 'is' : 'are'} playing.` : 'Be the first to join.'}
          Play the free two-minute Dailies and see who wins each day.</p>
        ${nameField('inviteMe', 'Your name')}
        <button class="primary big" type="submit">Join the league →</button>
        <p class="lg-err" id="inviteErr" hidden></p>
      </form>
      <h2 class="st-h">Today's table</h2>
      <div class="panel lg-board">${table(L)}</div>`;
    document.getElementById('inviteForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.currentTarget;
      join(L.code, f.inviteMe.value.trim(), f, m => { const x = document.getElementById('inviteErr'); x.textContent = m; x.hidden = !m; });
    });
  }

  async function load() {
    try {
      const L = await rpc('league_board', { p_code: codeParam, p_day: todayKey(), p_device: board.deviceId() });
      if (!L || !L.ok) {
        forget(codeParam);
        view.innerHTML = `<div class="panel lg-empty"><p><b>There's no league with the code ${esc(codeParam)}.</b> Check the code, or start your own.</p>
          <a class="primary" href="./">Start or join a league</a></div>`;
        return;
      }
      renderLeague(L);
    } catch { unavailable(); }
  }

  if (!board.on) unavailable();
  else if (codeParam.length === 6) load();
  else renderHome();
})();

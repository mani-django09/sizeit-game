// Playgama build: sound. Sound effects and a calm music loop (mp3 files in sounds/), plus a mute button in the header.
// Sound starts after the player's first tap or key press (browsers insist on that), stays off while the player has muted
// it, while the platform has muted it, while an ad is open, and while the page is hidden.
window.PGAudio = (() => {
  'use strict';
  const NAMES = ['tick', 'lock', 'next', 'great', 'good', 'ok', 'miss', 'win'];
  const store = window.__pgStore;
  const state = { muted: !!store.get('sg_muted', false), platform: false, ad: false, paused: false, hidden: document.visibilityState === 'hidden' };
  let ctx = null, master = null, musicGain = null, sfxGain = null, musicSrc = null, loading = null;
  const buffers = {};
  const audible = () => !state.muted && !state.platform && !state.ad && !state.paused && !state.hidden;

  async function fetchBuffer(name) {
    try {
      const r = await fetch(`sounds/${name}.mp3`);
      buffers[name] = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch { /* a missing file just means no sound for it */ }
  }
  function startMusic() {
    if (musicSrc || !buffers.music) return;
    musicSrc = ctx.createBufferSource();
    musicSrc.buffer = buffers.music; musicSrc.loop = true;
    musicSrc.connect(musicGain);
    musicSrc.start();
  }
  // The first gesture creates the audio context and loads every file
  function unlock() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); musicGain = ctx.createGain(); sfxGain = ctx.createGain();
    musicGain.gain.value = 0.32; sfxGain.gain.value = 0.85;
    musicGain.connect(master); sfxGain.connect(master); master.connect(ctx.destination);
    loading = Promise.all(['music', ...NAMES].map(fetchBuffer)).then(() => { startMusic(); apply(); });
    apply();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(t => addEventListener(t, unlock, { capture: true }));

  // Sound off means the whole context is suspended, so nothing plays (and nothing is heard on a hidden page)
  function apply() {
    document.querySelectorAll('.mute-btn').forEach(b => {
      b.classList.toggle('off', state.muted);
      b.setAttribute('aria-pressed', String(state.muted));
      b.title = state.muted ? 'Sound off' : 'Sound on';
    });
    if (!ctx) return;
    if (audible()) ctx.resume().catch(() => {}); else ctx.suspend().catch(() => {});
  }

  function play(name) {
    if (!ctx || !audible() || !buffers[name]) return;
    const s = ctx.createBufferSource();
    s.buffer = buffers[name]; s.connect(sfxGain); s.start();
  }
  // a quiet tick as the guess moves, not on every pixel
  let lastTick = null, lastAt = 0;
  function tick(lr) {
    const now = performance.now();
    if (lastTick === null || Math.abs(lr - lastTick) >= 0.07 && now - lastAt > 45) { lastTick = lr; lastAt = now; play('tick'); }
  }

  const api = {
    play, tick, unlock,
    setPlatformMuted(v) { state.platform = !!v; apply(); },
    setAdMuted(v) { state.ad = !!v; apply(); },
    setPaused(v) { state.paused = !!v; apply(); },
    toggle() { state.muted = !state.muted; store.set('sg_muted', state.muted); unlock(); apply(); }
  };
  document.addEventListener('visibilitychange', () => { state.hidden = document.visibilityState === 'hidden'; apply(); });

  // ---------- mute button in the header ----------
  const tools = document.getElementById('tools');
  if (tools) {
    const b = document.createElement('button');
    b.className = 'icon mute-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Sound');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path class="waves" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="slash" d="M4 4l16 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    b.addEventListener('click', api.toggle);
    tools.prepend(b);
  }
  apply();
  return api;
})();

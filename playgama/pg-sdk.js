// Playgama build: the same window.CG the game already calls, backed by the Playgama Bridge instead of CrazyGames.
// Every call is safe without a Bridge (local testing): nothing happens, and midgame() just runs its callback.
window.CG = (() => {
  'use strict';
  const on = () => window.__pgBridge === true;
  const queue = [];
  let ready = false, playing = false;

  function send(message) {
    if (!on()) return;
    if (!ready) { queue.push(message); return; }
    try { bridge.platform.sendMessage(message); } catch { /* ignore */ }
  }

  // ---------- pause and sound state from the platform ----------
  if (on()) {
    try {
      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, enabled => window.PGAudio && PGAudio.setPlatformMuted(!enabled));
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, paused => window.PGAudio && PGAudio.setPaused(!!paused));
    } catch { /* ignore */ }
  }

  // ---------- interstitial ads ----------
  let pending = null, adOpen = false, guard = 0;
  const adDone = () => {
    clearTimeout(guard);
    adOpen = false;
    document.body.classList.remove('ad-playing');
    if (window.PGAudio) PGAudio.setAdMuted(false);
    const f = pending; pending = null;
    if (f) f();
  };
  if (on() && bridge.advertisement) {
    try {
      bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, state => {
        if (state === 'opened') {
          adOpen = true; clearTimeout(guard);
          document.body.classList.add('ad-playing');
          if (window.PGAudio) PGAudio.setAdMuted(true);    // the game is muted and paused while an ad is open
        } else if (state === 'closed' || state === 'failed') adDone();
      });
    } catch { /* ignore */ }
  }

  return {
    // called once the first playable frame is on screen
    ready() {
      if (ready) return;
      ready = true;
      if (!on()) return;
      try {
        bridge.platform.sendMessage('game_ready');
        // read the platform's sound switch at start: subscribing alone is not enough
        if (window.PGAudio && bridge.platform.isAudioEnabled === false) PGAudio.setPlatformMuted(true);
        if (bridge.advertisement && bridge.advertisement.interstitialState === 'opened') { document.body.classList.add('ad-playing'); if (window.PGAudio) PGAudio.setAdMuted(true); }
      } catch { /* ignore */ }
      queue.splice(0).forEach(m => { try { bridge.platform.sendMessage(m); } catch { /* ignore */ } });
    },
    loadingStart() {}, loadingStop() {}, happytime() {},
    gameplayStart() { if (playing) return; playing = true; send('level_started'); },
    gameplayStop() { if (!playing) return; playing = false; send('level_completed'); },
    // An interstitial at a natural pause (the player chose to play again). `done` runs once the ad is over, or at once
    // when there is none: no Bridge, ads not supported, or the platform shows nothing right now.
    midgame(done) {
      if (!on() || !bridge.advertisement || !bridge.advertisement.isInterstitialSupported) return done();
      pending = done;
      guard = setTimeout(() => { if (!adOpen) adDone(); }, 8000);   // no ad turned up (too soon after the last one): carry on
      try { bridge.advertisement.showInterstitial('play_again'); } catch { adDone(); }
    },
    sfx: name => window.PGAudio && PGAudio.play(name),
    tick: lr => window.PGAudio && PGAudio.tick(lr)
  };
})();

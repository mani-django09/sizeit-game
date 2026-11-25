// CrazyGames SDK v3 wrapper. Every call is safe when the SDK is missing (local testing, other hosts):
// nothing happens, and midgame() just runs its callback straight away.
window.CG = (() => {
  'use strict';
  const sdk = () => window.CrazyGames && window.CrazyGames.SDK;
  // v3 needs a manual init(). Resolves true only when the SDK is usable.
  const ready = (async () => {
    try {
      if (!sdk()) return false;
      await sdk().init();
      return true;
    } catch { return false; }
  })();
  const call = fn => ready.then(ok => { if (ok) { try { fn(sdk()); } catch { /* ignore */ } } });

  let playing = false;
  return {
    loadingStart: () => call(s => s.game.loadingStart()),
    loadingStop: () => call(s => s.game.loadingStop()),
    gameplayStart() { if (playing) return; playing = true; call(s => s.game.gameplayStart()); },
    gameplayStop() { if (!playing) return; playing = false; call(s => s.game.gameplayStop()); },
    happytime: () => call(s => s.game.happytime()),
    // Midgame ad between rounds of play. `done` runs once, whether the ad played, was skipped or failed.
    midgame(done) {
      ready.then(ok => {
        let finished = false;
        const end = () => { if (!finished) { finished = true; done(); } };
        if (!ok) return end();
        try {
          sdk().ad.requestAd('midgame', {
            adStarted: () => { document.body.classList.add('ad-playing'); },
            adFinished: () => { document.body.classList.remove('ad-playing'); end(); },
            adError: () => { document.body.classList.remove('ad-playing'); end(); }
          });
        } catch { end(); }
      });
    }
  };
})();
CG.loadingStart();
window.addEventListener('load', () => CG.loadingStop());

// Playgama build: starts the Playgama Bridge, loads the saved progress, then loads the game.
// The Bridge script itself is the first script in index.html's <head>, as Playgama requires.
// Progress goes through the Bridge storage module only; localStorage is used only when there is no Bridge at all
// (opening the files by hand on a laptop), never on the platform.
(async () => {
  'use strict';
  const KEYS = ['sg_howbig_daily', 'sg_howbig_cat_daily', 'sg_howbig_cat', 'sg_units', 'sg_name', 'sg_intro_how-big', 'sg_muted'];
  const hasBridge = typeof window.bridge !== 'undefined';
  let ready = false;
  if (hasBridge) { try { await bridge.initialize(); ready = true; } catch (e) { console.warn('Bridge failed to start', e); } }

  // ---------- saved progress ----------
  const cache = {};   // key -> JSON text
  if (ready) {
    try {
      const vals = await bridge.storage.get(KEYS);
      KEYS.forEach((k, i) => { const v = Array.isArray(vals) ? vals[i] : vals && vals[k]; if (v != null) cache[k] = typeof v === 'string' ? v : JSON.stringify(v); });
    } catch (e) { console.warn('Could not read the saved progress', e); }
  } else {
    KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v != null) cache[k] = v; } catch { /* ignore */ } });
  }
  const dirty = new Set();
  let timer = 0;
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!dirty.size) return;
    const keys = [...dirty]; dirty.clear();
    if (ready) bridge.storage.set(keys, keys.map(k => cache[k])).catch(e => console.warn('Could not save progress', e));
    else keys.forEach(k => { try { localStorage.setItem(k, cache[k]); } catch { /* ignore */ } });
  }
  window.__pgStore = {
    get(k, d) { const v = cache[k]; if (v == null) return d; try { return JSON.parse(v); } catch { return d; } },
    set(k, v) { cache[k] = JSON.stringify(v); dirty.add(k); if (!timer) timer = setTimeout(flush, 1500); }   // a few writes at most, never one per frame
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.__pgBridge = ready;

  // Esc is reserved by the browser for leaving full screen, so the game never reacts to it
  document.addEventListener('keydown', e => { if (e.key === 'Escape') e.preventDefault(); }, true);
  document.addEventListener('cancel', e => e.preventDefault(), true);

  // ---------- the game ----------
  const load = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.body.appendChild(s);
  });
  for (const src of ['pg-sdk.js', 'cg-common.js', 'objects.js', 'game.js', 'pg-audio.js']) await load(src);

  // tell the platform the first playable frame is on screen
  try { await document.fonts.ready; } catch { /* ignore */ }
  requestAnimationFrame(() => requestAnimationFrame(() => window.CG.ready()));
})();

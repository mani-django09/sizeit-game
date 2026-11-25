// Records the two CrazyGames preview videos of Size It Up from the real build (dist/crazygames/):
//
//   node tools/build-crazygames.mjs          (first, if the build is missing or stale)
//   node tools/make-crazygames-videos.mjs
//   node tools/make-crazygames-videos.mjs --list-seeds   (print candidate rounds to pick a new SEED)
//
// Output: dist/crazygames-videos/{landscape-1920x1080,portrait-1080x1620}.mp4, about 18 seconds each.
// Headless Chrome (or Edge) plays a scripted Unlimited game: five rounds, then the result screen.
// The DevTools screencast keeps each frame's real timestamp, and ffmpeg turns them into 30 fps H.264.
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'dist', 'crazygames');
const out = join(root, 'dist', 'crazygames-videos');
if (!existsSync(join(site, 'index.html'))) throw new Error('Run node tools/build-crazygames.mjs first.');

// Unlimited games start from a random seed. This one gives five well-known pairs (Leaning Tower of Pisa vs giraffe,
// coconut palm vs city bus, house door vs blue whale, ...). The pairs depend on the object list, so after adding or
// removing objects, run with --list-seeds and pick a seed again.
const SEED = process.env.SEED || 'cg-vid-16';
// Each round: how long the slider glides, how far off the final guess is (1 = exact), how long the answer stays up
// Two rounds miss by about 12%, so the video also shows how near misses are scored.
const ROUNDS = [
  { slide: 2000, off: 1.02, hold: 1800 },
  { slide: 1300, off: 1.12, hold: 1300 },
  { slide: 1000, off: 0.97, hold: 1000 },
  { slide: 700, off: 0.88, hold: 800 },
  { slide: 700, off: 1.01, hold: 800 }
];
const LAYOUTS = [
  // CSS size × scale = video size. 1280×720 is about the CrazyGames frame on a laptop. CrazyGames wants the portrait
  // video at 2:3 (not 9:16), so it is 450×675 of phone-sized page, tall enough to keep Lock in on screen.
  // `capture` is how sharply the page is drawn while recording; ffmpeg scales up to the video size. The big landscape
  // frame is slow to capture, and a smooth video matters more than razor-sharp text in a hover preview.
  { name: 'landscape-1920x1080', w: 1280, h: 720, scale: 1.5, capture: 1.2 },
  { name: 'portrait-1080x1620', w: 450, h: 675, scale: 2.4 },
  // Playgama takes the portrait video at 9:16
  { name: 'portrait-1080x1920', w: 450, h: 800, scale: 2.4 }
];

const browserPath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(existsSync);
if (!browserPath) throw new Error('Install Chrome or Edge to record the videos.');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- a tiny static server for the build ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const path = normalize(join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const file = path.endsWith('\\') || path.endsWith('/') ? join(path, 'index.html') : path;
  if (!file.startsWith(site) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// ---- Chrome DevTools Protocol over the browser's own WebSocket ----
async function openBrowser() {
  const profile = mkdtempSync(join(tmpdir(), 'sizeit-rec-'));
  const proc = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ }
  }
  if (!port) throw new Error('The browser did not start.');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const waiting = new Map(), listeners = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const { r, j } = waiting.get(m.id); waiting.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
    else if (m.method) listeners.forEach(f => f(m));
  };
  const send = (method, params = {}) => new Promise((r, j) => { const n = ++id; waiting.set(n, { r, j }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expr => {
    const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    return res.result.value;
  };
  const close = () => { try { ws.close(); } catch { /* ignore */ } proc.kill(); setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file; the temp folder is cleaned up later */ } }, 2500); };
  return { send, evaluate, on: f => listeners.push(f), close };
}

// Before the game loads: skip the first-visit intro, use metric units, and hand Unlimited our seed
const PRELOAD = seed => `
  try { localStorage.setItem('sg_intro_how-big', 'true'); localStorage.setItem('sg_units', '"metric"'); localStorage.setItem('sg_howbig_cat', '"all"'); } catch {}
  Object.defineProperty(window, 'SG', { configurable: true, set(v) {
    v.randomSeed = () => ${JSON.stringify(seed)};
    Object.defineProperty(window, 'SG', { value: v, writable: true, configurable: true });
  } });`;

async function load(b, layout, seed) {
  await b.send('Page.enable');
  await b.send('Runtime.enable');
  await b.send('Emulation.setDeviceMetricsOverride', { width: layout.w, height: layout.h, deviceScaleFactor: layout.capture || layout.scale, mobile: layout.w < 600 });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: PRELOAD(seed) });
  await b.send('Page.navigate', { url: base + '?mode=unlimited' });
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    if (await b.evaluate('!!(window.__howbig && document.fonts.status === "loaded")').catch(() => false)) break;
  }
  await sleep(600);
}

if (process.argv.includes('--list-seeds')) {
  const b = await openBrowser();
  await load(b, LAYOUTS[0], SEED);
  const rows = await b.evaluate(`Array.from({ length: 30 }, (_, i) => 'cg-vid-' + String(i).padStart(2, '0')).map(s =>
    s + ': ' + window.__howbig.makePairs(s, 'all').map(p => p.tgt.name + ' vs ' + p.ref.name).join(' | '))`);
  console.log(rows.join('\n'));
  b.close(); server.close();
  process.exit(0);
}

// The scripted game, run inside the page
const PLAY = `(async () => {
  const H = window.__howbig, $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const rounds = ${JSON.stringify(ROUNDS)};
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  function slide(to, ms) {
    const s = $('slider'), from = parseFloat(s.value), t0 = performance.now();
    return new Promise(done => requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / ms);
      s.value = from + (to - from) * ease(k);
      s.dispatchEvent(new Event('input'));
      k < 1 ? requestAnimationFrame(step) : done();
    }));
  }
  await wait(600);
  for (const r of rounds) {
    const p = H.S.pairs[H.S.i];
    const truth = Math.log(p.tgt.size / p.ref.size);
    // overshoot past the answer, then settle on the final guess, the way a person would
    const over = truth + (truth > H.S.lr ? 0.35 : -0.35);
    await slide(over, r.slide * 0.6);
    await slide(truth + Math.log(r.off), r.slide * 0.4);
    await wait(350);
    $('lockBtn').click();
    // a real player's first drag hides the hint; the slider does not, so hide it here before it covers the answer
    $('dragHint').hidden = true;
    await wait(r.hold);
    $('nextBtn').click();
    await wait(350);
  }
  await wait(2600);
  return H.S.scores;
})()`;

mkdirSync(out, { recursive: true });
for (const layout of LAYOUTS) {
  const b = await openBrowser();
  await load(b, layout, SEED);
  const frames = [];
  const dir = mkdtempSync(join(tmpdir(), 'sizeit-frames-'));
  b.on(m => {
    if (m.method !== 'Page.screencastFrame') return;
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(m.params.data, 'base64'));
    frames.push({ file, t: m.params.metadata.timestamp });
    b.send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  });
  await b.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: layout.w * (layout.capture || layout.scale), maxHeight: layout.h * (layout.capture || layout.scale), everyNthFrame: 1 });
  const scores = await b.evaluate(PLAY);
  await b.send('Page.stopScreencast');
  await sleep(300);
  b.close();

  // Each frame lasts until the next one arrives; ffmpeg's concat list carries those durations
  const list = frames.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, (frames[i + 1] ? frames[i + 1].t : f.t + 0.1) - f.t).toFixed(4)}`).join('\n') +
    `\nfile '${frames[frames.length - 1].file.replace(/\\/g, '/')}'\n`;
  writeFileSync(join(dir, 'list.txt'), list);
  const mp4 = join(out, `${layout.name}.mp4`);
  const [vw, vh] = [layout.w * layout.scale, layout.h * layout.scale];
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    // JPEG frames are full-range; convert to the standard limited range so every player shows the same colours
    '-vf', `scale=${vw}:${vh}:flags=lanczos:in_range=pc:out_range=tv,fps=30,format=yuv420p`, '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-t', '20',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  const secs = frames.length ? (frames[frames.length - 1].t - frames[0].t).toFixed(1) : 0;
  console.log(`${mp4}  (${frames.length} frames over ${secs}s, scores ${scores.join(', ')})`);
}
server.close();

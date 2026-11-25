// Builds the CrazyGames version of Size It Up into dist/crazygames/ and dist/size-it-up-crazygames.zip.
//
//   node tools/build-crazygames.mjs
//
// It reuses the real game (size-it-up/game.js, data/objects.js, assets/style.css) and patches only what
// CrazyGames does not allow (outside links, analytics, leaderboard) plus the SDK hooks. A patch that no longer
// matches stops the build, so the game and this script cannot drift apart without anyone noticing.
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'crazygames');
const zip = join(root, 'dist', 'size-it-up-crazygames.zip');
const read = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

function patch(text, from, to, label) {
  if (typeof from === 'string' ? !text.includes(from) : !from.test(text)) throw new Error(`Patch no longer matches: ${label}`);
  return text.replace(from, to);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

// ---- index.html ----
let html = read('size-it-up/index.html');
html = patch(html, /  <script>window\.dataLayer[^\n]*<\/script>\n/, '', 'analytics script');
html = patch(html, /  <!-- seo:start -->[\s\S]*?<!-- seo:end -->\n/, '', 'seo block');
html = patch(html, /  <link rel="icon"[^\n]*\n  <link rel="manifest"[^\n]*\n/, '', 'icon and manifest links');
html = patch(html, /  <noscript>[^\n]*<\/noscript>\n/, '', 'analytics noscript');
html = patch(html, 'href="../fonts/bricolage-latin.woff2"', 'href="fonts/bricolage-latin.woff2"', 'font preload');
html = patch(html, 'href="../assets/style.css"', 'href="style.css"', 'stylesheet');
html = patch(html, /    <article class="seo guide">[\s\S]*?<\/article>\n/, '', 'SEO article');
html = patch(html, '<meta name="theme-color"', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  <meta name="theme-color"', 'sdk script');
html = patch(html, '<title>Size It Up: How Big Is It Really? Daily Size Guessing Game</title>', '<title>Size It Up</title>', 'title');
html = patch(html, '<html lang="en" data-root="../">', '<html lang="en">', 'html tag');
// Share only copies text, and challenge links need a public address, so the challenge row goes
html = patch(html, '<button class="primary" id="shareBtn">Share result</button>', '<button class="primary" id="shareBtn">Copy result</button>', 'share button');
html = patch(html, /      <div class="challenge-box">[\s\S]*?<\/div>\n/, '      <div class="challenge-box" hidden><input type="text" id="nameInput"><button id="challengeBtn"></button></div>\n', 'challenge box');
html = patch(html, '<script src="../assets/common.js"></script>\n  <script src="../data/objects.js"></script>\n  <script src="game.js"></script>',
  '<script src="cg-sdk.js"></script>\n  <script src="cg-common.js"></script>\n  <script src="objects.js"></script>\n  <script src="game.js"></script>', 'game scripts');
writeFileSync(join(out, 'index.html'), html);

// ---- game.js ----
let js = read('size-it-up/game.js');
js = patch(js, 'function startRound() {\n    const p = pair();', 'function startRound() {\n    CG.gameplayStart();\n    const p = pair();', 'gameplayStart');
js = patch(js, "S.phase = 'done';\n    el.game.hidden = true;", "S.phase = 'done';\n    CG.gameplayStop();\n    el.game.hidden = true;", 'gameplayStop');
js = patch(js, 'if (S.scores[S.i] >= 190) SG.confetti(40);', 'if (S.scores[S.i] >= 190) { SG.confetti(40); CG.happytime(); }', 'happytime');
js = patch(js, ' · <a href="../categories/">all categories</a>', '', 'categories link');
js = patch(js, ' · <a href="../categories/">play by category</a>', '', 'categories link 2');
// a midgame ad between games, when the player taps "Play Unlimited" / "Play again"
js = patch(js, "el.againBtn.addEventListener('click', () => {\n", "el.againBtn.addEventListener('click', () => CG.midgame(() => {\n", 'ad on play again');
js = patch(js, "      start('unlimited');\n    }\n  });", "      start('unlimited');\n    }\n  }));", 'ad on play again (end)');
writeFileSync(join(out, 'game.js'), js);

// ---- style.css, data, fonts, SDK files ----
writeFileSync(join(out, 'style.css'), patch(read('assets/style.css'), /\.\.\/fonts\//g, 'fonts/', 'font paths') +
  `
/* CrazyGames build */
body.ad-playing { pointer-events: none; }
/* Everything a round needs, including Lock in, fits on one phone screen without scrolling.
   The header already names the game, so the big title goes and only the mode switch stays. */
@media (max-width: 560px) {
  .ghero { padding: 10px 0 8px; }
  .ghero .title { display: none; }
  .prompt { font-size: 1.05rem; margin: 8px 0; }
  .prompt small, .hint { display: none; }
  #board { height: 36vh; min-height: 200px; }
  /* − slider + on one row, Lock in full width below */
  .controls { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; margin-top: 10px; }
  .controls input[type=range] { order: 1; min-width: 0; flex-basis: auto; }
  .controls #lockBtn { grid-column: 1 / -1; }
}
/* short windows: the CrazyGames frame on a laptop (about 1280x720), or a phone turned sideways */
@media (max-height: 820px) and (min-width: 561px) {
  .ghero { padding: 10px 0 8px; }
  .ghero .title { display: none; }
  .prompt { margin: 8px 0; }
  .prompt small, .hint { display: none; }
  #board { height: 38vh; min-height: 200px; }
  .controls { margin-top: 10px; }
}
`);
// source URLs are never shown in this build, so leave them out of the data too
writeFileSync(join(out, 'objects.js'), read('data/objects.js').replace(/ ?src: 'https:[^']*',?/g, '').replace("const W = 'https://en.wikipedia.org/wiki/';", "const W = '';"));
cpSync(join(root, 'crazygames', 'cg-common.js'), join(out, 'cg-common.js'));
cpSync(join(root, 'crazygames', 'cg-sdk.js'), join(out, 'cg-sdk.js'));
// the font's licence (SIL OFL) has to travel with the font files
cpSync(join(root, 'fonts', 'OFL.txt'), join(out, 'fonts', 'OFL.txt'));
cpSync(join(root, 'fonts', 'bricolage-latin.woff2'), join(out, 'fonts', 'bricolage-latin.woff2'));
cpSync(join(root, 'fonts', 'bricolage-latin-ext.woff2'), join(out, 'fonts', 'bricolage-latin-ext.woff2'));

// ---- outside links: fail the build if any slipped through (the SDK script is the one allowed address) ----
for (const f of ['index.html', 'objects.js', 'game.js', 'cg-common.js', 'cg-sdk.js', 'style.css']) {
  const t = readFileSync(join(out, f), 'utf8').replace('https://sdk.crazygames.com/crazygames-sdk-v3.js', '');
  const hits = (t.match(/https?:\/\/[^\s"'`)<]+/g) || []).filter(u => u !== 'http://www.w3.org/2000/svg');
  if (hits.length) throw new Error(`Outside link in ${f}: ${hits[0]}`);
}

// ---- zip (bsdtar ships with Windows 10+ and writes forward-slash paths) ----
if (existsSync(zip)) rmSync(zip);
// on Windows use the built-in bsdtar by full path: Git Bash's GNU tar would read "C:" as a remote host
execFileSync(process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe') : 'tar', ['-a', '-c', '-f', zip, '-C', out, '.'], { stdio: 'inherit' });
console.log(`Built ${out}\nZip: ${zip}`);

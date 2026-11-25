// Builds the Playgama version of Size It Up into dist/playgama/ and dist/size-it-up-playgama.zip.
//
//   node tools/make-playgama-sounds.mjs      (once, makes the sound files)
//   node tools/build-playgama.mjs
//
// It starts from the CrazyGames build (no portal links, no pop-culture characters, one-screen layout) and then swaps
// the CrazyGames SDK for the Playgama Bridge, moves saved progress to Bridge storage, adds sound and a mute button,
// and removes emoji from the interface. A patch that no longer matches stops the build.
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'playgama');
const zip = join(root, 'dist', 'size-it-up-playgama.zip');
const sounds = join(root, 'dist', 'playgama-sounds');
if (!existsSync(join(sounds, 'music.mp3'))) throw new Error('Run node tools/make-playgama-sounds.mjs first.');

// the CrazyGames build is the starting point
execFileSync(process.execPath, [join(root, 'tools', 'build-crazygames.mjs')], { stdio: 'ignore' });
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'dist', 'crazygames'), out, { recursive: true });

const read = p => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
function patch(text, from, to, label) {
  if (typeof from === 'string' ? !text.includes(from) : !from.test(text)) throw new Error(`Patch no longer matches: ${label}`);
  return text.replace(from, to);
}

// ---- index.html: the Bridge is the first script in <head>; one boot script loads the rest ----
let html = read(join(out, 'index.html'));
html = patch(html, '  <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n', '', 'CrazyGames SDK tag');
html = patch(html, '<head>\n', '<head>\n  <script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>\n', 'Bridge tag');
html = patch(html, '<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="style.css">\n  <link rel="stylesheet" href="playgama.css">', 'stylesheet');
html = patch(html, /  <script src="cg-sdk.js"><\/script>\n[\s\S]*?<script src="game.js"><\/script>/, '  <script src="pg-boot.js"></script>', 'game scripts');
writeFileSync(join(out, 'index.html'), html);

// ---- progress through the Bridge storage; emoji out of the interface ----
let common = read(join(out, 'cg-common.js'));
common = patch(common, /  const store = \{[\s\S]*?\n  \};\n/, '  const store = window.__pgStore;\n', 'storage');
common = patch(common, "['👀',", "['1',", 'intro emoji 1');
common = patch(common, "['↔️',", "['2',", 'intro emoji 2');
common = patch(common, "['🎯',", "['3',", 'intro emoji 3');
writeFileSync(join(out, 'cg-common.js'), common);

// ---- game.js: sound, and emoji out of the interface ----
let js = read(join(out, 'game.js'));
js = patch(js, '    S.guesses.push(g);\n',
  "    S.guesses.push(g);\n    { const sc = S.scores[S.scores.length - 1]; CG.sfx('lock'); setTimeout(() => CG.sfx(sc >= 190 ? 'great' : sc >= 120 ? 'good' : sc >= 60 ? 'ok' : 'miss'), 170); }\n", 'lock sound');
js = patch(js, "    if (S.phase !== 'reveal') return;\n    S.i++;", "    if (S.phase !== 'reveal') return;\n    CG.sfx('next');\n    S.i++;", 'next sound');
js = patch(js, '    const tot = total();\n', "    const tot = total();\n    CG.sfx(tot >= 800 ? 'win' : 'next');\n", 'result sound');
js = patch(js, '    S.lr = Math.max(-LOG_RANGE, Math.min(LOG_RANGE, v));\n', '    S.lr = Math.max(-LOG_RANGE, Math.min(LOG_RANGE, v));\n    CG.tick(S.lr);\n', 'tick sound');
js = patch(js, "el.resBlocks.textContent = S.scores.map(block).join('');",
  "el.resBlocks.innerHTML = S.scores.map(s => `<i class=\"sq ${s >= 180 ? 'g' : s >= 120 ? 'y' : s >= 60 ? 'o' : 'r'}\"></i>`).join('');", 'result squares');
js = patch(js, '`🔥 ${st.cur}`', '`Streak ${st.cur}`', 'streak emoji');
writeFileSync(join(out, 'game.js'), js);

// ---- files ----
for (const f of ['pg-boot.js', 'pg-sdk.js', 'pg-audio.js', 'playgama.css', 'playgama-bridge-config.json']) cpSync(join(root, 'playgama', f), join(out, f));
rmSync(join(out, 'cg-sdk.js'));
mkdirSync(join(out, 'sounds'), { recursive: true });
for (const f of readdirSync(sounds).filter(f => f.endsWith('.mp3'))) cpSync(join(sounds, f), join(out, 'sounds', f));

// ---- checks: only the Bridge address may appear, and no emoji may be left in what the player sees ----
const ALLOWED = new Set(['https://bridge.playgama.com/v2/stable/playgama-bridge.js', 'http://www.w3.org/2000/svg']);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
for (const f of ['index.html', 'objects.js', 'game.js', 'cg-common.js', 'pg-boot.js', 'pg-sdk.js', 'pg-audio.js', 'style.css', 'playgama.css']) {
  const t = read(join(out, f));
  const bad = (t.match(/https?:\/\/[^\s"'`)<]+/g) || []).filter(u => !ALLOWED.has(u));
  if (bad.length) throw new Error(`Outside link in ${f}: ${bad[0]}`);
  if (f.endsWith('.js') && /localStorage|sessionStorage|indexedDB/.test(t) && f !== 'pg-boot.js') throw new Error(`${f} must not use browser storage`);
  // emoji are only allowed in the "Copy result" text, which is a message the player sends, not interface
  if (f !== 'game.js' && f !== 'cg-common.js' && EMOJI.test(t)) throw new Error(`Emoji in ${f}`);
}
if (/localStorage/.test(read(join(out, 'cg-common.js')))) throw new Error('cg-common.js still uses localStorage');

if (existsSync(zip)) rmSync(zip);
// on Windows use the built-in bsdtar by full path: Git Bash's GNU tar would read "C:" as a remote host
execFileSync(process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar',
  ['-a', '-c', '-f', zip, '-C', out, '.'], { stdio: 'inherit' });
console.log(`Built ${out}\nZip: ${zip}`);

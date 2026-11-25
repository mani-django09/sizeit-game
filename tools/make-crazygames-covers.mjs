// Renders the three CrazyGames covers from crazygames/cover.html with headless Chrome or Edge:
//
//   node tools/make-crazygames-covers.mjs
//
// Output: dist/crazygames-covers/{landscape-1920x1080,portrait-800x1200,square-800x800}.png
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'crazygames-covers');
mkdirSync(out, { recursive: true });

const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(existsSync);
if (!browser) throw new Error('Install Chrome or Edge to render the covers.');

const page = pathToFileURL(join(root, 'crazygames', 'cover.html')).href;
for (const [layout, w, h] of [['landscape', 1920, 1080], ['portrait', 800, 1200], ['square', 800, 800]]) {
  const file = join(out, `${layout}-${w}x${h}.png`);
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--window-size=${w},${h}`, '--force-device-scale-factor=1', '--virtual-time-budget=4000',
    `--screenshot=${file}`, `${page}?layout=${layout}`], { stdio: 'ignore' });
  console.log(file);
}

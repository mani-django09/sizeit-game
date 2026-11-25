// Writes one static, indexable page per featured category: /categories/<slug>/index.html
// Each page has its own title, description, intro, object list and FAQ, so Google can index it on its own.
// The build step (tools/build.py) adds FAQ and breadcrumb structured data afterwards.
//
//     node tools/gen-category-pages.js
//
// To add a category page: add an entry to PAGES, run this, then add its URL to sitemap.xml and
// _routes.json, and to the PAGE_SLUGS maps in index.html and categories/index.html.
const fs = require('fs');
const path = require('path');

global.window = {};
require('../data/objects.js');
const OBJECTS = window.OBJECTS, inCategory = window.inCategory;
const ROOT = path.join(__dirname, '..');
const SITE = 'https://sizeit.games';

const PAGES = [
  { id: 'animals', slug: 'animals', emoji: '🐘', h1: 'Animal Size Comparison Game',
    title: 'Animal Size Comparison Game: Daily & Unlimited | sizeit.games',
    desc: 'How big is a giraffe next to a tiger, or a blue whale next to a bus? Play the free daily animal size game and see every answer at true scale.',
    art: ['cat', 'ostrich', 'elephant', 'giraffe'],
    intro: ['Animals are the easiest things to picture and the hardest to size. Most people know a giraffe is tall and a whale is huge, but not by how much. In this category every round puts two animals side by side at their real size, and you resize the orange one until the pair looks right.',
      'Sizes are typical values for an adult of the species, with a public source linked after each answer. Animals vary, so we use the commonly quoted figure.'] },
  { id: 'dinos', slug: 'dinosaurs', emoji: '🦖', h1: 'Dinosaur Size Comparison Game',
    title: 'Dinosaur Size Comparison Game: How Big Were They? | sizeit.games',
    desc: 'Velociraptor, Stegosaurus, Spinosaurus and Argentinosaurus at true scale. Play the free daily dinosaur size game and test how well you know their size.',
    art: ['raptor', 'ptera', 'stego', 'trike'],
    intro: ['Dinosaurs in films are rarely the right size. The real Velociraptor was about the size of a turkey, while the biggest plant-eaters were longer than a tennis court. This category lets you guess dinosaur against dinosaur and then shows the real size drawn to scale.',
      'Dinosaur sizes come from fossils, so they are estimates that scientists keep refining. We use commonly quoted figures and link a source after every answer.'] },
  { id: 'space', slug: 'space', emoji: '🪐', h1: 'Space Size Comparison Game',
    title: 'Space Size Comparison Game: Planets & Rockets | sizeit.games',
    desc: 'Compare planets, the Moon, the Sun, rockets and the International Space Station. Play the free daily space size game and see how far off your guess was.',
    art: ['moon', 'mars', 'earth'],
    intro: ['Space is where size intuition breaks completely. The Sun is far bigger than Jupiter, which is far bigger than Earth, and a rocket that looks enormous on the launch pad is a speck next to any planet. Each pair here is chosen to be close enough to compare by eye.',
      'Planets and stars are measured by diameter, rockets and stations by height or length. Every answer shows the real number and links to its source.'] },
  { id: 'landmarks', slug: 'landmarks', emoji: '🗼', h1: 'Landmark Size Comparison Game',
    title: 'Landmark Size Comparison Game: Towers & Statues | sizeit.games',
    desc: 'Eiffel Tower, Burj Khalifa, Statue of Liberty, Qutub Minar and more at true scale. Play the free daily landmark size game and see how well you judge height.',
    art: ['gateway', 'indiagate', 'liberty', 'qutub'],
    intro: ['Famous landmarks look huge in photos, but photos hide their real height. Is the Statue of Liberty taller than India Gate? How many Qutub Minars would you stack to match the Burj Khalifa? This category puts monuments, towers and statues next to each other at true scale.',
      'Heights come from official sources and standard references, and every answer links to its source.'] },
  { id: 'vehicles', slug: 'vehicles', emoji: '🚌', h1: 'Vehicle Size Comparison Game',
    title: 'Vehicle Size Comparison Game: Cars to Ships | sizeit.games',
    desc: 'Scooters, autos, buses, a Boeing 747 and the Titanic at true scale. Play the free daily vehicle size game and see how long things really are.',
    art: ['scooter', 'auto', 'car', 'pickup'],
    intro: ['From a scooter to an ocean liner, vehicles are measured end to end. This category pairs everyday vehicles you see on the road with jets and ships you only see from far away, and asks you to resize one until it matches the other.',
      'Lengths are standard figures for a typical model, with a public source linked after each answer.'] },
  { id: 'pop', slug: 'pop-culture', game: 'pop-culture', emoji: '⚡', h1: 'Pop Culture Size Comparison Game',
    title: 'Pop Culture Size Game: Pokémon, Star Wars & More | sizeit.games',
    desc: 'How tall is Pikachu next to Yoda, or Godzilla next to a Gundam? Play the free daily pop culture size game with characters at their stated size.',
    art: ['yoda', 'vader', 'chewie'],
    intro: ['Characters, creatures and machines from games, films and anime, drawn at the size their official sources state. Fictional sizes are a fun test: Pikachu is smaller than most people guess, and Ultraman is as tall as a 13-storey building.',
      'These sizes are the ones stated by the creators or the official guides, not measurements. The drawings are our own simple silhouettes, and the characters belong to their respective owners.'] }
];

PAGES.push(...require('./category-pages-more.js'));
for (const p of PAGES) p.game = p.game || p.slug;   // every category gets a playable page at /<slug>/
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d) => Number(x.toFixed(d)).toLocaleString('en-US');
function fmt(m) {
  if (m >= 1000) return num(m / 1000, m >= 100000 ? 0 : 1) + ' km';
  if (m >= 1) return num(m, 2) + ' m';
  if (m >= 0.01) return num(m * 100, 1) + ' cm';
  return num(m * 1000, 1) + ' mm';
}
const LABEL = { animals: 'Animals', dinos: 'Dinosaurs', space: 'Space', landmarks: 'Landmarks', vehicles: 'Vehicles', pop: 'Pop Culture', everyday: 'Everyday Objects', food: 'Food', tiny: 'Bugs & tiny things', geo: 'Geography', sports: 'Sports', famous: 'Famous', india: 'India', usa: 'USA' };
// The category's icon: an emoji, or a flag image (Windows shows flag emoji as two letters)
const mark = (p, R) => p.flag ? `<img class="flag" src="${R}icons/${p.flag}.svg" alt="" width="30" height="20">` : p.emoji;
const DIM = { h: 'tall', l: 'long', d: 'across' };

// A page with `game: '<folder>'` becomes a playable game page at /<folder>/ (Size It Up locked to that
// category) instead of a landing page under /categories/. Its old /categories/<slug>/ URL redirects there.
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'size-it-up', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); if (i < 0 || j < 0) throw new Error('template changed: ' + a); return s.slice(i, j); };
const GAME_MARKUP = between(TEMPLATE, '    <div class="banner" id="banner" hidden></div>', '    <article class="seo guide">');
const DIALOGS = between(TEMPLATE, '  <dialog id="helpDlg">', '  <script src="../assets/common.js">');
const target = q => q.game ? q.game + '/' : 'categories/' + q.slug + '/';

for (const p of PAGES) {
  const isGame = !!p.game;
  const R = isGame ? '../' : '../../';                  // from this page back to the site root
  const objs = OBJECTS.filter(o => inCategory(o, p.id)).sort((a, b) => a.size - b.size);
  const facts = objs.filter(o => o.fact).slice(0, 3);
  const url = `${SITE}/${target(p)}`;
  const others = PAGES.filter(q => q.id !== p.id);
  const topic = p.h1.replace(' Size Comparison Game', '').toLowerCase();
  const li = objs.map(o => `          <li><b>${esc(o.name)}</b> <span>${esc(fmt(o.size))} ${DIM[o.dim]}</span></li>`).join('\n');
  const factHtml = facts.map(o => `<li>${esc(o.fact)}</li>`).join('\n          ');
  const faq = [
    [`How does the ${topic} Daily work?`,
      `You get five pairs from this category, the same for everyone that day. The grey object is drawn at its real size and you resize the orange one until the pair looks right. A green outline shows the truth, and each round is worth up to 200 points. A new set arrives at midnight, your time.`],
    [`Where do the sizes come from?`,
      `From public references such as official pages and standard encyclopaedia figures. Every answer in the game links to its source after you lock in your guess.`],
    [`Can I practise before the Daily?`,
      `Yes. Unlimited gives you fresh ${topic} pairs as many times as you like, with no score pressure.`]
  ].map(([q, a]) => `        <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');

  const head = `<!doctype html>
<html lang="en" data-root="${R}"${isGame ? ` data-cat="${p.id}"` : ''}>
<head>
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MQVNQMMM');</script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}">
  <!-- seo:start -->
  <link rel="canonical" href="${url}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="sizeit.games">
  <meta property="og:title" content="${esc(p.h1)}: a Daily every day">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:image" content="${SITE}/og/size-it-up.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(p.h1)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="apple-touch-icon" href="${R}icons/apple-touch-icon.png">
  <!-- seo:end -->
  <meta name="theme-color" content="#ff7a1a">
  <link rel="icon" href="${R}icon.svg" type="image/svg+xml">
  <link rel="manifest" href="${R}manifest.webmanifest">
  <link rel="preload" href="${R}fonts/bricolage-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${R}assets/style.css">
</head>
<body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MQVNQMMM" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

  const article = `    <article class="seo guide">
      <section>
        <h2>${isGame ? `How to play the ${esc(topic)} size game` : 'About this category'}</h2>
${p.intro.map(t => `        <p>${esc(t)}</p>`).join('\n')}
        <p>${isGame ? `It plays like <a href="${R}size-it-up/">Size It Up</a>, with every round from this category. You can also browse <a href="${R}categories/">every category</a>.` : `New to the game? Read how <a href="${R}size-it-up/">Size It Up</a> works, or see <a href="${R}categories/">every category</a>.`}</p>
      </section>
      <section>
        <h2>Every object in this category</h2>
        <ul class="obj-list">
${li}
        </ul>
      </section>
      <section>
        <h2>A few things worth knowing</h2>
        <ul>
          ${factHtml}
        </ul>
      </section>
      <section class="faq">
        <h2>Questions</h2>
${faq}
      </section>
      <section>
        <h2>More categories</h2>
        <ul class="obj-list">
${others.map(q => `          <li><a href="${R}${target(q)}">${mark(q, R)} ${esc(LABEL[q.id])}</a></li>`).join('\n')}
          <li><a href="${R}categories/">All categories</a></li>
        </ul>
      </section>
    </article>`;

  let html;
  if (isGame) {
    html = `${head}
  <main class="wrap narrow">
    <div class="ghero">
      <div class="title">
        <span class="badge">${mark(p, R)}</span>
        <div>
          <h1>${esc(p.h1)}</h1>
          <div class="sub" id="sub">${objs.length} objects at true scale · a new Daily every midnight</div>
        </div>
      </div>
      <nav class="modes" aria-label="Modes">
        <button class="mode" data-mode="daily">Daily</button>
        <button class="mode" data-mode="unlimited">Unlimited</button>
      </nav>
    </div>
${GAME_MARKUP}${article}
  </main>

${DIALOGS}  <script src="${R}assets/common.js"></script>
  <script src="${R}data/objects.js"></script>
  <script src="${R}size-it-up/game.js"></script>
</body>
</html>
`;
  } else {
    html = `${head}
  <main class="wrap">
    <div class="ghero">
      <div class="title">
        <span class="badge">${mark(p, R)}</span>
        <div>
          <h1>${esc(p.h1)}</h1>
          <div class="sub">${objs.length} objects at true scale · a new Daily every midnight · five rounds</div>
        </div>
      </div>
    </div>

    <div class="gcard cat-card cat-page-card">
      <div class="art" id="art"></div>
      <div class="body">
        <div class="cat-actions">
          <a class="primary" href="${R}size-it-up/?daily=${p.id}">Play Daily</a>
          <a class="secondary" href="${R}size-it-up/?mode=unlimited&cat=${p.id}">Play Unlimited</a>
        </div>
      </div>
    </div>

${article}
  </main>

  <script src="${R}assets/common.js"></script>
  <script src="${R}data/objects.js"></script>
  <script>
    (() => {
      const { header, lineup } = SG;
      header('categories');
      SG.measureShapes(OBJECTS);
      const objs = ${JSON.stringify(p.art)}.map(id => OBJECTS.find(o => o.id === id)).filter(Boolean);
      document.getElementById('art').innerHTML = lineup(objs.map((o, i) => ({ o, cls: i === objs.length - 1 ? 'ob' : 'oa' })), { w: 480, h: 180, pad: 18, gap: 18 });
    })();
  </script>
</body>
</html>
`;
  }
  const dir = path.join(ROOT, ...target(p).split('/').filter(Boolean));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  if (isGame) fs.rmSync(path.join(ROOT, 'categories', p.slug), { recursive: true, force: true });
  console.log(target(p), objs.length, 'objects');
}

// Homepage: one plain-HTML tile per category game, so the links are in the page source for search engines
{
  const file = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(file, 'utf8');
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  const tile = (href, emoji, name, n) => `        <a class="cat-tile" href="${href}"><span>${emoji}</span><b>${esc(name)}</b>${n} objects</a>`;
  const tiles = [tile('size-it-up/', '🎲', 'Mixed', OBJECTS.length),
    ...PAGES.map(p => tile(target(p), mark(p, ''), LABEL[p.id], OBJECTS.filter(o => inCategory(o, p.id)).length))];
  const block = ['<!-- cat-tiles:start (written by tools/gen-category-pages.js) -->', '      <div class="cat-tiles">', ...tiles, '      </div>', '      <!-- cat-tiles:end -->'].join(nl);
  const out = src.replace(/<!-- cat-tiles:start[\s\S]*?<!-- cat-tiles:end -->/, block);
  if (out === src && !src.includes(block)) throw new Error('homepage cat-tiles markers not found');
  fs.writeFileSync(file, out);
  console.log('homepage tiles:', tiles.length);
}

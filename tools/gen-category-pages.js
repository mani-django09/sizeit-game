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
    title: 'Space Size Comparison Game: Planets, Moons & Rockets | sizeit.games',
    desc: 'Compare planets, the Moon, the Sun, rockets and the International Space Station. Play the free daily space size game and see how far off your guess was.',
    art: ['moon', 'mars', 'earth'],
    intro: ['Space is where size intuition breaks completely. The Sun is far bigger than Jupiter, which is far bigger than Earth, and a rocket that looks enormous on the launch pad is a speck next to any planet. Each pair here is chosen to be close enough to compare by eye.',
      'Planets and stars are measured by diameter, rockets and stations by height or length. Every answer shows the real number and links to its source.'] },
  { id: 'landmarks', slug: 'landmarks', emoji: '🗼', h1: 'Landmark Size Comparison Game',
    title: 'Landmark Size Comparison Game: Towers, Statues & Monuments | sizeit.games',
    desc: 'Eiffel Tower, Burj Khalifa, Statue of Liberty, Qutub Minar and more at true scale. Play the free daily landmark size game and see how well you judge height.',
    art: ['gateway', 'indiagate', 'liberty', 'qutub'],
    intro: ['Famous landmarks look huge in photos, but photos hide their real height. Is the Statue of Liberty taller than India Gate? How many Qutub Minars would you stack to match the Burj Khalifa? This category puts monuments, towers and statues next to each other at true scale.',
      'Heights come from official sources and standard references, and every answer links to its source.'] },
  { id: 'vehicles', slug: 'vehicles', emoji: '🚌', h1: 'Vehicle Size Comparison Game',
    title: 'Vehicle Size Comparison Game: Cars, Planes & Ships | sizeit.games',
    desc: 'Scooters, autos, buses, a Boeing 747 and the Titanic at true scale. Play the free daily vehicle size game and see how long things really are.',
    art: ['scooter', 'auto', 'car', 'pickup'],
    intro: ['From a scooter to an ocean liner, vehicles are measured end to end. This category pairs everyday vehicles you see on the road with jets and ships you only see from far away, and asks you to resize one until it matches the other.',
      'Lengths are standard figures for a typical model, with a public source linked after each answer.'] },
  { id: 'pop', slug: 'pop-culture', emoji: '⚡', h1: 'Pop Culture Size Comparison Game',
    title: 'Pop Culture Size Game: Pokémon, Star Wars & Gundam | sizeit.games',
    desc: 'How tall is Pikachu next to Yoda, or Godzilla next to a Gundam? Play the free daily pop culture size game with characters at their stated size.',
    art: ['pikachu', 'vader', 'gundam', 'godzilla'],
    intro: ['Characters, creatures and machines from games, films and anime, drawn at the size their official sources state. Fictional sizes are a fun test: Pikachu is smaller than most people guess, and Ultraman is as tall as a 13-storey building.',
      'These sizes are the ones stated by the creators or the official guides, not measurements. The drawings are our own simple silhouettes, and the characters belong to their respective owners.'] }
];

PAGES.push(...require('./category-pages-more.js'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d) => Number(x.toFixed(d)).toLocaleString('en-US');
function fmt(m) {
  if (m >= 1000) return num(m / 1000, m >= 100000 ? 0 : 1) + ' km';
  if (m >= 1) return num(m, 2) + ' m';
  if (m >= 0.01) return num(m * 100, 1) + ' cm';
  return num(m * 1000, 1) + ' mm';
}
const LABEL = { animals: 'Animals', dinos: 'Dinosaurs', space: 'Space', landmarks: 'Landmarks', vehicles: 'Vehicles', pop: 'Pop Culture', everyday: 'Everyday Objects', food: 'Food', tiny: 'Bugs & tiny things', geo: 'Geography', sports: 'Sports', famous: 'Famous', india: 'India', usa: 'USA' };
const DIM = { h: 'tall', l: 'long', d: 'across' };

for (const p of PAGES) {
  const objs = OBJECTS.filter(o => inCategory(o, p.id)).sort((a, b) => a.size - b.size);
  const facts = objs.filter(o => o.fact).slice(0, 3);
  const url = `${SITE}/categories/${p.slug}/`;
  const others = PAGES.filter(q => q.id !== p.id);
  const li = objs.map(o => `          <li><b>${esc(o.name)}</b> <span>${esc(fmt(o.size))} ${DIM[o.dim]}</span></li>`).join('\n');
  const factHtml = facts.map(o => `<li>${esc(o.fact)}</li>`).join('\n          ');
  const faq = [
    [`How does the ${p.h1.replace(' Size Comparison Game', '').toLowerCase()} Daily work?`,
      `You get five pairs from this category, the same for everyone that day. The grey object is drawn at its real size and you resize the orange one until the pair looks right. A green outline shows the truth, and each round is worth up to 200 points. A new set arrives at midnight, your time.`],
    [`Where do the sizes come from?`,
      `From public references such as official pages and standard encyclopaedia figures. Every answer in the game links to its source after you lock in your guess.`],
    [`Can I practise before the Daily?`,
      `Yes. Unlimited gives you fresh ${p.h1.replace(' Size Comparison Game', '').toLowerCase()} pairs as many times as you like, with no score pressure.`]
  ].map(([q, a]) => `        <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
  const daily = '../../size-it-up/?daily=' + p.id, unl = '../../size-it-up/?mode=unlimited&cat=' + p.id;

  const html = `<!doctype html>
<html lang="en" data-root="../../">
<head>
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
  <link rel="apple-touch-icon" href="../../icons/apple-touch-icon.png">
  <!-- seo:end -->
  <meta name="theme-color" content="#ff7a1a">
  <link rel="icon" href="../../icon.svg" type="image/svg+xml">
  <link rel="manifest" href="../../manifest.webmanifest">
  <link rel="preload" href="../../fonts/bricolage-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/style.css">
</head>
<body>
  <main class="wrap">
    <div class="ghero">
      <div class="title">
        <span class="badge">${p.emoji}</span>
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
          <a class="primary" href="${daily}">Play Daily</a>
          <a class="secondary" href="${unl}">Play Unlimited</a>
        </div>
      </div>
    </div>

    <article class="seo guide">
      <section>
        <h2>About this category</h2>
${p.intro.map(t => `        <p>${esc(t)}</p>`).join('\n')}
        <p>New to the game? Read how <a href="../../size-it-up/">Size It Up</a> works, or see <a href="../">every category</a>.</p>
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
${others.map(q => `          <li><a href="../${q.slug}/">${q.emoji} ${esc(LABEL[q.id])}</a></li>`).join('\n')}
          <li><a href="../">All categories</a></li>
        </ul>
      </section>
    </article>
  </main>

  <script src="../../assets/common.js"></script>
  <script src="../../data/objects.js"></script>
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
  const dir = path.join(ROOT, 'categories', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(p.slug, objs.length, 'objects');
}

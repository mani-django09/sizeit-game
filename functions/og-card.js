// GET /og-card?g=size-it-up&m=daily&vs=780&by=Rahul
// A 1200×630 PNG for challenge-link previews: "Rahul scored 780/1000 in Size It Up. Can you beat it?"
// functions/_middleware.js points og:image here for every challenge link.
import { ImageResponse, GoogleFont, cache } from '@cf-wasm/og/workerd';
import { GAMES, cleanName } from '../edge/challenge.js';

const BG = '#1b1740', PANEL = '#221d4a', INK = '#f5f2ff', MUTED = '#a9a3c9', ORANGE = '#ff7a1a', SUN = '#ffd166';

// A tiny hyperscript for satori: h('div', { style }, ...children)
// (satori wants every <div> to say display: flex, so h() adds it)
const h = (type, props, ...children) => {
  const kids = children.flat().filter(c => c !== null && c !== false);
  return { type, props: { ...props, style: { display: 'flex', ...(props.style || {}) }, children: kids.length === 1 ? kids[0] : kids } };
};
const row = (style, ...c) => h('div', { style: { display: 'flex', ...style } }, ...c);

export async function onRequestGet(ctx) {
  cache.setExecutionContext(ctx);
  const q = new URL(ctx.request.url).searchParams;
  const game = GAMES[q.get('g')];
  const of = game && game.of[q.get('m') || 'daily'];
  const vs = parseInt(q.get('vs'), 10);
  if (!game || of === undefined || !Number.isFinite(vs) || vs < 0 || vs > 1e6) return new Response('Not found', { status: 404 });
  const by = cleanName(q.get('by')) || 'Your friend';
  const ofText = of.startsWith('/') ? of : of.trim();

  // ruler ticks along the top and bottom edges, like the site header
  const ticks = y => row({ position: 'absolute', left: 0, top: y, width: 1200, height: 26, alignItems: y ? 'flex-end' : 'flex-start' },
    ...Array.from({ length: 45 }, (_, i) => h('div', { style: { width: 3, height: i % 5 === 0 ? 26 : 12, marginRight: 24, background: 'rgba(255,255,255,.14)' } })));

  const logo = row({ width: 64, height: 64, borderRadius: 18, background: INK, alignItems: 'flex-end', padding: '0 0 12px 12px' },
    h('div', { style: { width: 10, height: 16, background: BG, marginRight: 5, borderRadius: 2 } }),
    h('div', { style: { width: 10, height: 28, background: BG, marginRight: 5, borderRadius: 2 } }),
    h('div', { style: { width: 10, height: 40, background: ORANGE, borderRadius: 2 } }));

  const tree = row({ width: 1200, height: 630, background: BG, color: INK, fontFamily: 'Bricolage', position: 'relative', flexDirection: 'column', padding: '58px 70px' },
    ticks(0), ticks(604),
    row({ alignItems: 'center' }, logo, h('div', { style: { fontSize: 38, fontWeight: 800, marginLeft: 20 } }, 'sizeit.games')),
    row({ flex: 1, marginTop: 30, background: PANEL, borderRadius: 36, border: '4px solid #0b0920', boxShadow: '10px 10px 0 #0b0920',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
      h('div', { style: { fontSize: 44, fontWeight: 800, color: ORANGE } }, game.name),
      h('div', { style: { fontSize: 34, color: MUTED, marginTop: 6 } }, `${by} scored`),
      row({ alignItems: 'baseline', marginTop: 2 },
        h('div', { style: { fontSize: 150, fontWeight: 800, lineHeight: 1 } }, String(vs)),
        h('div', { style: { fontSize: 56, fontWeight: 800, color: MUTED, marginLeft: 10 } }, ofText)),
      row({ marginTop: 22, background: SUN, color: BG, fontSize: 38, fontWeight: 800, padding: '10px 30px', borderRadius: 999, border: `4px solid #0b0920` },
        'Can you beat it?'))
  );

  try {
    return await ImageResponse.async(tree, {
      width: 1200, height: 630, format: 'png',
      fonts: [new GoogleFont('Bricolage Grotesque', { name: 'Bricolage', weight: 800 })],
      headers: { 'Cache-Control': 'public, max-age=604800, immutable' }
    });
  } catch (e) {
    console.error('og-card failed:', e && e.stack || e);
    // Never leave a preview without a picture: fall back to the game's own image
    const own = { survival: 'home', 'number-guess': 'number' }[q.get('g')] || q.get('g');
    return Response.redirect(new URL(`/og/${own}.png`, ctx.request.url).href, 302);
  }
}

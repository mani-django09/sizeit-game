// Cloudflare Pages middleware for every HTML page.
//
// 1. Link previews: WhatsApp, X and Facebook ignore relative og:image and canonical URLs. Until
//    tools/set-domain.py has made them absolute, this makes them absolute from the address the page
//    was requested on (a *.pages.dev URL works too), and adds og:url.
// 2. Challenge links (?vs=780&by=Rahul): the preview says "Rahul scored 780/1000 in Size It Up. Can you
//    beat it?" and shows a picture of that score, drawn by functions/og-card.js.
import { challengeFor, challengeTitle } from '../edge/challenge.js';

const isAbs = h => /^https?:\/\//i.test(h || '');
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function onRequest(ctx) {
  const res = await ctx.next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;

  const url = new URL(ctx.request.url);
  const page = url.origin + url.pathname;
  const abs = h => new URL(h, page).href;
  const ch = challengeFor(url);
  let image = null, title = null, ogUrlSeen = false;
  if (ch) {
    const q = new URLSearchParams({ g: ch.id, m: ch.mode, vs: String(ch.vs) });
    if (ch.by) q.set('by', ch.by);
    image = `${url.origin}/og-card?${q}`;
    title = challengeTitle(ch);
  }
  const desc = 'Play the exact same puzzles in your browser. Free, two minutes, no sign-up.';
  const ogUrl = ch ? url.href : page;

  const out = new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(e) { const h = e.getAttribute('href'); if (h && !isAbs(h)) e.setAttribute('href', abs(h)); }
    })
    .on('meta[property="og:url"]', {
      element(e) { ogUrlSeen = true; if (ch || !isAbs(e.getAttribute('content'))) e.setAttribute('content', ogUrl); }
    })
    .on('meta[property="og:type"]', {
      element(e) { if (!ogUrlSeen) e.before(`<meta property="og:url" content="${attr(ogUrl)}">\n  `, { html: true }); }
    })
    .on('meta[property="og:image"]', {
      element(e) {
        const h = e.getAttribute('content');
        if (image) e.setAttribute('content', image);
        else if (h && !isAbs(h)) e.setAttribute('content', abs(h));
      }
    })
    .on('meta[property="og:image:alt"]', { element(e) { if (title) e.setAttribute('content', title); } })
    .on('meta[property="og:title"]', { element(e) { if (title) e.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(e) { if (title) e.setAttribute('content', desc); } })
    .on('meta[name="twitter:card"]', {
      element(e) {
        if (!title) return;
        e.after(`\n  <meta name="twitter:title" content="${attr(title)}">\n  <meta name="twitter:description" content="${attr(desc)}">\n  <meta name="twitter:image" content="${attr(image)}">`, { html: true });
      }
    })
    .transform(res);
  // Challenge pages differ by query string, so don't let a shared cache hand one friend's preview to another
  if (ch) {
    const r = new Response(out.body, out);
    r.headers.set('Cache-Control', 'no-cache');
    return r;
  }
  return out;
}

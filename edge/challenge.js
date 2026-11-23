// Shared by the Cloudflare Pages Functions in functions/: reads a challenge link
// (?vs=780&by=Rahul plus ?date= for a Daily, or ?mode=&s= for other modes) into what the preview shows.
// Keep the game list in step with SITE.games in assets/common.js.

// path segment -> name, and how a score reads in each mode ('/1000' means "780/1000")
export const GAMES = {
  'size-it-up': { name: 'Size It Up', of: { daily: '/1000', unlimited: '/1000', challenge: '/1000' } },
  'which-is-heavier': { name: 'Heavier or Lighter', of: { daily: '/10', endless: ' in a row' } },
  'sort-it': { name: 'Sort It', of: { daily: '/20', unlimited: '/20' } },
  'ballpark': { name: 'Ballpark', of: { daily: '/30', rush: ' in 60s' } },
  'speed-race': { name: 'Speed Race', of: { daily: '/16', endless: ' in a row' } },
  'how-many-fit': { name: 'How Many Fit?', of: { daily: '/1000', unlimited: '/1000' } },
  'how-far': { name: 'How Far?', of: { daily: '/1000', unlimited: '/1000' } },
  'number-guess': { name: 'Number Guess', of: { daily: '/1000', unlimited: '/1000', challenge: '/1000' } },
  'survival': { name: 'Survival', of: { run: ' correct' } },
  'weekly': { name: 'Weekly Challenge', of: { week: '/10' } }
};

// Names come from the URL, so keep them short and plain
export const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>"'&\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

// { id, game, vs, by, of } for a challenge link on a game page, or null
export function challengeFor(url) {
  const id = url.pathname.split('/').filter(Boolean)[0] || '';
  const game = GAMES[id];
  const vs = parseInt(url.searchParams.get('vs'), 10);
  if (!game || !Number.isFinite(vs) || vs < 0 || vs > 1e6) return null;
  // Size It Up and Number Guess also have older ?c= links, played in their Challenge mode
  const mode = url.searchParams.get('c') ? 'challenge' : (url.searchParams.get('mode') || 'daily');
  const of = game.of[mode];
  if (of === undefined) return null;
  return { id, game, vs, by: cleanName(url.searchParams.get('by')), of, mode };
}

export const challengeTitle = c => `${c.by || 'Your friend'} scored ${c.vs}${c.of} in ${c.game.name}. Can you beat it?`;

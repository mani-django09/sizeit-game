# sizeit.games

A portal of daily browser games about size and weight. It is plain HTML, CSS and JavaScript with no build step.

## Run locally

```powershell
python -m http.server 5173
```

Then open http://localhost:5173.

## Structure

| Path | What it holds |
|---|---|
| `index.html` | Portal home: a card for every game |
| `assets/common.js` | **Site config** (site name, list of games) and shared helpers: storage, seeded random, dates, units, share, header |
| `assets/style.css` | Shared styles (light and dark) |
| `data/objects.js` | Object library used by all games: size, weight, category, fact, original silhouette |
| `size-it-up/` | **How Big?** (URL `/size-it-up/`; `/how-big/` redirects here): resize an object to its real size. Daily, Unlimited with categories, and challenge links |
| `categories/` | **Play by category**: a card per object category with Play Daily (`/size-it-up/?daily=animals`, five pairs from that category, the same for everyone that day, saved under `sg_howbig_cat_daily`, never on the leaderboard or streak) and Unlimited (`/size-it-up/?mode=unlimited&cat=animals`) |
| Geography objects | In `data/objects.js` (`cat: 'geo'`): mountains and waterfalls by height (mountains above sea level), rivers and lakes by length. Rivers are drawn straightened out with the `RIVER()` helper, waterfalls from the side with `FALLS()`. They join on 24 Nov 2026 |
| `which-is-heavier/` | **Heavier or Lighter** (URL `/which-is-heavier/`; `/heavier/` redirects here): 10 a day, or an Endless streak |
| `number-guess/` | **Number Guess** (URL `/number-guess/`; `/number/` redirects here): guess a real-world number. Daily, Unlimited with categories, and challenge links |
| `sort-it/` | **Sort It**: order five things by size and by weight. Daily (two rounds) and Unlimited |
| `ballpark/` | **Ballpark**: pick the range a number falls in. Daily (10) and a 60-second Rush. Uses `numbers.js` plus object sizes and weights |
| `speed-race/` | **Speed Race**: pick the faster racer and the size of the gap, then watch them race. Daily (8) and Endless |
| `data/speeds.js` | Racers for Speed Race: name, emoji, speed in km/h, fact |
| `how-many-fit/` | **How Many Fit?**: how many of one thing fit along another. Daily (5) and Unlimited |
| `how-far/` | **How Far?**: straight-line distance between two cities. Daily (3 India + 2 world) and Unlimited |
| `data/cities.js` | Cities for How Far?: name, region, latitude and longitude. Distances are computed, never typed |
| `survival/` | **Survival**: endless mixed questions (size, weight, speed, distance, numbers) against the clock with three lives. Not a Daily, so it has no `daily` block |
| `answers/` | **Daily answers** for any day. It loads each game page out of sight (with `#answers`, which skips the leaderboard) and asks its exposed `window.__<game>` functions for that day's puzzles |
| `suggest/` | **Suggest an object** form. Sends to `suggest_object()` in Supabase, or falls back to an email to `SITE.contact` |
| `weekly/` | **Weekly Challenge**: a themed 10-round quiz every Monday (India, Space, Animals, Big Builds, Sports, Everyday) |
| `archive/` | Every past Daily of every game. A game page opened with `?date=YYYY-MM-DD` plays that day |
| `stats/` | Streaks, averages, bests and today's progress across all games (from this browser only) |
| `data/numbers.js` | Question bank for Number Guess: question, answer, unit, category, fact |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Install as an app and play offline |

## Today's total, badges and share images

These live in `assets/common.js` and need no setup:

- **Today's total**: every Daily counts for up to 100 points (8 games = 800). Shown on the home page, the Stats page and under every Daily result, with a "next game" link.
- **Badges**: 15 badges worked out from what's saved in the browser (`BADGES` in `common.js`). New ones pop up as a toast; all of them are on the Stats page.
- **Share images**: every result screen gets a "Save image" button that draws a 1080×1350 PNG of the result. On phones it opens the share sheet.

## Adding content later (`since`)

Objects, numbers, racers and cities can carry `since: 'YYYY-MM-DD'`. They only join puzzles from that date, so past Dailies and the archive never change. Unlimited modes and categories also wait for that date. Every object, number and racer has a `src` link shown as "Source" after its fact.

## US players

`SG.region` guesses India, US or elsewhere from the time zone (nothing is sent). US players start in feet and pounds. How Far? mixes 2 India + 2 USA + 1 world pairs from 24 Nov 2026, and Unlimited has a USA-only option. Size It Up has India and USA categories.

## Rename the site or a game

Change `SITE.name` and the game names in `assets/common.js`. Then update the `<title>` and `<h1>` of each page.

## Daily #1 and the archive

`SITE.epoch` in `assets/common.js` is the date of Daily #1, and the archive starts there. Set it to your launch date. Puzzles are built from the date itself, so changing the epoch only changes the numbers shown, never the puzzles.

Archive plays are saved with `late: true`. They count in Stats, but not towards streaks.

## Add a game

1. Create a folder, such as `sort/`, with an `index.html` (`data-root="../"`) and a `game.js`. Use `which-is-heavier/` as the template.
2. Add or update its entry in `SITE.games` in `assets/common.js` with `status: 'live'` and a `daily` block (storage key, maximum score, scoring function) so Stats and the Archive pick it up. In `start()`, use `SG.archiveDate` for the Daily's date and spread `...SG.lateFlag()` into the saved record.
3. Add its files to the `SHELL` list in `sw.js`. The cache name is set by `tools/build.py` from a hash of the files, so there's nothing to bump.

## Add an object

Add an entry to `data/objects.js`:

- `dim`: `'h'` for height, `'l'` for length, `'d'` for diameter.
- `size`: the real size in metres.
- `kg`: the typical weight. This is optional; objects without it are left out of Heavier or Lighter.
- `cat`: one of the categories in `CATEGORIES`.
- `svg`: an original drawing, filled shapes only.

Keep a reliable source for every number you add.

## Where it is hosted now

- Live at **https://sizeit.games**, a Cloudflare Pages project named `sizeit`, connected to GitHub `mani-django09/sizeit-game` (branch `main`). Every `git push` to `main` redeploys.
- Pages build settings: framework None, build command `python3 tools/build.py`, output directory `dist`, root directory empty. Cloudflare builds `functions/` itself and installs `package.json`.
- The domain's DNS is on Cloudflare (registered at Hostinger, nameservers pointed to Cloudflare).
- Before the first push of a change, run `python tools/build.py` and the checks you care about locally. The build also needs no network.

## Going live on Cloudflare Pages

1. Set `SITE.contact` in `assets/common.js` to a public email address. It is shown in the footer and on the Privacy page.
2. Set your domain. This makes canonical and social-preview URLs absolute and writes `sitemap.xml` and the `Sitemap:` line in `robots.txt`:

   ```powershell
   python tools/set-domain.py https://sizeit.games
   ```

3. Build the public site into `dist/`. This leaves out tools, notes, the SQL file and the old redirect folders:

   ```powershell
   python tools/build.py
   ```

4. Deploy, either way:
   - **From GitHub (recommended):** push the project, then in Cloudflare go to Workers & Pages → Create → Pages → Connect to Git. Use build command `python3 tools/build.py` and output directory `dist`. Every push then redeploys.
   - **Direct upload:** `npx wrangler pages deploy dist --project-name sizeit`
5. In the Pages project, go to Custom domains and add your domain.

`_redirects` sends `/how-big/` and `/heavier/` to their new URLs with real 301s. `_headers` adds security headers and caching. `404.html` is used automatically for missing pages.

## Leaderboard (Supabase)

After a Daily, players see "You beat 78% of 1,240 players" and a small chart of everyone's scores. No names or accounts are involved. Until it is set up, the site works exactly as before.

1. Create a project at supabase.com. Pick the Mumbai (`ap-south-1`) region if most players are in India.
2. Open SQL Editor → New query, paste all of `supabase/schema.sql` and Run.
3. In Project Settings → API, copy the **Project URL** and the **anon** (or **publishable**) key.
4. Paste both into `SITE.leaderboard` in `assets/common.js`:

   ```js
   leaderboard: { url: 'https://abcd1234.supabase.co', key: 'sb_publishable_...' },
   ```

5. Rebuild and deploy.

If you set up the leaderboard before 23 Nov 2026, run `supabase/schema.sql` again: it now also creates the `object_suggestions` table and `suggest_object()` for the Suggest page. Read suggestions in Table Editor → `object_suggestions`.

How it is protected:

- The browser can't read or change the table. Row Level Security is on with no policies, and the only way in is through `submit_score()` and `day_stats()`.
- Scores outside a game's range are rejected, and a Daily can only be submitted on its own day (give or take one, for time zones).
- One result per browser per game per day, and at most 10 per network per game per day.
- Archive replays and Unlimited or Endless games are never sent.

What it can't stop: someone who looks up the answers and plays perfectly. Every browser game has the answers in its code. Treat the percentages as a friendly comparison, not a prize table.

Free-tier note: Supabase pauses a free project after a week with no requests. A site with daily players keeps it awake.

## Admin panel (`/admin/`)

A password-protected dashboard of what players do: players live now and today, games finished per day, each game's plays, modes and scores, when people play (day × hour), countries, devices, referrers and top pages, a live feed of every event, a list of players (browsers) with a full timeline for each, plus Daily scores, suggestions and leagues. It isn't linked from the site, and it is kept out of search, caches and analytics.

What is logged: `activity` in `assets/common.js` sends `page_view` on every page, `game_end` (game, mode, score) whenever a game calls `SG.vsResult()`, and every `SG.track()` call (shares, random challenges, league actions). Events go in batches to `log_events()` in Supabase with the random device id, a session id (new after 30 idle minutes) and an "OS · browser · device type" label; the server adds the country from Cloudflare. Nothing is sent from localhost unless `localStorage.sg_log_local` is `true`.

Setup:

1. Run `supabase/schema.sql` again in the Supabase SQL Editor. It adds `activity_events`, `log_events()` and the `admin_*` functions, which only the secret key can call.
2. In Cloudflare Pages → the project → Settings → Variables and Secrets, add two **Secrets** for Production:
   - `ADMIN_PASSWORD`: the admin password (long and random).
   - `SUPABASE_SERVICE_KEY`: Supabase → Project Settings → API Keys → a **secret** key (`sb_secret_…`) or the legacy `service_role` key. Never put this key in the site's code.
3. Redeploy, then open `https://sizeit.games/admin/`.

Changing either secret signs the admin out everywhere. `functions/api/admin/[[path]].js` checks the password, keeps you signed in for a week with an HttpOnly cookie, and is the only place the secret key is used. To run it locally, put the same three names (plus `SUPABASE_URL` if needed) in `.dev.vars` (ignored by git) and run `npm run dev`.

**Your own visits**: "Ignore my visits" in the sidebar (on each of your phones and computers) adds that browser to `admin_ignored`. Its new events are no longer stored (`log_events` skips it, and `assets/common.js` stops sending when `localStorage.sg_no_log` is set), and its past activity and Daily scores are left out of every admin number and list. Any player can be ignored from their details, and the Players tab lists ignored browsers with a "Count again" button.

Housekeeping: the dashboard looks back at most a year, so you can delete older events with the commented-out `delete` at the end of `schema.sql`.

## Contact form

`contact/` has a form that posts to `functions/api/contact.js`. The function checks the message and sends it through Gmail's SMTP server (`smtp.gmail.com:465`) with an app password, to your Gmail inbox; Reply-To is the visitor, so Reply in Gmail answers them. Cloudflare Email Routing (`contact@sizeit.games` → your Gmail) covers people who email the address directly. No third-party mail service.

Setup:

1. Google Account → Security → turn on 2-Step Verification, then App passwords → create one ("sizeit.games"). Copy the 16 letters.
2. Cloudflare Pages → the project → Settings → Variables and Secrets, add **Secrets** for Production: `GMAIL_USER` (your Gmail address) and `GMAIL_APP_PASSWORD`. Optional: `CONTACT_TO` (defaults to `GMAIL_USER`).
3. Redeploy.

Until the secrets are set the form shows a "send it by email instead" mailto link. The form has a hidden honeypot field and the function only accepts posts from the site's own origin. To test locally put the same names in `.dev.vars` and run `npm run dev`. If the app password is ever revoked or Google blocks the login, the form falls back to the mailto link.

## Sharing, challenge links and link previews

- **Share sheet**: every Share button opens a small sheet with WhatsApp first, then X, Telegram, Copy and (on phones) the system share menu. `SG.share(text)` in `common.js`. `SG.track(name, data)` is called on every share; it goes to the activity log for the admin panel, and to `window.sgTrack` if a page defines one.
- **Every share is a challenge**: the link carries the score and the player's name (`?vs=780&by=Rahul`). A Daily link adds `?date=`, so a friend plays the same day's puzzles (from the Archive if they open it later). Unlimited, Endless and Rush links add `?mode=&s=<seed>`, so the friend gets the same run. Survival (random every run) and Weekly use `?mode=run` and `?mode=week&s=<monday>`. The friend sees a banner, and "You vs Rahul" at the end. Helpers: `SG.challengeUrl`, `SG.challengeText`, `SG.vsBanner`, `SG.vsResult`.
- **First-visit intro**: three animated steps shown once per game (`HOWTO` in `common.js`). Survival and Weekly explain themselves on their start screens, so they have none.

- **Random Challenge**: `data-random` on any link (home hero, home extras, the Games menu) sends the player to a random game in a non-Daily mode (`RANDOM_MODES` in `common.js`).

### Friends Leagues (`league/`)

A WhatsApp group shares one 6-letter code. Members join with just a name; the table shows Today (points per game, same as Today's total) and This week, with streaks, plus buttons to send the invite and post the standings to the group. After every Daily, the result screen links to your league (or suggests starting one).

- Points come from `daily_scores`, the same rows the leaderboard already gets, so nothing new is sent after a game.
- Members are browsers (the leaderboard's device id) plus a display name. Anyone with the code sees names and points only.
- Limits: 200 members per league, 20 leagues per browser, 5 new leagues per network per day.
- **Setup**: run `supabase/schema.sql` again in the Supabase SQL Editor. It adds `leagues`, `league_members` and the functions `league_create`, `league_join`, `league_leave`, `league_board`. Until then the page says leagues aren't available.

### Cloudflare Pages Functions (link previews)

| Path | What it does |
|---|---|
| `functions/_middleware.js` | Makes canonical, `og:url` and `og:image` absolute from the requested address, so previews work before `set-domain.py` is run and on `*.pages.dev`. For a challenge link it rewrites the title to "Rahul scored 780/1000 in Size It Up. Can you beat it?" and points `og:image` at `/og-card` |
| `functions/og-card.js` | Draws the 1200×630 challenge image (`@cf-wasm/og`). It loads Bricolage Grotesque from Google Fonts at request time; if drawing fails it redirects to the game's own `og/*.png` |
| `edge/challenge.js` | Game names and score formats for both. Keep in step with `SITE.games` |
| `functions/api/admin/[[path]].js` | The admin panel's API: sign-in and the `admin_*` database reads (see Admin panel above) |
| `_routes.json` | Runs the functions only for HTML pages, `/og-card` and `/api/*`, not for scripts and images, to stay inside the free quota. **Add every new page here** |

Cloudflare builds the functions from `functions/` in the project root (not from `dist/`) and installs `package.json` itself, so the build settings above stay the same. To try them locally: `npm install`, then `npm run dev` and open http://localhost:8788.

## SEO helpers

| Path | What it does |
|---|---|
| `tools/set-domain.py` | Absolute canonical, `og:url` and `og:image` URLs, plus `sitemap.xml` and `robots.txt`. Re-run after adding a page (add it to `PAGES` first). |
| `tools/update-links.py` | The plain-HTML "More free games" links at the end of every game page. Re-run after adding a game (add it to `GAMES` first). |
| `tools/build.py` | Copies the public site into `dist/` for Cloudflare Pages |
| `supabase/schema.sql` | Leaderboard table and functions. Run it once in Supabase's SQL Editor |
| `og/*.png` | 1200×630 social preview images, one per page |
| `icons/*.png` | App icons for phones and the install prompt |

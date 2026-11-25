-- Leaderboard for sizeit.games.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again; it only creates what is missing and replaces the functions.
--
-- Design:
--   * One table of Daily results. The browser can never read or write it directly (RLS on, no policies).
--   * Two functions are the only way in: submit_score() and day_stats().
--   * No names, emails or accounts. Each browser has a random device id. The IP address is never stored,
--     only a hash of it salted with the day, so it can't be followed from one day to the next.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.daily_scores (
  id         bigint generated always as identity primary key,
  game       text        not null,
  day        date        not null,
  device     uuid        not null,
  score      integer     not null,
  ip_hash    text,
  created_at timestamptz not null default now(),
  unique (game, day, device)
);
create index if not exists daily_scores_game_day_score on public.daily_scores (game, day, score);
create index if not exists daily_scores_game_day_ip on public.daily_scores (game, day, ip_hash);

alter table public.daily_scores enable row level security;
-- No policies on purpose: the table is only reachable through the security-definer functions below.
revoke all on public.daily_scores from anon, authenticated;

-- Highest possible Daily score for each game. Keep in sync with SITE.games[].daily.max in assets/common.js.
create or replace function public.game_max(p_game text)
returns integer language sql immutable as $$
  select case p_game
    when 'how-big'  then 1000
    when 'heavier'  then 10
    when 'sort'     then 20
    when 'ballpark' then 30
    when 'speed'    then 16
    when 'fit'      then 1000
    when 'far'      then 1000
    when 'number'   then 1000
  end
$$;

-- How one score compares with everyone who played that game's Daily on that day.
-- total: players; below: players with a lower score; equal: players with the same score (including you);
-- bins: player counts in ten equal score bands, lowest first.
create or replace function public.day_stats(p_game text, p_day date, p_score integer)
returns json language sql stable security definer set search_path = public as $$
  with s as (select score from daily_scores where game = p_game and day = p_day),
       m as (select game_max(p_game) as mx)
  select json_build_object(
    'total', (select count(*) from s),
    'below', (select count(*) from s where score < p_score),
    'equal', (select count(*) from s where score = p_score),
    'bins',  (select coalesce(json_agg(c order by b), '[]'::json) from (
                select b, (select count(*) from s, m where least(9, floor(s.score::numeric * 10 / m.mx))::int = b) as c
                from generate_series(0, 9) as b) x)
  )
$$;

-- Save today's Daily result (once per browser per game per day) and return how it compares.
create or replace function public.submit_score(p_game text, p_day date, p_device uuid, p_score integer)
returns json language plpgsql security definer set search_path = public as $$
declare
  mx  integer := game_max(p_game);
  hdr json    := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  ip  text    := coalesce(hdr ->> 'cf-connecting-ip', split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1), '');
  iph text    := encode(extensions.digest(ip || '|' || p_day::text, 'sha256'), 'hex');
  utc_today date := (now() at time zone 'utc')::date;
begin
  if mx is null then raise exception 'unknown game'; end if;
  if p_score is null or p_score < 0 or p_score > mx then raise exception 'score out of range'; end if;
  -- a Daily can only be submitted on its own day, give or take a day for time zones
  if p_day < utc_today - 1 or p_day > utc_today + 1 then raise exception 'not today''s puzzle'; end if;
  -- at most 10 results per game per day from one network, to slow down score stuffing
  if (select count(*) from daily_scores where game = p_game and day = p_day and ip_hash = iph) < 10 then
    insert into daily_scores (game, day, device, score, ip_hash)
    values (p_game, p_day, p_device, p_score, iph)
    on conflict (game, day, device) do nothing;
  end if;
  return day_stats(p_game, p_day, p_score);
end
$$;

grant execute on function public.day_stats(text, date, integer) to anon, authenticated;
grant execute on function public.submit_score(text, date, uuid, integer) to anon, authenticated;

-- Optional housekeeping: results older than a year are no longer shown anywhere.
-- delete from public.daily_scores where day < current_date - 365;

-- ===== Object suggestions (the /suggest/ page) =====
-- Players suggest things to add to the games. Nobody can read the table from the browser;
-- read it in the Supabase dashboard (Table Editor → object_suggestions).
-- Safe to run again: it only creates what's missing.
create table if not exists public.object_suggestions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null,
  category   text,
  measure    text,
  source     text,
  note       text,
  ip_hash    text not null
);
create index if not exists object_suggestions_ip on public.object_suggestions (ip_hash, created_at);
alter table public.object_suggestions enable row level security;
revoke all on public.object_suggestions from anon, authenticated;

-- At most 5 suggestions per network per day; every field is trimmed and capped in length.
create or replace function public.suggest_object(p_name text, p_category text, p_measure text, p_source text, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare
  hdr json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  ip  text := coalesce(hdr ->> 'cf-connecting-ip', split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1), '');
  iph text := encode(extensions.digest(ip || '|' || ((now() at time zone 'utc')::date)::text, 'sha256'), 'hex');
  nm  text := left(btrim(coalesce(p_name, '')), 80);
begin
  if length(nm) < 2 then raise exception 'name required'; end if;
  if (select count(*) from object_suggestions where ip_hash = iph and created_at > now() - interval '1 day') >= 5 then
    return json_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into object_suggestions (name, category, measure, source, note, ip_hash)
  values (nm, left(btrim(p_category), 40), left(btrim(p_measure), 120), left(btrim(p_source), 300), left(btrim(p_note), 500), iph);
  return json_build_object('ok', true);
end
$$;
grant execute on function public.suggest_object(text, text, text, text, text) to anon, authenticated;

-- ===== Friends Leagues (the /league/ page) =====
-- A group (say, a WhatsApp group) shares a 6-letter code. Members are browsers (the same random device id
-- the leaderboard uses) with a display name; there are still no accounts or emails.
-- Standings are worked out from daily_scores, so a member's Daily counts as soon as it is submitted
-- as usual. Anyone with the code can see the names and points in that league, nothing else.
-- Safe to run again: it only creates what's missing and replaces the functions.
create table if not exists public.leagues (
  code       text primary key,
  name       text not null,
  created_at timestamptz not null default now(),
  ip_hash    text not null
);
create index if not exists leagues_ip on public.leagues (ip_hash, created_at);
create table if not exists public.league_members (
  code      text not null references public.leagues (code) on delete cascade,
  device    uuid not null,
  name      text not null,
  joined_at timestamptz not null default now(),
  primary key (code, device)
);
create index if not exists league_members_device on public.league_members (device);
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
revoke all on public.leagues from anon, authenticated;
revoke all on public.league_members from anon, authenticated;

-- Display names: trimmed, no control characters or angle brackets, 1 to 20 characters
create or replace function public.league_clean(p text, p_len integer)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]<>]', '', 'g')), p_len)
$$;

-- Join (or rename yourself in) a league. At most 200 members per league and 20 leagues per browser.
create or replace function public.league_join(p_code text, p_device uuid, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c  text := upper(btrim(coalesce(p_code, '')));
  nm text := league_clean(p_name, 20);
  lg leagues;
begin
  if length(nm) < 1 then raise exception 'name required'; end if;
  select * into lg from leagues where code = c;
  if lg.code is null then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if exists (select 1 from league_members where code = c and device = p_device) then
    update league_members set name = nm where code = c and device = p_device;
  else
    if (select count(*) from league_members where code = c) >= 200 then return json_build_object('ok', false, 'reason', 'full'); end if;
    if (select count(*) from league_members where device = p_device) >= 20 then return json_build_object('ok', false, 'reason', 'too_many'); end if;
    insert into league_members (code, device, name) values (c, p_device, nm);
  end if;
  return json_build_object('ok', true, 'code', lg.code, 'name', lg.name);
end
$$;

-- Start a league and join it. At most 5 new leagues per network per day.
create or replace function public.league_create(p_name text, p_device uuid, p_member text)
returns json language plpgsql security definer set search_path = public as $$
declare
  hdr json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  ip  text := coalesce(hdr ->> 'cf-connecting-ip', split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1), '');
  iph text := encode(extensions.digest(ip || '|' || ((now() at time zone 'utc')::date)::text, 'sha256'), 'hex');
  nm  text := league_clean(p_name, 30);
  abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- no 0/O, 1/I/L: easy to read out loud
  c   text;
begin
  if length(nm) < 2 then raise exception 'league name required'; end if;
  if length(league_clean(p_member, 20)) < 1 then raise exception 'name required'; end if;
  if (select count(*) from leagues where ip_hash = iph and created_at > now() - interval '1 day') >= 5 then
    return json_build_object('ok', false, 'reason', 'limit');
  end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from leagues where code = c);
  end loop;
  insert into leagues (code, name, ip_hash) values (c, nm, iph);
  return league_join(c, p_device, p_member);
end
$$;

create or replace function public.league_leave(p_code text, p_device uuid)
returns json language sql security definer set search_path = public as $$
  delete from league_members where code = upper(btrim(p_code)) and device = p_device;
  select json_build_object('ok', true);
$$;

-- Standings for one league. Points are the same as Today's total on the site: every Daily is worth up to 100.
-- today: points per game for p_day; week: points over the 7 days ending p_day; days: the days each member
-- played in the last 60 (for streaks). Device ids never leave the database; "me" marks the caller's row.
create or replace function public.league_board(p_code text, p_day date, p_device uuid)
returns json language sql stable security definer set search_path = public as $$
  with lg as (select * from leagues where code = upper(btrim(p_code))),
       mem as (select m.* from league_members m join lg using (code)),
       pts as (
         select m.device, s.day, s.game, round(s.score * 100.0 / game_max(s.game))::int as p
         from mem m join daily_scores s on s.device = m.device
         where s.day between p_day - 59 and p_day and game_max(s.game) is not null)
  select case when not exists (select 1 from lg) then json_build_object('ok', false, 'reason', 'not_found') else
  json_build_object(
    'ok', true,
    'code', (select code from lg),
    'name', (select name from lg),
    'member', exists (select 1 from mem where device = p_device),
    'members', (select coalesce(json_agg(json_build_object(
        'name', m.name,
        'me', m.device = p_device,
        'today', (select coalesce(json_object_agg(game, p), '{}'::json) from pts where pts.device = m.device and pts.day = p_day),
        'week', (select coalesce(sum(p), 0) from pts where pts.device = m.device and pts.day > p_day - 7),
        'weekDays', (select count(distinct day) from pts where pts.device = m.device and pts.day > p_day - 7),
        'days', (select coalesce(json_agg(distinct day), '[]'::json) from pts where pts.device = m.device)
      ) order by m.joined_at), '[]'::json) from mem m)
  ) end
$$;

grant execute on function public.league_join(text, uuid, text) to anon, authenticated;
grant execute on function public.league_create(text, uuid, text) to anon, authenticated;
grant execute on function public.league_leave(text, uuid) to anon, authenticated;
grant execute on function public.league_board(text, date, uuid) to anon, authenticated;

-- ===== Activity log and the admin page (/admin/) =====
-- Every page view, finished game, share and league action, so the owner can see how the site is used.
-- Each row carries the same random device id as the leaderboard, a session id (a new one after 30 idle
-- minutes), the country Cloudflare reports for the request and a short "OS · browser · device type" label.
-- No names, IP addresses or exact locations. The browser can only add rows, through log_events().
-- The admin page reads them through the admin_* functions, which only the secret (service role) key can call.
-- Safe to run again: it only creates what's missing and replaces the functions.
create table if not exists public.activity_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device     uuid not null,
  session    text,
  event      text not null,
  page       text,
  game       text,
  mode       text,
  score      integer,
  data       jsonb,
  country    text,
  platform   text,
  ref        text
);
create index if not exists activity_events_time on public.activity_events (created_at);
create index if not exists activity_events_device on public.activity_events (device, created_at);
create index if not exists activity_events_event on public.activity_events (event, created_at);
alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon, authenticated;

-- Browsers the owner marked as their own ("Ignore my visits" on the admin page). Their new events aren't
-- stored, and their old ones are left out of every admin number and list (but not deleted).
create table if not exists public.admin_ignored (
  device     uuid primary key,
  label      text,
  created_at timestamptz not null default now()
);
alter table public.admin_ignored enable row level security;
revoke all on public.admin_ignored from anon, authenticated;

-- Add up to 20 events from one browser. At most 1000 events per browser per day; the rest are dropped.
-- p_events: [{ e: event, p: page path, g: game, m: mode, s: score, r: referrer host, d: { extra fields } }]
create or replace function public.log_events(p_device uuid, p_session text, p_platform text, p_events json)
returns json language plpgsql security definer set search_path = public as $$
declare
  hdr json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  cc  text := nullif(upper(left(btrim(coalesce(hdr ->> 'cf-ipcountry', '')), 2)), '');
begin
  if p_device is null or p_events is null or json_typeof(p_events) <> 'array' then raise exception 'bad request'; end if;
  if exists (select 1 from admin_ignored where device = p_device) then return json_build_object('ok', true); end if;
  if (select count(*) from activity_events where device = p_device and created_at > now() - interval '1 day') >= 1000 then
    return json_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into activity_events (device, session, event, page, game, mode, score, data, country, platform, ref)
  select p_device, left(p_session, 40), ev, left(x ->> 'p', 200), left(x ->> 'g', 20), left(x ->> 'm', 20),
         case when (x ->> 's') ~ '^-?\d{1,9}$' then (x ->> 's')::integer end,
         case when json_typeof(x -> 'd') = 'object' and length((x -> 'd')::text) <= 1000 then (x -> 'd')::jsonb end,
         cc, left(p_platform, 40), left(x ->> 'r', 100)
  from (
    select x, left(regexp_replace(lower(coalesce(x ->> 'e', '')), '[^a-z0-9_]', '', 'g'), 30) as ev
    from json_array_elements(p_events) with ordinality as t(x, i)
    where i <= 20 and json_typeof(x) = 'object'
  ) s
  where ev <> '';
  return json_build_object('ok', true);
end
$$;
grant execute on function public.log_events(uuid, text, text, json) to anon, authenticated;

-- Everything on the admin page's Overview tab for the last p_days days (days counted in p_tz).
create or replace function public.admin_overview(p_days integer default 30, p_tz text default 'Asia/Kolkata')
returns json language plpgsql stable security definer set search_path = public as $$
declare
  d     integer := greatest(1, least(coalesce(p_days, 30), 365));
  today date    := (now() at time zone p_tz)::date;
  since date    := today - d + 1;
begin
  return (
    with ev as (
      select e.id, e.device, e.session, e.event, e.page, e.game, e.mode, e.score, e.country, e.platform, e.ref, e.created_at,
             (e.created_at at time zone p_tz) as lt, (e.created_at at time zone p_tz)::date as day
      from activity_events e
      where e.created_at >= (since::timestamp at time zone p_tz)
        and not exists (select 1 from admin_ignored i where i.device = e.device)
    ),
    firsts as (
      select device, (min(created_at) at time zone p_tz)::date as first_day
      from activity_events where device in (select device from ev) group by device
    ),
    sess as (
      select extract(epoch from max(created_at) - min(created_at)) / 60 as mins
      from ev where session is not null group by session
      having count(*) > 1 and max(created_at) - min(created_at) < interval '6 hours'   -- leave out tabs left open for days
    )
    select json_build_object(
      'today', today, 'since', since, 'days', d, 'tz', p_tz,
      'kpi', json_build_object(
        'live',              (select count(distinct device) from ev where created_at > now() - interval '5 minutes'),
        'players_today',     (select count(distinct device) from ev where day = today),
        'players_yesterday', (select count(distinct device) from ev where day = today - 1),
        'new_today',         (select count(*) from firsts where first_day = today),
        'sessions_today',    (select count(distinct session) from ev where day = today),
        'games_today',       (select count(*) from ev where day = today and event = 'game_end'),
        'games_yesterday',   (select count(*) from ev where day = today - 1 and event = 'game_end'),
        'views_today',       (select count(*) from ev where day = today and event = 'page_view'),
        'players_range',     (select count(distinct device) from ev),
        'new_range',         (select count(*) from firsts where first_day >= since),
        'returning_range',   (select count(*) from (select device from ev group by device having count(distinct day) > 1) r),
        'games_range',       (select count(*) from ev where event = 'game_end'),
        'views_range',       (select count(*) from ev where event = 'page_view'),
        'sessions_range',    (select count(distinct session) from ev),
        'avg_session_min',   (select round(avg(mins)::numeric, 1) from sess),
        'players_all',       (select count(distinct device) from activity_events where device not in (select device from admin_ignored)),
        'events_all',        (select count(*) from activity_events where device not in (select device from admin_ignored)),
        'ignored',           (select count(*) from admin_ignored),
        'scores_today',      (select count(*) from daily_scores where day = today and device not in (select device from admin_ignored)),
        'suggestions_week',  (select count(*) from object_suggestions where created_at > now() - interval '7 days'),
        'suggestions_all',   (select count(*) from object_suggestions),
        'leagues',           (select count(*) from leagues),
        'league_members',    (select count(*) from league_members)
      ),
      'series', (
        select json_agg(json_build_object('day', g.day, 'players', coalesce(a.players, 0), 'views', coalesce(a.views, 0),
                                          'games', coalesce(a.games, 0), 'new', coalesce(f.n, 0)) order by g.day)
        from (select generate_series(since::timestamp, today::timestamp, interval '1 day')::date as day) g
        left join (select day, count(distinct device) as players, count(*) filter (where event = 'page_view') as views,
                          count(*) filter (where event = 'game_end') as games
                   from ev group by day) a on a.day = g.day
        left join (select first_day, count(*) as n from firsts group by first_day) f on f.first_day = g.day
      ),
      'games', (
        select coalesce(json_agg(x order by x.plays desc), '[]'::json) from (
          select g.game, count(*) as plays, count(distinct g.device) as players, round(avg(g.score))::integer as avg_score,
                 max(g.score) as best, count(*) filter (where g.day = today) as today,
                 (select json_object_agg(coalesce(m.mode, '?'), m.n) from (
                    select e2.mode, count(*) as n from ev e2
                    where e2.event = 'game_end' and e2.game = g.game group by e2.mode) m) as modes
          from ev g where g.event = 'game_end' and g.game is not null
          group by g.game) x
      ),
      'pages', (
        select coalesce(json_agg(x order by x.views desc), '[]'::json) from (
          select page, count(*) as views, count(distinct device) as players
          from ev where event = 'page_view' group by page order by count(*) desc limit 15) x
      ),
      'countries', (
        select coalesce(json_agg(x order by x.players desc), '[]'::json) from (
          select coalesce(country, '??') as country, count(distinct device) as players, count(*) as events
          from ev group by 1 order by count(distinct device) desc limit 20) x
      ),
      'platforms', (
        select coalesce(json_agg(x order by x.players desc), '[]'::json) from (
          select coalesce(platform, 'Unknown') as platform, count(distinct device) as players
          from ev group by 1 order by count(distinct device) desc limit 12) x
      ),
      'refs', (
        select coalesce(json_agg(x order by x.visits desc), '[]'::json) from (
          select ref, count(*) as visits, count(distinct device) as players
          from ev where event = 'page_view' and ref is not null and ref <> '' group by ref order by count(*) desc limit 12) x
      ),
      'events', (
        select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
          select event, count(*) as n, count(distinct device) as players from ev group by event) x
      ),
      'heat', (
        select coalesce(json_agg(x), '[]'::json) from (
          select extract(isodow from lt)::integer as d, extract(hour from lt)::integer as h, count(*) as c
          from ev group by 1, 2) x
      )
    )
  );
end
$$;

-- The newest events, optionally for one device, event name or game. p_before: an id, to page backwards.
create or replace function public.admin_events(p_limit integer default 100, p_before bigint default null,
  p_device uuid default null, p_event text default null, p_game text default null)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.id desc), '[]'::json) from (
    select id, created_at, device, session, event, page, game, mode, score, data, country, platform, ref
    from activity_events
    where (p_before is null or id < p_before) and (p_device is null or device = p_device)
      and (p_event is null or event = p_event) and (p_game is null or game = p_game)
      -- ignored browsers only show up when asked for by their id
      and (p_device is not null or device not in (select device from admin_ignored))
    order by id desc
    limit greatest(1, least(coalesce(p_limit, 100), 500))) x
$$;

-- Players (browsers) seen in the last p_days days, most recent first. p_q: the start of a device id,
-- or part of a display name used in a Friends League.
create or replace function public.admin_players(p_days integer default 30, p_q text default null, p_limit integer default 200)
returns json language sql stable security definer set search_path = public as $$
  with recent as (
    select device from activity_events
    where created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
      and device not in (select device from admin_ignored)
    group by device
  ),
  names as (select device, string_agg(distinct name, ', ') as names from league_members group by device),
  agg as (
    select e.device, min(e.created_at) as first_seen, max(e.created_at) as last_seen, count(*) as events,
           count(*) filter (where e.event = 'game_end') as games,
           count(*) filter (where e.event = 'page_view') as views,
           count(distinct e.session) as sessions,
           count(distinct (e.created_at at time zone 'Asia/Kolkata')::date) as days,
           (array_agg(e.country order by e.id desc) filter (where e.country is not null))[1] as country,
           (array_agg(e.platform order by e.id desc) filter (where e.platform is not null))[1] as platform,
           (array_agg(e.game order by e.id desc) filter (where e.game is not null))[1] as last_game
    from activity_events e join recent r using (device)
    group by e.device
  )
  select coalesce(json_agg(x order by x.last_seen desc), '[]'::json) from (
    select a.*, n.names from agg a left join names n using (device)
    where coalesce(btrim(p_q), '') = ''
       or a.device::text like lower(btrim(p_q)) || '%'
       or n.names ilike '%' || btrim(p_q) || '%'
    order by a.last_seen desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000))) x
$$;

-- Everything about one browser: totals, its last 300 events, games, Daily scores and leagues.
create or replace function public.admin_device(p_device uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'device', p_device,
    'ignored', exists (select 1 from admin_ignored where device = p_device),
    'summary', (
      select json_build_object('first_seen', min(created_at), 'last_seen', max(created_at), 'events', count(*),
             'games', count(*) filter (where event = 'game_end'), 'views', count(*) filter (where event = 'page_view'),
             'sessions', count(distinct session))
      from activity_events where device = p_device
    ),
    'events', (
      select coalesce(json_agg(x order by x.id desc), '[]'::json) from (
        select id, created_at, session, event, page, game, mode, score, data, country, platform, ref
        from activity_events where device = p_device order by id desc limit 300) x
    ),
    'games', (
      select coalesce(json_agg(x order by x.plays desc), '[]'::json) from (
        select game, count(*) as plays, round(avg(score))::integer as avg_score, max(score) as best
        from activity_events where device = p_device and event = 'game_end' and game is not null group by game) x
    ),
    'scores', (
      select coalesce(json_agg(x order by x.day desc, x.game), '[]'::json) from (
        select game, day, score, game_max(game) as max, created_at
        from daily_scores where device = p_device order by day desc limit 200) x
    ),
    'leagues', (
      select coalesce(json_agg(json_build_object('code', m.code, 'league', l.name, 'name', m.name, 'joined_at', m.joined_at)), '[]'::json)
      from league_members m join leagues l using (code) where m.device = p_device
    )
  )
$$;

-- Daily scores per game and day (last 30 days), object suggestions and Friends Leagues.
create or replace function public.admin_lists()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'scores', (
      select coalesce(json_agg(x order by x.day desc, x.players desc), '[]'::json) from (
        select day, game, count(*) as players, round(avg(score))::integer as avg_score, max(score) as best, game_max(game) as max
        from daily_scores where day > (now() at time zone 'utc')::date - 30 and device not in (select device from admin_ignored)
        group by day, game) x
    ),
    'suggestions', (
      select coalesce(json_agg(x order by x.id desc), '[]'::json) from (
        select id, created_at, name, category, measure, source, note
        from object_suggestions order by id desc limit 300) x
    ),
    'leagues', (
      select coalesce(json_agg(x order by x.members desc, x.created_at desc), '[]'::json) from (
        select l.code, l.name, l.created_at, count(m.device) as members,
               string_agg(m.name, ', ' order by m.joined_at) as names
        from leagues l left join league_members m using (code)
        group by l.code, l.name, l.created_at
        order by count(m.device) desc limit 300) x
    )
  )
$$;

-- Ignore one browser (p_on true) or stop ignoring it (false). Returns the full list, like admin_ignored_list().
create or replace function public.admin_ignore(p_device uuid, p_label text default null, p_on boolean default true)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_device is null then raise exception 'device required'; end if;
  if p_on then
    insert into admin_ignored (device, label) values (p_device, left(btrim(p_label), 60))
    on conflict (device) do update set label = coalesce(excluded.label, admin_ignored.label);
  else
    delete from admin_ignored where device = p_device;
  end if;
  return admin_ignored_list();
end
$$;

-- The ignored browsers, with how much activity each has (hidden from the admin numbers)
create or replace function public.admin_ignored_list()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select i.device, i.label, i.created_at,
           (select count(*) from activity_events e where e.device = i.device) as events,
           (select max(created_at) from activity_events e where e.device = i.device) as last_seen
    from admin_ignored i) x
$$;

-- Only the secret (service role) key may call the admin functions; never the publishable key in the browser.
revoke all on function public.admin_ignore(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_ignored_list() from public, anon, authenticated;
grant execute on function public.admin_ignore(uuid, text, boolean) to service_role;
grant execute on function public.admin_ignored_list() to service_role;
revoke all on function public.admin_overview(integer, text) from public, anon, authenticated;
revoke all on function public.admin_events(integer, bigint, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_players(integer, text, integer) from public, anon, authenticated;
revoke all on function public.admin_device(uuid) from public, anon, authenticated;
revoke all on function public.admin_lists() from public, anon, authenticated;
grant execute on function public.admin_overview(integer, text) to service_role;
grant execute on function public.admin_events(integer, bigint, uuid, text, text) to service_role;
grant execute on function public.admin_players(integer, text, integer) to service_role;
grant execute on function public.admin_device(uuid) to service_role;
grant execute on function public.admin_lists() to service_role;

-- Optional housekeeping: the admin page looks back at most a year.
-- delete from public.activity_events where created_at < now() - interval '400 days';

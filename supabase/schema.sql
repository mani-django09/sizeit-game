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

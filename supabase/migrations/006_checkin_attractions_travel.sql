-- GPS check-in, atrakcje, travel_km, współrzędne miejsca wydarzenia.
-- WYMAGA: najpierw yummeet_all.sql (lub 001→002→003), potem 004 i 005.
-- Potem uruchom 007_fix_pins_bbox_return.sql (cover_url w pins_in_bbox).

do $$ begin
  if to_regclass('public.events') is null then
    raise exception 'Brak tabeli public.events. Najpierw uruchom supabase/yummeet_all.sql, potem 004, 005, dopiero 006 i 007.';
  end if;
end $$;

alter table public.profiles add column if not exists travel_km numeric not null default 0;
alter table public.events add column if not exists place_lat float8;
alter table public.events add column if not exists place_lng float8;
alter table public.event_secrets add column if not exists code_revealed_at timestamptz;
alter table public.event_secrets add column if not exists code_notified_at timestamptz;

create table if not exists public.attraction_suggestions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('questions','games','challenges')),
  title text not null,
  body text not null default '',
  sort int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.event_attractions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category text not null check (category in ('questions','games','challenges')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists event_attractions_event_idx on public.event_attractions (event_id, category);

alter table public.attraction_suggestions enable row level security;
alter table public.event_attractions enable row level security;

drop policy if exists attraction_suggestions_read on public.attraction_suggestions;
create policy attraction_suggestions_read on public.attraction_suggestions for select to authenticated using (is_active = true);
drop policy if exists event_attractions_read on public.event_attractions;
create policy event_attractions_read on public.event_attractions for select to authenticated
  using (public.is_event_member(event_id) or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
drop policy if exists event_attractions_insert on public.event_attractions;
create policy event_attractions_insert on public.event_attractions for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
drop policy if exists event_attractions_delete on public.event_attractions;
create policy event_attractions_delete on public.event_attractions for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

grant select on public.attraction_suggestions to authenticated;
grant select, insert, delete on public.event_attractions to authenticated;

insert into public.attraction_suggestions (category, title, body, sort)
select * from (values
  ('questions', 'Ulubione danie z dzieciństwa?', 'Co gotowano u Ciebie w domu najczęściej?', 1),
  ('questions', 'Gdybyś otworzył restaurację…', 'Jaki byłby motyw przewodni i danie specjalności?', 2),
  ('questions', 'Podróż smaków', 'Jakie miasto zaskoczyło Cię kulinarne najbardziej?', 3),
  ('questions', 'Najdziwniejsze danie', 'Co zamówiłeś „na odwagę” i jak wyszło?', 4),
  ('games', 'Szachy', 'Klasyczna partia przy stole — 15–20 min na rundę.', 1),
  ('games', 'Makao', 'Karcianka dla 3–6 osób.', 2),
  ('games', 'Twister', 'Wymaga miejsca na podłodze / na zewnątrz.', 3),
  ('games', 'League of Legends', 'Umówcie się na wspólny ranked po kolacji.', 4),
  ('challenges', '20 pompek', 'Gość robi 20 pompek, zanim usiądzie do stołu.', 1),
  ('challenges', 'Zamów coś nowego', 'Wybierz danie, którego nigdy nie próbowałeś.', 2),
  ('challenges', 'Opowiedz anegdotę', '30 sekund o najgorszej kolacji w życiu.', 3)
) as v(category, title, body, sort)
where not exists (select 1 from public.attraction_suggestions s where s.category = v.category and s.title = v.title);

create or replace function public._event_venue(p_event uuid)
returns table (lat float8, lng float8)
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(e.place_lat, st_y(p.coords::geometry)), coalesce(e.place_lng, st_x(p.coords::geometry))
  from public.events e left join public.pins p on p.id = e.pin_id where e.id = p_event;
$$;

create or replace function public.event_create(
  p_title text, p_place_name text, p_starts_at timestamptz, p_capacity int, p_kind text default 'open_table',
  p_description text default null, p_theme text default null, p_rules text default null,
  p_pin uuid default null, p_business uuid default null, p_discount text default null,
  p_place_lat float8 default null, p_place_lng float8 default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_conv uuid; v_official boolean := false;
begin
  if p_capacity < 2 or p_capacity > 500 then raise exception 'invalid_capacity'; end if;
  if p_starts_at < now() then raise exception 'starts_in_past'; end if;
  if p_business is not null then
    if not exists (select 1 from public.business_profiles where id = p_business and owner_id = v) then raise exception 'not_business_owner'; end if;
    v_official := true;
  end if;
  insert into public.events (kind, organizer_id, business_id, pin_id, title, description, place_name, starts_at, capacity, theme, rules, discount_text, is_official, seats_taken, place_lat, place_lng)
  values (p_kind, v, p_business, p_pin, trim(p_title), p_description, p_place_name, p_starts_at, p_capacity, p_theme, p_rules,
          case when v_official then p_discount else null end, v_official, 1, p_place_lat, p_place_lng)
  returning id into v_id;
  insert into public.event_participants (event_id, user_id) values (v_id, v);
  insert into public.event_secrets (event_id, checkin_code) values (v_id, upper(substr(md5(random()::text), 1, 6)));
  insert into public.conversations (kind, ref_id, title, created_by) values ('event', v_id, trim(p_title), v) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v);
  return v_id;
end $$;

create or replace function public.event_reveal_checkin_code(p_event uuid, p_lat float8, p_lng float8)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); e record; v_lat float8; v_lng float8; v_code text; v_notified timestamptz;
begin
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'not_found'; end if;
  if e.organizer_id <> v then raise exception 'not_allowed'; end if;
  if (e.starts_at at time zone 'UTC')::date <> (now() at time zone 'UTC')::date then raise exception 'too_early'; end if;
  if now() < e.starts_at - interval '30 minutes' then raise exception 'too_early'; end if;
  if now() > e.starts_at + interval '4 hours' then raise exception 'event_closed'; end if;
  select lat, lng into v_lat, v_lng from public._event_venue(p_event);
  if v_lat is null or v_lng is null then raise exception 'no_venue_coords'; end if;
  if not st_dwithin(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 120) then
    raise exception 'too_far_from_place';
  end if;
  select checkin_code, code_notified_at into v_code, v_notified from public.event_secrets where event_id = p_event;
  update public.event_secrets set code_revealed_at = coalesce(code_revealed_at, now()) where event_id = p_event;
  if v_notified is null then
    update public.event_secrets set code_notified_at = now() where event_id = p_event;
    perform public._notify(v, 'event_code', 'Kod obecności gotowy',
      'Jesteś na miejscu. Podaj gościom kod: ' || v_code || ' — niech wpiszą go od razu po przyjściu.',
      jsonb_build_object('event_id', p_event, 'code', v_code), 'event_code:' || p_event);
  end if;
  return jsonb_build_object('code', v_code, 'notified', v_notified is null);
end $$;

create or replace function public.event_checkin(p_event uuid, p_code text, p_lat float8 default null, p_lng float8 default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); e record; v_lat float8; v_lng float8;
begin
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'not_found'; end if;
  if e.organizer_id = v then raise exception 'organizer_cannot_checkin'; end if;
  if now() < e.starts_at then raise exception 'too_early'; end if;
  if now() > e.starts_at + interval '4 hours' then raise exception 'event_closed'; end if;
  if not exists (select 1 from public.event_participants where event_id = p_event and user_id = v and status in ('joined','attended')) then
    raise exception 'not_joined';
  end if;
  if upper(trim(p_code)) <> (select checkin_code from public.event_secrets where event_id = p_event) then raise exception 'invalid_code'; end if;
  select lat, lng into v_lat, v_lng from public._event_venue(p_event);
  if v_lat is null or v_lng is null then raise exception 'no_venue_coords'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if not st_dwithin(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 120) then
    raise exception 'too_far_from_place';
  end if;
  update public.event_participants set status = 'attended', attended_at = coalesce(attended_at, now())
    where event_id = p_event and user_id = v and status = 'joined';
  if not found then return jsonb_build_object('attended', true, 'already', true); end if;
  perform public._award_xp(v, 25, 'event_attendance', p_event, e.title);
  perform public._evaluate_badges(v);
  return jsonb_build_object('attended', true);
end $$;

create or replace function public.event_checkin_code(p_event uuid) returns text
language plpgsql security definer set search_path = public as $$
begin raise exception 'use_reveal_with_gps'; end $$;

create or replace function public.travel_add_km(p_km numeric) returns numeric
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_total numeric;
begin
  if p_km is null or p_km <= 0 or p_km > 2000 then raise exception 'invalid_distance'; end if;
  update public.profiles set travel_km = travel_km + p_km, updated_at = now() where id = v returning travel_km into v_total;
  return v_total;
end $$;

create or replace function public.profile_stats(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare vis text; me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select coalesce(visibility->>'stats','public') into vis from public.profiles where id = p_user;
  if vis = 'private' and me <> p_user then return null; end if;
  return jsonb_build_object(
    'missions_completed', public._metric(p_user, 'missions_completed'),
    'cards_owned', public._metric(p_user, 'cards_owned'),
    'duels_won', public._metric(p_user, 'duels_won'),
    'events_attended', public._metric(p_user, 'events_attended'),
    'pins_created', public._metric(p_user, 'pins_created'),
    'travel_km', coalesce((select travel_km from public.profiles where id = p_user), 0)
  );
end $$;

do $$ begin
  execute 'grant execute on function public.event_reveal_checkin_code(uuid, float8, float8) to authenticated';
  execute 'grant execute on function public.event_checkin(uuid, text, float8, float8) to authenticated';
  execute 'grant execute on function public.travel_add_km(numeric) to authenticated';
exception when others then null;
end $$;

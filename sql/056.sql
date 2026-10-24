-- Randki MVP: profil 18+, jedno ogłoszenie, filtr 50 km, pytania, dwie zgody, plan.
-- Tabele bez polityk SELECT — klient korzysta wyłącznie z SECURITY DEFINER.

create table if not exists public.dating_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  birth_date date not null,
  gender text not null,
  bio text not null,
  goal text not null,
  seeking_gender text not null,
  age_min int not null default 18,
  age_max int not null default 99,
  max_km int not null default 50,
  photo_url text not null,
  area_label text,
  lat double precision not null,
  lng double precision not null,
  about text,
  kids text,
  relationship_model text,
  show_extras boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint dating_gender check (gender in ('woman', 'man')),
  constraint dating_seeking check (seeking_gender in ('woman', 'man', 'any')),
  constraint dating_goal check (goal in ('serious', 'slow', 'casual', 'unsure')),
  constraint dating_age_range check (age_min >= 18 and age_max >= age_min and age_max <= 99),
  constraint dating_km check (max_km between 1 and 50),
  constraint dating_kids check (kids is null or kids in ('want', 'dont', 'unsure', 'have')),
  constraint dating_model check (relationship_model is null or relationship_model in ('mono', 'open', 'discuss'))
);

create table if not exists public.dating_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  blurb text not null,
  format text not null,
  area_label text,
  time_window text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dating_format check (format in ('cafe', 'dinner', 'picnic', 'walk')),
  constraint dating_listing_status check (status in ('active', 'paused', 'closed', 'cancelled'))
);

create unique index if not exists dating_one_active on public.dating_listings (owner_id) where status = 'active';

create table if not exists public.dating_passes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.dating_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.dating_interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.dating_listings(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  questions jsonb not null default '[]'::jsonb,
  host_decision text,
  guest_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, guest_id),
  constraint dating_interest_status check (status in ('pending', 'declined', 'questions', 'deciding', 'planning', 'cancelled')),
  constraint dating_host_decision check (host_decision is null or host_decision in ('date', 'talk', 'pass')),
  constraint dating_guest_decision check (guest_decision is null or guest_decision in ('date', 'talk', 'pass'))
);

create table if not exists public.dating_plans (
  interest_id uuid primary key references public.dating_interests(id) on delete cascade,
  meet_date date,
  meet_time text,
  place_kind text,
  budget_note text,
  split text,
  game_ids text[] not null default '{}',
  mission_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.dating_profiles enable row level security;
alter table public.dating_listings enable row level security;
alter table public.dating_passes enable row level security;
alter table public.dating_interests enable row level security;
alter table public.dating_plans enable row level security;
revoke all on public.dating_profiles from public, anon, authenticated;
revoke all on public.dating_listings from public, anon, authenticated;
revoke all on public.dating_passes from public, anon, authenticated;
revoke all on public.dating_interests from public, anon, authenticated;
revoke all on public.dating_plans from public, anon, authenticated;

create or replace function public._dating_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public._dating_distance_label(km float8)
returns text language plpgsql immutable as $$
begin
  if km is null then return null; end if;
  if km < 1 then return 'mniej niż 1 km'; end if;
  return 'ok. ' || round(km)::int || ' km';
end $$;

create or replace function public._dating_age(p_birth date)
returns int language sql immutable as $$
  select extract(year from age(p_birth))::int;
$$;

create or replace function public._dating_prompt(p_id text)
returns text language sql immutable as $$
  select case p_id
    when 'day-off' then 'Jak wygląda Twój idealny dzień wolny przy jedzeniu?'
    when 'cook' then 'Wolisz ugotować coś dla kogoś czy iść na kolację?'
    when 'taste' then 'Jakie jedzenie od razu poprawia Ci humor?'
    when 'table' then 'Wolisz stolik w knajpie, piknik czy kuchnię?'
    when 'appreciated' then 'Co sprawia, że czujesz się doceniany/a przy wspólnym stole?'
    when 'conflict' then 'Jak zazwyczaj rozwiązujesz nieporozumienia?'
    when 'kids' then 'Jak ważne jest dla Ciebie posiadanie dzieci?'
    when 'together' then 'Ile czasu lubisz spędzać razem, a ile osobno?'
    when 'money' then 'Jak podchodzisz do wspólnego płacenia za wyjścia?'
    when 'safe' then 'Co pomaga Ci poczuć się swobodnie przy nowej osobie?'
    else null
  end;
$$;

create or replace function public._dating_open_contacts(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.dating_interests i
  join public.dating_listings l on l.id = i.listing_id
  where i.status in ('pending', 'questions', 'deciding', 'planning')
    and (i.guest_id = p_user or l.owner_id = p_user);
$$;

create or replace function public._dating_card(p public.dating_profiles, p_km float8, p_extras boolean)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'age', public._dating_age(p.birth_date),
    'gender', p.gender,
    'photo_url', p.photo_url,
    'bio', p.bio,
    'goal', p.goal,
    'seeking_gender', p.seeking_gender,
    'age_min', p.age_min,
    'age_max', p.age_max,
    'area_label', p.area_label,
    'distance_label', public._dating_distance_label(p_km),
    'about', p.about,
    'kids', p.kids,
    'relationship_model', p.relationship_model
  );
$$;

create or replace function public.dating_my_profile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid(); p public.dating_profiles;
begin
  select * into p from public.dating_profiles where user_id = v;
  if not found then return null; end if;
  return jsonb_build_object(
    'display_name', p.display_name,
    'birth_date', p.birth_date,
    'age', public._dating_age(p.birth_date),
    'gender', p.gender,
    'bio', p.bio,
    'goal', p.goal,
    'seeking_gender', p.seeking_gender,
    'age_min', p.age_min,
    'age_max', p.age_max,
    'max_km', p.max_km,
    'photo_url', p.photo_url,
    'area_label', p.area_label,
    'about', p.about,
    'kids', p.kids,
    'relationship_model', p.relationship_model,
    'show_extras', p.show_extras,
    'open_contacts', public._dating_open_contacts(v)
  );
end $$;

create or replace function public.dating_save_profile(p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_birth date;
  v_name text;
  v_bio text;
  v_gender text;
  v_goal text;
  v_seek text;
  v_min int;
  v_max int;
  v_km int;
  v_photo text;
  v_lat float8;
  v_lng float8;
begin
  v_name := nullif(trim(p_profile->>'display_name'), '');
  v_bio := nullif(trim(p_profile->>'bio'), '');
  v_gender := p_profile->>'gender';
  v_goal := p_profile->>'goal';
  v_seek := p_profile->>'seeking_gender';
  v_photo := nullif(trim(p_profile->>'photo_url'), '');
  begin
    v_birth := (p_profile->>'birth_date')::date;
    v_min := coalesce((p_profile->>'age_min')::int, 18);
    v_max := coalesce((p_profile->>'age_max')::int, 99);
    v_km := coalesce((p_profile->>'max_km')::int, 50);
    v_lat := round((p_profile->>'lat')::numeric, 2);
    v_lng := round((p_profile->>'lng')::numeric, 2);
  exception when others then
    raise exception 'invalid_profile';
  end;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'invalid_name'; end if;
  if v_bio is null or char_length(v_bio) < 10 or char_length(v_bio) > 400 then raise exception 'invalid_bio'; end if;
  if v_gender not in ('woman', 'man') or v_goal not in ('serious', 'slow', 'casual', 'unsure') or v_seek not in ('woman', 'man', 'any') then
    raise exception 'invalid_profile';
  end if;
  if v_photo is null or char_length(v_photo) > 500 then raise exception 'invalid_photo'; end if;
  if v_birth is null or public._dating_age(v_birth) < 18 then raise exception 'dating_underage'; end if;
  if v_min < 18 or v_max < v_min or v_max > 99 or v_km < 1 or v_km > 50 then raise exception 'invalid_profile'; end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then raise exception 'location_required'; end if;
  if p_profile->>'kids' is not null and p_profile->>'kids' not in ('want', 'dont', 'unsure', 'have') then raise exception 'invalid_profile'; end if;
  if p_profile->>'relationship_model' is not null and p_profile->>'relationship_model' not in ('mono', 'open', 'discuss') then raise exception 'invalid_profile'; end if;

  insert into public.dating_profiles as d (
    user_id, display_name, birth_date, gender, bio, goal, seeking_gender, age_min, age_max, max_km,
    photo_url, area_label, lat, lng, about, kids, relationship_model, show_extras, updated_at
  ) values (
    v, v_name, v_birth, v_gender, v_bio, v_goal, v_seek, v_min, v_max, v_km,
    v_photo, nullif(trim(p_profile->>'area_label'), ''), v_lat, v_lng,
    nullif(trim(p_profile->>'about'), ''), nullif(p_profile->>'kids', ''), nullif(p_profile->>'relationship_model', ''),
    coalesce((p_profile->>'show_extras')::boolean, false), now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    birth_date = excluded.birth_date,
    gender = excluded.gender,
    bio = excluded.bio,
    goal = excluded.goal,
    seeking_gender = excluded.seeking_gender,
    age_min = excluded.age_min,
    age_max = excluded.age_max,
    max_km = excluded.max_km,
    photo_url = excluded.photo_url,
    area_label = excluded.area_label,
    lat = excluded.lat,
    lng = excluded.lng,
    about = excluded.about,
    kids = excluded.kids,
    relationship_model = excluded.relationship_model,
    show_extras = excluded.show_extras,
    updated_at = now();
  return public.dating_my_profile();
end $$;

create or replace function public.dating_publish(p_listing jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_blurb text; v_format text;
begin
  if not exists (select 1 from public.dating_profiles where user_id = v) then raise exception 'dating_profile_required'; end if;
  if exists (select 1 from public.dating_listings where owner_id = v and status = 'active') then raise exception 'dating_active_exists'; end if;
  v_blurb := nullif(trim(p_listing->>'blurb'), '');
  v_format := p_listing->>'format';
  if v_blurb is null or char_length(v_blurb) < 10 or char_length(v_blurb) > 400 then raise exception 'invalid_body'; end if;
  if v_format not in ('cafe', 'dinner', 'picnic', 'walk') then raise exception 'invalid_kind'; end if;
  insert into public.dating_listings (owner_id, blurb, format, area_label, time_window, status)
  values (
    v, v_blurb, v_format,
    nullif(trim(p_listing->>'area_label'), ''),
    nullif(trim(p_listing->>'time_window'), ''),
    'active'
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.dating_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if p_status not in ('active', 'paused', 'closed', 'cancelled') then raise exception 'invalid_transition'; end if;
  if p_status = 'active' and exists (select 1 from public.dating_listings where owner_id = v and status = 'active' and id <> p_id) then
    raise exception 'dating_active_exists';
  end if;
  update public.dating_listings set status = p_status, updated_at = now()
  where id = p_id and owner_id = v;
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.dating_board(p_lat float8, p_lng float8)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid(); me public.dating_profiles; v_lat float8; v_lng float8;
begin
  select * into me from public.dating_profiles where user_id = v;
  if not found then raise exception 'dating_profile_required'; end if;
  v_lat := coalesce(p_lat, me.lat);
  v_lng := coalesce(p_lng, me.lng);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'blurb', l.blurb,
      'format', l.format,
      'area_label', coalesce(l.area_label, h.area_label),
      'time_window', l.time_window,
      'person', public._dating_card(h, public._dating_km(v_lat, v_lng, h.lat, h.lng), false)
    ) order by public._dating_km(v_lat, v_lng, h.lat, h.lng))
    from public.dating_listings l
    join public.dating_profiles h on h.user_id = l.owner_id
    where l.status = 'active'
      and l.owner_id <> v
      and not public.is_blocked(v, l.owner_id)
      and not exists (select 1 from public.dating_passes x where x.user_id = v and x.listing_id = l.id)
      and not exists (select 1 from public.dating_interests i where i.listing_id = l.id and i.guest_id = v)
      and public._dating_km(v_lat, v_lng, h.lat, h.lng) <= least(me.max_km, h.max_km, 50)
      and public._dating_age(h.birth_date) between me.age_min and me.age_max
      and public._dating_age(me.birth_date) between h.age_min and h.age_max
      and (me.seeking_gender = 'any' or me.seeking_gender = h.gender)
      and (h.seeking_gender = 'any' or h.seeking_gender = me.gender)
  ), '[]'::jsonb);
end $$;

create or replace function public.dating_listing(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public._uid();
  l public.dating_listings;
  h public.dating_profiles;
  me public.dating_profiles;
  km float8;
begin
  select * into l from public.dating_listings where id = p_id;
  if not found then raise exception 'not_allowed'; end if;
  select * into h from public.dating_profiles where user_id = l.owner_id;
  if l.owner_id = v then
    return jsonb_build_object(
      'id', l.id, 'blurb', l.blurb, 'format', l.format, 'area_label', l.area_label,
      'time_window', l.time_window, 'status', l.status, 'mine', true,
      'person', public._dating_card(h, null, true),
      'interests', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'status', i.status, 'created_at', i.created_at,
          'person', public._dating_card(g, public._dating_km(h.lat, h.lng, g.lat, g.lng), i.status <> 'pending')
        ) order by i.created_at desc)
        from public.dating_interests i
        join public.dating_profiles g on g.user_id = i.guest_id
        where i.listing_id = l.id
      ), '[]'::jsonb)
    );
  end if;
  select * into me from public.dating_profiles where user_id = v;
  if not found then raise exception 'dating_profile_required'; end if;
  if public.is_blocked(v, l.owner_id) or l.status <> 'active' then raise exception 'not_allowed'; end if;
  km := public._dating_km(me.lat, me.lng, h.lat, h.lng);
  if km > least(me.max_km, h.max_km, 50) then raise exception 'not_allowed'; end if;
  if public._dating_age(h.birth_date) not between me.age_min and me.age_max then raise exception 'not_allowed'; end if;
  if public._dating_age(me.birth_date) not between h.age_min and h.age_max then raise exception 'not_allowed'; end if;
  if me.seeking_gender <> 'any' and me.seeking_gender <> h.gender then raise exception 'not_allowed'; end if;
  if h.seeking_gender <> 'any' and h.seeking_gender <> me.gender then raise exception 'not_allowed'; end if;
  return jsonb_build_object(
    'id', l.id, 'blurb', l.blurb, 'format', l.format,
    'area_label', coalesce(l.area_label, h.area_label),
    'time_window', l.time_window, 'status', l.status, 'mine', false,
    'person', public._dating_card(h, km, false),
    'my_interest', (select i.id from public.dating_interests i where i.listing_id = l.id and i.guest_id = v)
  );
end $$;

create or replace function public.dating_my_listings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'blurb', l.blurb, 'format', l.format, 'status', l.status,
      'area_label', l.area_label, 'time_window', l.time_window,
      'pending', (select count(*) from public.dating_interests i where i.listing_id = l.id and i.status = 'pending')
    ) order by l.created_at desc)
    from public.dating_listings l where l.owner_id = v
  ), '[]'::jsonb);
end $$;

create or replace function public.dating_my_contacts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'status', i.status,
      'listing_id', l.id,
      'format', l.format,
      'role', case when l.owner_id = v then 'host' else 'guest' end,
      'person', public._dating_card(
        case when l.owner_id = v then g else h end,
        public._dating_km(h.lat, h.lng, g.lat, g.lng),
        i.status <> 'pending'
      )
    ) order by i.updated_at desc)
    from public.dating_interests i
    join public.dating_listings l on l.id = i.listing_id
    join public.dating_profiles h on h.user_id = l.owner_id
    join public.dating_profiles g on g.user_id = i.guest_id
    where l.owner_id = v or i.guest_id = v
  ), '[]'::jsonb);
end $$;

create or replace function public.dating_contact(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public._uid();
  i public.dating_interests;
  l public.dating_listings;
  h public.dating_profiles;
  g public.dating_profiles;
  plan public.dating_plans;
  v_host boolean;
begin
  select * into i from public.dating_interests where id = p_id;
  if not found then raise exception 'not_allowed'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  select * into h from public.dating_profiles where user_id = l.owner_id;
  select * into g from public.dating_profiles where user_id = i.guest_id;
  if l.owner_id <> v and i.guest_id <> v then raise exception 'not_allowed'; end if;
  if public.is_blocked(l.owner_id, i.guest_id) then raise exception 'blocked'; end if;
  v_host := l.owner_id = v;
  select * into plan from public.dating_plans where interest_id = i.id;
  return jsonb_build_object(
    'id', i.id,
    'status', i.status,
    'role', case when v_host then 'host' else 'guest' end,
    'listing', jsonb_build_object('id', l.id, 'blurb', l.blurb, 'format', l.format, 'area_label', l.area_label, 'time_window', l.time_window, 'status', l.status),
    'person', public._dating_card(case when v_host then g else h end, public._dating_km(h.lat, h.lng, g.lat, g.lng), i.status <> 'pending'),
    'questions', case when i.status = 'pending' then '[]'::jsonb else i.questions end,
    'my_decision', case when v_host then i.host_decision else i.guest_decision end,
    'their_decision', case
      when i.status in ('declined', 'cancelled') then null
      when v_host then i.guest_decision
      else i.host_decision
    end,
    'plan_open', i.status = 'planning',
    'plan', case when i.status = 'planning' then to_jsonb(plan) else null end
  );
end $$;

create or replace function public.dating_express(p_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  l public.dating_listings;
  h public.dating_profiles;
  me public.dating_profiles;
  v_id uuid;
begin
  select * into l from public.dating_listings where id = p_listing and status = 'active';
  if not found then raise exception 'not_allowed'; end if;
  if l.owner_id = v then raise exception 'not_allowed'; end if;
  if public.is_blocked(v, l.owner_id) then raise exception 'blocked'; end if;
  select * into me from public.dating_profiles where user_id = v;
  select * into h from public.dating_profiles where user_id = l.owner_id;
  if me.user_id is null then raise exception 'dating_profile_required'; end if;
  if public._dating_open_contacts(v) >= 3 then raise exception 'dating_contact_limit'; end if;
  if (select count(*) from public.dating_interests where guest_id = v and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.dating_interests where listing_id = l.id and guest_id = v) then
    raise exception 'dating_already_closed';
  end if;
  if public._dating_km(me.lat, me.lng, h.lat, h.lng) > least(me.max_km, h.max_km, 50) then raise exception 'not_allowed'; end if;
  insert into public.dating_interests (listing_id, guest_id, status) values (l.id, v, 'pending') returning id into v_id;
  perform public._notify(l.owner_id, 'dating_interest', 'Nowe zgłoszenie na randkę', me.display_name || ' chce Cię poznać przy jedzeniu.', jsonb_build_object('interest_id', v_id), 'dating-interest:' || v_id);
  return v_id;
end $$;

create or replace function public.dating_pass(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  insert into public.dating_passes (user_id, listing_id) values (v, p_listing) on conflict do nothing;
end $$;

create or replace function public.dating_respond(p_interest uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); i public.dating_interests; l public.dating_listings; h public.dating_profiles;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'pending' then raise exception 'invalid_transition'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v then raise exception 'not_allowed'; end if;
  if public.is_blocked(v, i.guest_id) then raise exception 'blocked'; end if;
  select * into h from public.dating_profiles where user_id = v;
  if p_accept then
    if public._dating_open_contacts(v) >= 3 and i.status = 'pending' then
      -- pending już liczy się w limicie, więc akceptacja nie dokłada kontaktu
      null;
    end if;
    update public.dating_interests set status = 'questions', updated_at = now() where id = i.id;
    perform public._notify(i.guest_id, 'dating_accept', 'Zgłoszenie przyjęte', h.display_name || ' chce się poznać. Możesz wybrać 3–5 pytań.', jsonb_build_object('interest_id', i.id), 'dating-accept:' || i.id);
  else
    update public.dating_interests set status = 'declined', updated_at = now() where id = i.id;
    perform public._notify(i.guest_id, 'dating_decline', 'Bez kontaktu tym razem', 'Organizator nie przyjął zgłoszenia.', jsonb_build_object('interest_id', i.id), 'dating-decline:' || i.id);
  end if;
end $$;

create or replace function public.dating_ask(p_interest uuid, p_ids text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  i public.dating_interests;
  l public.dating_listings;
  g public.dating_profiles;
  v_id text;
  v_qs jsonb := '[]'::jsonb;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'questions' then raise exception 'invalid_transition'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if i.guest_id <> v then raise exception 'not_allowed'; end if;
  if exists (select 1 from jsonb_array_elements(i.questions) q where q->>'answer' is not null or (q->>'skipped')::boolean) then
    raise exception 'invalid_transition';
  end if;
  if coalesce(array_length(p_ids, 1), 0) < 3 or array_length(p_ids, 1) > 5 then raise exception 'dating_questions_count'; end if;
  if (select count(distinct x) from unnest(p_ids) x) <> array_length(p_ids, 1) then raise exception 'dating_questions_count'; end if;
  foreach v_id in array p_ids loop
    if public._dating_prompt(v_id) is null then raise exception 'dating_questions_count'; end if;
    v_qs := v_qs || jsonb_build_array(jsonb_build_object('id', v_id, 'prompt', public._dating_prompt(v_id), 'answer', null, 'skipped', false));
  end loop;
  update public.dating_interests set questions = v_qs, updated_at = now() where id = i.id;
  select * into g from public.dating_profiles where user_id = v;
  perform public._notify(l.owner_id, 'dating_questions', 'Pytania przed randką', coalesce(g.display_name, 'Ktoś') || ' wybrał(a) pytania.', jsonb_build_object('interest_id', i.id), 'dating-ask:' || i.id);
end $$;

create or replace function public.dating_answer(p_interest uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  i public.dating_interests;
  l public.dating_listings;
  h public.dating_profiles;
  v_q jsonb;
  v_next jsonb := '[]'::jsonb;
  v_row jsonb;
  v_answer text;
  v_skip boolean;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'questions' then raise exception 'invalid_transition'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v then raise exception 'not_allowed'; end if;
  if jsonb_array_length(i.questions) < 3 then raise exception 'dating_not_ready'; end if;
  for v_q in select value from jsonb_array_elements(i.questions) loop
    select value into v_row from jsonb_array_elements(p_answers) where value->>'id' = v_q->>'id' limit 1;
    if v_row is null then raise exception 'dating_not_ready'; end if;
    v_skip := coalesce((v_row->>'skipped')::boolean, false);
    v_answer := nullif(trim(v_row->>'answer'), '');
    if v_skip then v_answer := null;
    elsif v_answer is null or char_length(v_answer) > 500 then raise exception 'invalid_body';
    end if;
    v_next := v_next || jsonb_build_array(jsonb_build_object(
      'id', v_q->>'id', 'prompt', v_q->>'prompt', 'answer', v_answer, 'skipped', v_skip
    ));
  end loop;
  update public.dating_interests set questions = v_next, status = 'deciding', updated_at = now() where id = i.id;
  select * into h from public.dating_profiles where user_id = v;
  perform public._notify(i.guest_id, 'dating_answers', 'Odpowiedzi przed randką', h.display_name || ' odpowiedział(a) na pytania.', jsonb_build_object('interest_id', i.id), 'dating-answers:' || i.id);
end $$;

create or replace function public.dating_decide(p_interest uuid, p_choice text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  i public.dating_interests;
  l public.dating_listings;
  v_host boolean;
  v_host_d text;
  v_guest_d text;
  me public.dating_profiles;
  other uuid;
begin
  if p_choice not in ('date', 'talk', 'pass') then raise exception 'invalid_choice'; end if;
  select * into i from public.dating_interests where id = p_interest for update;
  if not found or i.status <> 'deciding' then raise exception 'invalid_transition'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  v_host := l.owner_id = v;
  if not v_host and i.guest_id <> v then raise exception 'not_allowed'; end if;
  if public.is_blocked(l.owner_id, i.guest_id) then raise exception 'blocked'; end if;
  v_host_d := case when v_host then p_choice else i.host_decision end;
  v_guest_d := case when v_host then i.guest_decision else p_choice end;
  update public.dating_interests set host_decision = v_host_d, guest_decision = v_guest_d, updated_at = now() where id = i.id;
  select * into me from public.dating_profiles where user_id = v;
  other := case when v_host then i.guest_id else l.owner_id end;
  if p_choice = 'pass' or v_host_d = 'pass' or v_guest_d = 'pass' then
    update public.dating_interests set status = 'declined', updated_at = now() where id = i.id;
    perform public._notify(other, 'dating_pass', 'Kontakt zakończony', 'Druga osoba nie chce kontynuować.', jsonb_build_object('interest_id', i.id), 'dating-pass:' || i.id || ':' || v);
    return;
  end if;
  if v_host_d = 'date' and v_guest_d = 'date' then
    update public.dating_interests set status = 'planning', updated_at = now() where id = i.id;
    insert into public.dating_plans (interest_id) values (i.id) on conflict do nothing;
    perform public._notify(l.owner_id, 'dating_plan', 'Możecie planować randkę', 'Obie osoby chcą się spotkać przy jedzeniu.', jsonb_build_object('interest_id', i.id), 'dating-plan:' || i.id || ':host');
    perform public._notify(i.guest_id, 'dating_plan', 'Możecie planować randkę', 'Obie osoby chcą się spotkać przy jedzeniu.', jsonb_build_object('interest_id', i.id), 'dating-plan:' || i.id || ':guest');
    return;
  end if;
  if p_choice = 'talk' then
    perform public._notify(other, 'dating_talk', 'Najpierw rozmowa', coalesce(me.display_name, 'Druga osoba') || ' woli najpierw porozmawiać, zanim umówicie spotkanie.', jsonb_build_object('interest_id', i.id), 'dating-talk:' || i.id || ':' || v);
  end if;
end $$;

create or replace function public.dating_save_plan(p_interest uuid, p_plan jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  i public.dating_interests;
  l public.dating_listings;
  v_games text[];
  v_missions text[];
  v_split text;
  v_place text;
  v_time text;
  v_date date;
  v_budget text;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'planning' then raise exception 'dating_not_ready'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v and i.guest_id <> v then raise exception 'not_allowed'; end if;
  v_split := nullif(p_plan->>'split', '');
  v_place := nullif(p_plan->>'place_kind', '');
  v_time := nullif(trim(p_plan->>'meet_time'), '');
  v_budget := nullif(trim(p_plan->>'budget_note'), '');
  if v_split is not null and v_split not in ('half', 'host', 'guest', 'separate', 'later') then raise exception 'invalid_budget'; end if;
  if v_place is not null and v_place not in ('cafe', 'dinner', 'picnic', 'walk') then raise exception 'invalid_kind'; end if;
  if v_time is not null and v_time !~ '^\d{2}:\d{2}$' then raise exception 'invalid_profile'; end if;
  if v_budget is not null and char_length(v_budget) > 200 then raise exception 'invalid_budget'; end if;
  begin
    v_date := nullif(p_plan->>'meet_date', '')::date;
  exception when others then
    raise exception 'invalid_profile';
  end;
  select coalesce(array_agg(x), '{}') into v_games
  from jsonb_array_elements_text(coalesce(p_plan->'game_ids', '[]'::jsonb)) x
  where x in ('two-truths', 'find-someone', 'runaway-story');
  select coalesce(array_agg(x), '{}') into v_missions
  from jsonb_array_elements_text(coalesce(p_plan->'mission_ids', '[]'::jsonb)) x
  where x in ('cook-snack', 'share-dessert', 'picnic-swap');
  if coalesce(array_length(v_games, 1), 0) > 2 or coalesce(array_length(v_missions, 1), 0) > 2 then
    raise exception 'invalid_kind';
  end if;
  insert into public.dating_plans (interest_id, meet_date, meet_time, place_kind, budget_note, split, game_ids, mission_ids, updated_at)
  values (i.id, v_date, v_time, v_place, v_budget, v_split, v_games, v_missions, now())
  on conflict (interest_id) do update set
    meet_date = excluded.meet_date,
    meet_time = excluded.meet_time,
    place_kind = excluded.place_kind,
    budget_note = excluded.budget_note,
    split = excluded.split,
    game_ids = excluded.game_ids,
    mission_ids = excluded.mission_ids,
    updated_at = now();
end $$;

create or replace function public.dating_end(p_interest uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); i public.dating_interests; l public.dating_listings; other uuid;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found then raise exception 'not_allowed'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v and i.guest_id <> v then raise exception 'not_allowed'; end if;
  if i.status in ('declined', 'cancelled') then return; end if;
  update public.dating_interests set status = 'cancelled', updated_at = now() where id = i.id;
  other := case when l.owner_id = v then i.guest_id else l.owner_id end;
  perform public._notify(other, 'dating_end', 'Randka odwołana', 'Druga osoba zakończyła ten kontakt.', jsonb_build_object('interest_id', i.id), 'dating-end:' || i.id);
end $$;

revoke all on function public._dating_km(float8, float8, float8, float8) from public, anon, authenticated;
revoke all on function public._dating_distance_label(float8) from public, anon, authenticated;
revoke all on function public._dating_age(date) from public, anon, authenticated;
revoke all on function public._dating_prompt(text) from public, anon, authenticated;
revoke all on function public._dating_open_contacts(uuid) from public, anon, authenticated;
revoke all on function public._dating_card(public.dating_profiles, float8, boolean) from public, anon, authenticated;

revoke all on function public.dating_my_profile() from public, anon;
revoke all on function public.dating_save_profile(jsonb) from public, anon;
revoke all on function public.dating_publish(jsonb) from public, anon;
revoke all on function public.dating_set_status(uuid, text) from public, anon;
revoke all on function public.dating_board(float8, float8) from public, anon;
revoke all on function public.dating_listing(uuid) from public, anon;
revoke all on function public.dating_my_listings() from public, anon;
revoke all on function public.dating_my_contacts() from public, anon;
revoke all on function public.dating_contact(uuid) from public, anon;
revoke all on function public.dating_express(uuid) from public, anon;
revoke all on function public.dating_pass(uuid) from public, anon;
revoke all on function public.dating_respond(uuid, boolean) from public, anon;
revoke all on function public.dating_ask(uuid, text[]) from public, anon;
revoke all on function public.dating_answer(uuid, jsonb) from public, anon;
revoke all on function public.dating_decide(uuid, text) from public, anon;
revoke all on function public.dating_save_plan(uuid, jsonb) from public, anon;
revoke all on function public.dating_end(uuid) from public, anon;

grant execute on function public.dating_my_profile() to authenticated;
grant execute on function public.dating_save_profile(jsonb) to authenticated;
grant execute on function public.dating_publish(jsonb) to authenticated;
grant execute on function public.dating_set_status(uuid, text) to authenticated;
grant execute on function public.dating_board(float8, float8) to authenticated;
grant execute on function public.dating_listing(uuid) to authenticated;
grant execute on function public.dating_my_listings() to authenticated;
grant execute on function public.dating_my_contacts() to authenticated;
grant execute on function public.dating_contact(uuid) to authenticated;
grant execute on function public.dating_express(uuid) to authenticated;
grant execute on function public.dating_pass(uuid) to authenticated;
grant execute on function public.dating_respond(uuid, boolean) to authenticated;
grant execute on function public.dating_ask(uuid, text[]) to authenticated;
grant execute on function public.dating_answer(uuid, jsonb) to authenticated;
grant execute on function public.dating_decide(uuid, text) to authenticated;
grant execute on function public.dating_save_plan(uuid, jsonb) to authenticated;
grant execute on function public.dating_end(uuid) to authenticated;

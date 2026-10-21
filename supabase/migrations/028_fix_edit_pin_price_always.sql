-- =====================================================================
-- 028: NAPRAWA edycji pinu + piny bez cen zawsze na mapie + wymóg cen
-- Uruchom ten plik nawet jeśli 024 padło — jest samodzielny.
-- =====================================================================

-- Kolumny (gdy coś brakuje)
alter table public.pins add column if not exists cover_url text;
alter table public.pins add column if not exists price_min int;
alter table public.pins add column if not exists price_max int;
alter table public.pins add column if not exists menu_text text;
alter table public.pins add column if not exists menu_photo_url text;
alter table public.pins add column if not exists menu_pdf_url text;
alter table public.pins add column if not exists tags text[] not null default '{}';

create table if not exists public.pin_edits (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  editor_id uuid not null references public.profiles(id) on delete cascade,
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists pin_edits_pin_idx on public.pin_edits (pin_id, created_at desc);
alter table public.pin_edits enable row level security;
drop policy if exists pin_edits_select on public.pin_edits;
create policy pin_edits_select on public.pin_edits for select to authenticated using (true);
grant select on public.pin_edits to authenticated;

grant update (
  title, description, cuisine, city, address, price_level, cover_url,
  price_min, price_max, menu_text, menu_photo_url, menu_pdf_url, tags
) on public.pins to authenticated;

-- Usuń stare przeciążenia update_pin (PostgREST gubi się przy wielu)
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text);
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text);

create function public.update_pin(
  p_pin uuid,
  p_title text default null,
  p_description text default null,
  p_cuisine text default null,
  p_city text default null,
  p_address text default null,
  p_price_min int default null,
  p_price_max int default null,
  p_menu_text text default null,
  p_menu_photo_url text default null,
  p_tags text[] default null,
  p_cover_url text default null,
  p_menu_pdf_url text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  old record;
  ch jsonb := '{}'::jsonb;
  v_level smallint;
  v_cover text;
  v_menu_photo text;
  v_menu_pdf text;
begin
  select * into old from public.pins where id = p_pin and status = 'published' for update;
  if old.id is null then raise exception 'pin_not_found'; end if;
  if p_price_min is not null and p_price_min < 0 then raise exception 'invalid_price'; end if;
  if p_price_max is not null and p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_min is not null and p_price_max is not null and p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  if p_menu_text is not null and char_length(p_menu_text) > 8000 then raise exception 'menu_too_long'; end if;
  if p_tags is not null and cardinality(p_tags) > 12 then raise exception 'too_many_tags'; end if;

  if p_cover_url is not null and nullif(trim(p_cover_url),'') is not null then
    if old.cover_url is not null and old.cover_url is distinct from nullif(trim(p_cover_url),'') then
      raise exception 'pin_cover_locked';
    end if;
    v_cover := nullif(trim(p_cover_url),'');
  end if;
  if p_menu_photo_url is not null and nullif(trim(p_menu_photo_url),'') is not null then
    if old.menu_photo_url is not null and old.menu_photo_url is distinct from nullif(trim(p_menu_photo_url),'') then
      raise exception 'pin_menu_photo_locked';
    end if;
    v_menu_photo := nullif(trim(p_menu_photo_url),'');
  end if;
  if p_menu_pdf_url is not null and nullif(trim(p_menu_pdf_url),'') is not null then
    if old.menu_pdf_url is not null and old.menu_pdf_url is distinct from nullif(trim(p_menu_pdf_url),'') then
      raise exception 'pin_menu_pdf_locked';
    end if;
    v_menu_pdf := nullif(trim(p_menu_pdf_url),'');
  end if;

  if p_title is not null and trim(p_title) is distinct from old.title then
    ch := ch || jsonb_build_object('title', jsonb_build_object('from', old.title, 'to', trim(p_title)));
  end if;
  if p_description is not null and p_description is distinct from old.description then ch := ch || jsonb_build_object('description', true); end if;
  if p_cuisine is not null and nullif(trim(p_cuisine),'') is distinct from old.cuisine then
    ch := ch || jsonb_build_object('cuisine', jsonb_build_object('from', old.cuisine, 'to', nullif(trim(p_cuisine),'')));
  end if;
  if p_city is not null and p_city is distinct from old.city then
    ch := ch || jsonb_build_object('city', jsonb_build_object('from', old.city, 'to', p_city));
  end if;
  if p_address is not null and nullif(trim(p_address),'') is distinct from old.address then ch := ch || jsonb_build_object('address', true); end if;
  if p_price_min is not null and p_price_min is distinct from old.price_min then
    ch := ch || jsonb_build_object('price_min', jsonb_build_object('from', old.price_min, 'to', p_price_min));
  end if;
  if p_price_max is not null and p_price_max is distinct from old.price_max then
    ch := ch || jsonb_build_object('price_max', jsonb_build_object('from', old.price_max, 'to', p_price_max));
  end if;
  if p_menu_text is not null and p_menu_text is distinct from old.menu_text then ch := ch || jsonb_build_object('menu_text', true); end if;
  if v_menu_photo is not null and v_menu_photo is distinct from old.menu_photo_url then ch := ch || jsonb_build_object('menu_photo_url', true); end if;
  if v_menu_pdf is not null and v_menu_pdf is distinct from old.menu_pdf_url then ch := ch || jsonb_build_object('menu_pdf_url', true); end if;
  if v_cover is not null and v_cover is distinct from old.cover_url then ch := ch || jsonb_build_object('cover_url', true); end if;
  if p_tags is not null and p_tags is distinct from old.tags then
    ch := ch || jsonb_build_object('tags', jsonb_build_object('from', to_jsonb(old.tags), 'to', to_jsonb(p_tags)));
  end if;
  if ch = '{}'::jsonb then return jsonb_build_object('updated', false, 'pin_id', p_pin); end if;

  v_level := old.price_level;
  if coalesce(p_price_min, old.price_min) is not null and coalesce(p_price_max, old.price_max) is not null then
    v_level := case
      when (coalesce(p_price_min, old.price_min) + coalesce(p_price_max, old.price_max)) / 2.0 < 25 then 1
      when (coalesce(p_price_min, old.price_min) + coalesce(p_price_max, old.price_max)) / 2.0 < 50 then 2
      when (coalesce(p_price_min, old.price_min) + coalesce(p_price_max, old.price_max)) / 2.0 < 90 then 3
      else 4 end;
  end if;

  update public.pins set
    title = case when p_title is not null then trim(p_title) else title end,
    description = coalesce(p_description, description),
    cuisine = case when p_cuisine is not null then nullif(trim(p_cuisine),'') else cuisine end,
    city = coalesce(p_city, city),
    address = case when p_address is not null then nullif(trim(p_address),'') else address end,
    price_min = coalesce(p_price_min, price_min),
    price_max = coalesce(p_price_max, price_max),
    price_level = v_level,
    menu_text = coalesce(p_menu_text, menu_text),
    menu_photo_url = coalesce(v_menu_photo, menu_photo_url),
    menu_pdf_url = coalesce(v_menu_pdf, menu_pdf_url),
    cover_url = coalesce(v_cover, cover_url),
    tags = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_pin;
  insert into public.pin_edits (pin_id, editor_id, changes) values (p_pin, v, ch);
  return jsonb_build_object('updated', true, 'pin_id', p_pin, 'changes', ch);
end $$;
grant execute on function public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text) to authenticated;

-- create_pin: wymagane widełki cenowe
create or replace function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null, p_address text default null,
  p_price_min int default null, p_price_max int default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_level smallint;
begin
  if p_price_min is null or p_price_max is null then raise exception 'price_range_required'; end if;
  if p_price_min < 0 or p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;

  if exists (
    select 1 from public.pins
    where status = 'published'
      and st_dwithin(coords, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 40)
  ) then
    raise exception 'pin_already_exists';
  end if;
  v_level := p_price_level;
  if v_level is null then
    v_level := case
      when (p_price_min + p_price_max) / 2.0 < 25 then 1
      when (p_price_min + p_price_max) / 2.0 < 50 then 2
      when (p_price_min + p_price_max) / 2.0 < 90 then 3
      else 4
    end;
  end if;
  insert into public.pins (creator_id, title, description, cuisine, city, address, price_level, cover_url, price_min, price_max, coords)
  values (
    v, trim(p_title), p_description, nullif(trim(coalesce(p_cuisine, '')), ''), p_city,
    nullif(trim(coalesce(p_address, '')), ''), v_level, nullif(trim(coalesce(p_cover_url, '')), ''),
    p_price_min, p_price_max,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  ) returning id into v_id;

  begin
    insert into public.pin_edits (pin_id, editor_id, changes)
    values (v_id, v, jsonb_build_object('created', true, 'title', trim(p_title),
      'price_min', p_price_min, 'price_max', p_price_max));
  exception when others then null;
  end;

  -- hook misji (jeśli 025/027 już wgrało funkcję)
  begin perform public._mission_on_pin_created(v, v_id); exception when others then null; end;
  return v_id;
end $$;
grant execute on function public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int) to authenticated;

-- Filtr cen: BEZ widełek → zawsze widoczny
drop function if exists public.pins_in_bbox(float8, float8, float8, float8, text, int);
drop function if exists public.pins_in_bbox(double precision, double precision, double precision, double precision, text, integer);
drop function if exists public.pins_in_bbox(float8, float8, float8, float8, text, int, int, int);
drop function if exists public.pins_in_bbox(double precision, double precision, double precision, double precision, text, integer, integer, integer);

create function public.pins_in_bbox(
  p_south float8, p_west float8, p_north float8, p_east float8,
  p_cuisine text default null, p_limit int default 200,
  p_price_min int default null, p_price_max int default null
)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean, score numeric, review_count int, cover_url text)
language plpgsql stable security invoker set search_path = public, extensions as $$
begin
  if p_south < -90 or p_north > 90 or p_south >= p_north or p_west < -180 or p_east > 180 or p_west >= p_east then
    raise exception 'invalid_bbox';
  end if;
  if p_price_min is not null and p_price_min < 0 then raise exception 'invalid_price'; end if;
  if p_price_max is not null and p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_min is not null and p_price_max is not null and p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;

  return query
  select p.id, p.title, st_y(p.coords::geometry), st_x(p.coords::geometry), p.cuisine, p.is_official, s.yummeet_score, coalesce(s.review_count, 0), p.cover_url
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published'
    and p.coords && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
    and (p_cuisine is null or p.cuisine = p_cuisine)
    and (
      -- brak filtra cen
      (p_price_min is null and p_price_max is null)
      -- lokal BEZ widełek zawsze widać
      or (p.price_min is null and p.price_max is null)
      -- nakładanie zakresów
      or (
        coalesce(p.price_min, p.price_max) <= coalesce(p_price_max, 999999)
        and coalesce(p.price_max, p.price_min) >= coalesce(p_price_min, 0)
      )
    )
  order by s.yummeet_score desc nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 300);
end $$;
grant execute on function public.pins_in_bbox(float8, float8, float8, float8, text, int, int, int) to authenticated;

-- Peer review table (gdy 025 nie doszło)
create table if not exists public.mission_community_votes (
  user_mission_id uuid not null references public.user_missions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  approved boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_mission_id, reviewer_id)
);
alter table public.user_missions add column if not exists community_approvals int not null default 0;
alter table public.user_missions add column if not exists community_open boolean not null default false;
alter table public.user_missions add column if not exists review_deadline timestamptz;
alter table public.user_missions add column if not exists linked_ref_type text;
alter table public.user_missions add column if not exists linked_ref_id uuid;

-- DROP inbox (naprawa 024/025) — zachowaj wersję z 027
drop function if exists public.mission_review_inbox(int);
drop function if exists public.mission_review_inbox(integer);

create function public.mission_review_inbox(p_limit int default 30)
returns table (
  user_mission_id uuid, mission_name text, mission_code text, owner_name text,
  submitted_at timestamptz, review_deadline timestamptz, evidence text,
  approvals int, approvals_needed int, linked_pin_id uuid
)
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  begin perform public.mission_auto_approve_overdue(); exception when others then null; end;
  return query
  select um.id, m.name, m.code, p.display_name, um.submitted_at, um.review_deadline,
         (select me.content from public.mission_evidence me where me.user_mission_id = um.id order by me.created_at desc limit 1),
         coalesce(um.community_approvals, 0),
         least(greatest(coalesce((m.verify_meta->>'peer_approvals_needed')::int, 1), 1), 5),
         case when um.linked_ref_type = 'pin' then um.linked_ref_id else null end
  from public.user_missions um
  join public.mission_definitions m on m.id = um.mission_id
  join public.profiles p on p.id = um.user_id
  where um.status = 'pending_confirmation'
    and coalesce(um.community_open, false) = true
    and um.user_id <> v
    and not public.is_blocked(um.user_id, v)
    and not exists (
      select 1 from public.mission_community_votes mv
      where mv.user_mission_id = um.id and mv.reviewer_id = v
    )
  order by um.submitted_at asc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;
grant execute on function public.mission_review_inbox(int) to authenticated;

-- Dziennik (gdy 026 częściowo)
create or replace function public.my_meeting_journal(p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  return coalesce((
    select jsonb_agg(row_data order by sort_at desc)
    from (
      select e.starts_at as sort_at, jsonb_build_object(
        'id', e.id, 'title', e.title, 'description', e.description, 'theme', e.theme, 'rules', e.rules,
        'kind', e.kind, 'place_name', e.place_name, 'starts_at', e.starts_at, 'status', e.status,
        'my_status', coalesce(ep.status, case when e.organizer_id = v then 'organizer' else null end),
        'capacity', e.capacity, 'seats_taken', e.seats_taken,
        'attractions', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'category', a.category, 'title', a.title, 'body', a.body) order by a.created_at)
          from public.event_attractions a where a.event_id = e.id
        ), '[]'::jsonb),
        'photos', coalesce((
          select jsonb_agg(jsonb_build_object('id', ph.id, 'photo_url', ph.photo_url, 'created_at', ph.created_at) order by ph.created_at)
          from public.event_photos ph where ph.event_id = e.id
        ), '[]'::jsonb)
      ) as row_data
      from public.events e
      left join public.event_participants ep on ep.event_id = e.id and ep.user_id = v
      where e.organizer_id = v or ep.user_id is not null
      order by e.starts_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) q
  ), '[]'::jsonb);
end $$;
grant execute on function public.my_meeting_journal(int) to authenticated;

notify pgrst, 'reload schema';

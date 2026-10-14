-- =====================================================================
-- 015: Jedzenie — lokalizacja, 20 km, limity zdjęć, powiadomienia
-- =====================================================================

alter table public.food_offers add column if not exists city text;
alter table public.food_offers add column if not exists street text;
alter table public.food_offers add column if not exists place_detail text;
alter table public.food_offers add column if not exists coords geography(point, 4326);

do $$ begin
  update public.food_offers
     set coords = st_setsrid(st_makepoint(place_lng, place_lat), 4326)::geography
   where coords is null and place_lat is not null and place_lng is not null;
exception when others then null;
end $$;

create index if not exists food_offers_coords_idx on public.food_offers using gist (coords);

alter table public.cooking_tips add column if not exists place_lat float8;
alter table public.cooking_tips add column if not exists place_lng float8;
alter table public.cooking_tips add column if not exists coords geography(point, 4326);
create index if not exists cooking_tips_coords_idx on public.cooking_tips using gist (coords);

-- Dłuższy cache GPS do powiadomień (presence dueli czyści się co ~10 min)
create table if not exists public.user_geo_cache (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coords geography(point, 4326) not null,
  updated_at timestamptz not null default now()
);
create index if not exists user_geo_cache_coords_idx on public.user_geo_cache using gist (coords);
alter table public.user_geo_cache enable row level security;
drop policy if exists geo_cache_own on public.user_geo_cache;
create policy geo_cache_own on public.user_geo_cache for select to authenticated using (user_id = auth.uid());
grant select on public.user_geo_cache to authenticated;

create or replace function public.touch_user_geo(p_lat float8, p_lng float8)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_pt geography;
begin
  if p_lat is null or p_lng is null then return; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then return; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  insert into public.user_geo_cache (user_id, coords, updated_at) values (v, v_pt, now())
  on conflict (user_id) do update set coords = excluded.coords, updated_at = now();
end $$;
grant execute on function public.touch_user_geo(float8, float8) to authenticated;

-- Limit 5 zdjęć / miesiąc (konta free = wszyscy user)
create table if not exists public.photo_upload_quota (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  count int not null default 0 check (count >= 0),
  primary key (user_id, year_month)
);
alter table public.photo_upload_quota enable row level security;
drop policy if exists photo_quota_own on public.photo_upload_quota;
create policy photo_quota_own on public.photo_upload_quota for select to authenticated using (user_id = auth.uid());
grant select on public.photo_upload_quota to authenticated;

create or replace function public.claim_photo_upload(p_limit int default 5)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); ym text := to_char(now() at time zone 'utc', 'YYYY-MM'); n int;
begin
  insert into public.photo_upload_quota (user_id, year_month, count)
  values (v, ym, 1)
  on conflict (user_id, year_month) do update
    set count = public.photo_upload_quota.count + 1
    where public.photo_upload_quota.count < p_limit
  returning count into n;
  if n is null then
    select count into n from public.photo_upload_quota where user_id = v and year_month = ym;
    raise exception 'photo_quota_exceeded';
  end if;
  return jsonb_build_object('used', n, 'limit', p_limit, 'year_month', ym);
end $$;
grant execute on function public.claim_photo_upload(int) to authenticated;

create or replace function public.photo_quota_status(p_limit int default 5)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid(); ym text := to_char(now() at time zone 'utc', 'YYYY-MM'); n int := 0;
begin
  select coalesce(count, 0) into n from public.photo_upload_quota where user_id = v and year_month = ym;
  return jsonb_build_object('used', n, 'limit', p_limit, 'remaining', greatest(p_limit - n, 0), 'year_month', ym);
end $$;
grant execute on function public.photo_quota_status(int) to authenticated;

-- Publikacja oferty + GPS + powiadomienia w 20 km (indeks GiST — nie skanuje wszystkich użytkowników)
create or replace function public.publish_food_offer(
  p_kind text,
  p_title text,
  p_description text default null,
  p_photo_url text default null,
  p_allergens text[] default '{}',
  p_portions int default 1,
  p_city text default null,
  p_street text default null,
  p_place_detail text default null,
  p_lat float8 default null,
  p_lng float8 default null,
  p_storage text default null,
  p_prepared_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._uid();
  v_id uuid;
  v_pt geography;
  r record;
  v_place text;
  n_notif int := 0;
begin
  if p_kind not in ('giveaway','exchange','signature','order') then raise exception 'invalid_kind'; end if;
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if p_portions is null or p_portions < 1 or p_portions > 200 then raise exception 'invalid_portions'; end if;
  if p_allergens is null or cardinality(p_allergens) = 0 then raise exception 'allergens_required'; end if;

  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_place := nullif(trim(concat_ws(', ', nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''))), '');

  perform public.touch_user_geo(p_lat, p_lng);

  insert into public.food_offers (
    owner_id, offer_kind, title, description, photo_url, allergens, portions, portions_left,
    city, street, place_detail, pickup_place_public, place_lat, place_lng, coords,
    storage_conditions, prepared_at, status
  ) values (
    v, p_kind, trim(p_title), nullif(trim(coalesce(p_description,'')),''), nullif(trim(coalesce(p_photo_url,'')),''),
    p_allergens, p_portions, p_portions,
    nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''),
    v_place, p_lat, p_lng, v_pt, nullif(trim(coalesce(p_storage,'')),''), p_prepared_at, 'available'
  ) returning id into v_id;

  -- Powiadom max 100 z geo_cache w 20 km (indeks GiST) — O(nearby), nie O(wszyscy)
  for r in
    select g.user_id
    from public.user_geo_cache g
    where g.user_id <> v
      and g.updated_at > now() - interval '30 days'
      and st_dwithin(g.coords, v_pt, 20000)
    order by g.updated_at desc
    limit 100
  loop
    perform public._notify(
      r.user_id,
      'food_nearby',
      'Nowa oferta jedzenia w okolicy',
      trim(p_title),
      jsonb_build_object('offer_id', v_id, 'kind', p_kind),
      'food:' || v_id || ':' || r.user_id
    );
    n_notif := n_notif + 1;
  end loop;

  return v_id;
end $$;
grant execute on function public.publish_food_offer(text, text, text, text, text[], int, text, text, text, float8, float8, text, timestamptz) to authenticated;

create or replace function public.publish_cooking_tip(
  p_title text, p_body text, p_photo_url text default null, p_lat float8 default null, p_lng float8 default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_pt geography; r record;
begin
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_body is null or char_length(trim(p_body)) < 10 then raise exception 'invalid_body'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  perform public.touch_user_geo(p_lat, p_lng);
  insert into public.cooking_tips (author_id, title, body, photo_url, place_lat, place_lng, coords)
  values (v, trim(p_title), trim(p_body), nullif(trim(coalesce(p_photo_url,'')),''), p_lat, p_lng, v_pt)
  returning id into v_id;
  for r in
    select g.user_id from public.user_geo_cache g
    where g.user_id <> v and g.updated_at > now() - interval '30 days' and st_dwithin(g.coords, v_pt, 20000)
    order by g.updated_at desc limit 100
  loop
    perform public._notify(r.user_id, 'tip_nearby', 'Nowa inspiracja kulinarna w okolicy', trim(p_title),
      jsonb_build_object('tip_id', v_id), 'tip:' || v_id || ':' || r.user_id);
  end loop;
  return v_id;
end $$;
grant execute on function public.publish_cooking_tip(text, text, text, float8, float8) to authenticated;

create or replace function public.list_food_nearby(p_kind text, p_lat float8, p_lng float8, p_limit int default 50)
returns table (
  id uuid, owner_id uuid, title text, description text, photo_url text, allergens text[],
  portions int, portions_left int, pickup_place_public text, city text, street text, place_detail text,
  status text, offer_kind text, created_at timestamptz, place_lat float8, place_lng float8, owner_name text
)
language plpgsql security definer set search_path = public, extensions as $$
declare v_pt geography;
begin
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  perform public.touch_user_geo(p_lat, p_lng);
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  return query
  select o.id, o.owner_id, o.title, o.description, o.photo_url, o.allergens,
         o.portions, o.portions_left, o.pickup_place_public, o.city, o.street, o.place_detail,
         o.status, o.offer_kind, o.created_at, o.place_lat, o.place_lng,
         p.display_name
  from public.food_offers o
  left join public.profiles p on p.id = o.owner_id
  where o.offer_kind = p_kind
    and o.status in ('available','reserved')
    and o.coords is not null
    and st_dwithin(o.coords, v_pt, 20000)
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
grant execute on function public.list_food_nearby(text, float8, float8, int) to authenticated;

create or replace function public.list_tips_nearby(p_lat float8, p_lng float8, p_limit int default 50)
returns table (
  id uuid, author_id uuid, title text, body text, photo_url text, created_at timestamptz, author_name text
)
language plpgsql security definer set search_path = public, extensions as $$
declare v_pt geography;
begin
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  perform public.touch_user_geo(p_lat, p_lng);
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  return query
  select t.id, t.author_id, t.title, t.body, t.photo_url, t.created_at, p.display_name
  from public.cooking_tips t
  left join public.profiles p on p.id = t.author_id
  where t.coords is not null and st_dwithin(t.coords, v_pt, 20000)
  order by t.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
grant execute on function public.list_tips_nearby(float8, float8, int) to authenticated;

create or replace function public.food_offer_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'owner_id', o.owner_id, 'title', o.title, 'description', o.description,
    'photo_url', o.photo_url, 'allergens', o.allergens, 'portions', o.portions, 'portions_left', o.portions_left,
    'city', o.city, 'street', o.street, 'place_detail', o.place_detail,
    'pickup_place_public', o.pickup_place_public, 'offer_kind', o.offer_kind, 'status', o.status,
    'place_lat', o.place_lat, 'place_lng', o.place_lng, 'created_at', o.created_at,
    'storage_conditions', o.storage_conditions, 'prepared_at', o.prepared_at,
    'owner_name', (select display_name from public.profiles p where p.id = o.owner_id)
  )
  from public.food_offers o where o.id = p_id;
$$;
grant execute on function public.food_offer_details(uuid) to authenticated;

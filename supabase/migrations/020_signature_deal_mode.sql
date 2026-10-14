-- =====================================================================
-- 020: Popisowe — tryb współpracy (wynagrodzenie / składniki+podział)
-- =====================================================================

alter table public.food_offers add column if not exists deal_mode text;
do $$ begin
  alter table public.food_offers drop constraint if exists food_offers_deal_mode_ok;
  alter table public.food_offers add constraint food_offers_deal_mode_ok
    check (deal_mode is null or deal_mode in ('paid', 'ingredients_split'));
exception when others then null;
end $$;

drop function if exists public.publish_food_offer(text, text, text, text, text[], int, text, text, text, float8, float8, text, timestamptz);
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
  p_prepared_at timestamptz default null,
  p_deal_mode text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._uid();
  v_id uuid;
  v_pt geography;
  r record;
  v_place text;
  v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
  v_deal text := nullif(trim(coalesce(p_deal_mode, '')), '');
begin
  if p_kind not in ('giveaway','exchange','signature','order') then raise exception 'invalid_kind'; end if;
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if p_portions is null or p_portions < 1 or p_portions > 200 then raise exception 'invalid_portions'; end if;
  if p_allergens is null or cardinality(p_allergens) = 0 then raise exception 'allergens_required'; end if;

  if p_kind = 'signature' then
    if v_deal is null or v_deal not in ('paid', 'ingredients_split') then
      raise exception 'deal_mode_required';
    end if;
  else
    v_deal := null;
  end if;

  if v_photo is not null then
    perform public.claim_photo_slot('food_offer', v_photo, null, 3);
  end if;

  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_place := nullif(trim(concat_ws(', ', nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''))), '');
  begin perform public.touch_user_geo(p_lat, p_lng); exception when others then null; end;

  insert into public.food_offers (
    owner_id, offer_kind, title, description, photo_url, allergens, portions, portions_left,
    city, street, place_detail, pickup_place_public, place_lat, place_lng, coords,
    storage_conditions, prepared_at, status, deal_mode
  ) values (
    v, p_kind, trim(p_title), nullif(trim(coalesce(p_description,'')),''), v_photo,
    p_allergens, p_portions, p_portions,
    nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''),
    v_place, p_lat, p_lng, v_pt, nullif(trim(coalesce(p_storage,'')),''), p_prepared_at, 'available', v_deal
  ) returning id into v_id;

  if v_photo is not null then
    update public.photo_slots set ref_id = v_id
     where user_id = v and kind = 'food_offer' and photo_url = v_photo and ref_id is null and released_at is null;
  end if;

  begin
    for r in
      select g.user_id from public.user_geo_cache g
      where g.user_id <> v and g.updated_at > now() - interval '30 days' and st_dwithin(g.coords, v_pt, 20000)
      order by g.updated_at desc limit 100
    loop
      perform public._notify(r.user_id, 'food_nearby', 'Nowa oferta jedzenia w okolicy', trim(p_title),
        jsonb_build_object('offer_id', v_id, 'kind', p_kind), 'food:' || v_id || ':' || r.user_id);
    end loop;
  exception when others then null;
  end;
  return v_id;
end $$;
grant execute on function public.publish_food_offer(text, text, text, text, text[], int, text, text, text, float8, float8, text, timestamptz, text) to authenticated;

drop function if exists public.list_food_nearby(text, float8, float8, int);
create or replace function public.list_food_nearby(p_kind text, p_lat float8, p_lng float8, p_limit int default 50)
returns table (
  id uuid, owner_id uuid, title text, description text, photo_url text, allergens text[],
  portions int, portions_left int, pickup_place_public text, city text, street text, place_detail text,
  status text, offer_kind text, created_at timestamptz, place_lat float8, place_lng float8,
  owner_name text, deal_mode text
)
language plpgsql security definer set search_path = public, extensions as $$
declare v_pt geography;
begin
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  begin perform public.touch_user_geo(p_lat, p_lng); exception when others then null; end;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  return query
  select o.id, o.owner_id, o.title, o.description, o.photo_url, o.allergens,
         o.portions, o.portions_left, o.pickup_place_public, o.city, o.street, o.place_detail,
         o.status, o.offer_kind, o.created_at, o.place_lat, o.place_lng,
         p.display_name, o.deal_mode
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

create or replace function public.food_offer_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'owner_id', o.owner_id, 'title', o.title, 'description', o.description,
    'photo_url', o.photo_url, 'allergens', o.allergens, 'portions', o.portions, 'portions_left', o.portions_left,
    'city', o.city, 'street', o.street, 'place_detail', o.place_detail,
    'pickup_place_public', o.pickup_place_public, 'offer_kind', o.offer_kind, 'status', o.status,
    'place_lat', o.place_lat, 'place_lng', o.place_lng, 'created_at', o.created_at,
    'storage_conditions', o.storage_conditions, 'prepared_at', o.prepared_at,
    'deal_mode', o.deal_mode,
    'owner_name', (select display_name from public.profiles p where p.id = o.owner_id)
  )
  from public.food_offers o where o.id = p_id;
$$;
grant execute on function public.food_offer_details(uuid) to authenticated;

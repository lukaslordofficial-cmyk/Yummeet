-- Prevent duplicate restaurant pins near the same coordinates (~40 m).
-- Existing pin keeps locked coords; user should leave a review instead.

create or replace function public.find_nearby_pin(p_lat float8, p_lng float8, p_radius_m float8 default 40)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, city text, address text)
language sql stable security invoker set search_path = public, extensions as $$
  select p.id, p.title,
         st_y(p.coords::geometry), st_x(p.coords::geometry),
         p.cuisine, p.city, p.address
  from public.pins p
  where p.status = 'published'
    and st_dwithin(p.coords, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
  order by st_distance(p.coords, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  limit 1;
$$;

create or replace function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null, p_address text default null
) returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_near uuid; v_near_title text;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if (select count(*) from public.pins where creator_id = v and created_at > now() - interval '1 day') >= 30 then raise exception 'rate_limited'; end if;

  select n.id, n.title into v_near, v_near_title from public.find_nearby_pin(p_lat, p_lng, 40) n;
  if v_near is not null then
    raise exception 'pin_already_exists:%:%', v_near, coalesce(v_near_title, 'lokal');
  end if;

  insert into public.pins (creator_id, title, description, cuisine, city, address, price_level, cover_url, coords)
  values (
    v, trim(p_title), p_description, p_cuisine, p_city, nullif(trim(coalesce(p_address, '')), ''),
    p_price_level, nullif(trim(coalesce(p_cover_url, '')), ''),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.find_nearby_pin(float8, float8, float8) to authenticated;

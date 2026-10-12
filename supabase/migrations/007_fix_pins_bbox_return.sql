-- Safe re-apply if 006 failed on "cannot change return type".
-- DROP then recreate pins_in_bbox / pins_along_route with cover_url.

drop function if exists public.pins_in_bbox(double precision, double precision, double precision, double precision, text, integer);
drop function if exists public.pins_in_bbox(float8, float8, float8, float8, text, int);

create or replace function public.pins_in_bbox(p_south float8, p_west float8, p_north float8, p_east float8, p_cuisine text default null, p_limit int default 200)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean, score numeric, review_count int, cover_url text)
language plpgsql stable security invoker set search_path = public, extensions as $$
begin
  if p_south < -90 or p_north > 90 or p_south >= p_north or p_west < -180 or p_east > 180 or p_west >= p_east then
    raise exception 'invalid_bbox';
  end if;
  return query
  select p.id, p.title, st_y(p.coords::geometry), st_x(p.coords::geometry), p.cuisine, p.is_official, s.yummeet_score, coalesce(s.review_count, 0), p.cover_url
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published'
    and p.coords && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
    and (p_cuisine is null or p.cuisine = p_cuisine)
  order by s.yummeet_score desc nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 300);
end $$;

drop function if exists public.pins_along_route(jsonb, integer, integer, text);
drop function if exists public.pins_along_route(jsonb, int, int, text);
drop function if exists public.pins_along_route(jsonb, integer, integer);
drop function if exists public.pins_along_route(jsonb, int, int);

create or replace function public.pins_along_route(
  p_path jsonb, p_buffer_m int default 1000, p_limit int default 100, p_cuisine text default null
)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean, score numeric, review_count int, distance_m float8, along float8, cover_url text)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_line geometry; n int;
begin
  if jsonb_typeof(p_path) <> 'array' then raise exception 'invalid_path'; end if;
  n := jsonb_array_length(p_path);
  if n < 2 or n > 2000 then raise exception 'invalid_path_length'; end if;
  if p_buffer_m < 50 or p_buffer_m > 10000 then raise exception 'invalid_buffer'; end if;
  select st_setsrid(st_makeline(array_agg(st_makepoint((e->>0)::float8, (e->>1)::float8) order by o)), 4326)
    into v_line from jsonb_array_elements(p_path) with ordinality as t(e, o);
  if v_line is null or not st_isvalid(v_line) or st_npoints(v_line) < 2 then raise exception 'invalid_geometry'; end if;
  if st_xmin(v_line) < -180 or st_xmax(v_line) > 180 or st_ymin(v_line) < -90 or st_ymax(v_line) > 90 then raise exception 'invalid_coordinates'; end if;
  return query
  select p.id, p.title, st_y(p.coords::geometry), st_x(p.coords::geometry), p.cuisine, p.is_official, s.yummeet_score, coalesce(s.review_count, 0),
         st_distance(p.coords, v_line::geography), st_linelocatepoint(v_line, p.coords::geometry), p.cover_url
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published' and st_dwithin(p.coords, v_line::geography, p_buffer_m)
    and (p_cuisine is null or p.cuisine = p_cuisine)
  order by st_linelocatepoint(v_line, p.coords::geometry)
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;

grant execute on function public.pins_in_bbox(float8, float8, float8, float8, text, int) to authenticated;
grant execute on function public.pins_along_route(jsonb, int, int, text) to authenticated;

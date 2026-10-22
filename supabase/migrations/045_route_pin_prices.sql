-- Gastro-Trasa: piny w pasie zwracają widełki cen, żeby kafelki ceny mogły je filtrować.

drop function if exists public.pins_along_route(jsonb, int, int, text);
drop function if exists public.pins_along_route(jsonb, integer, integer, text);
drop function if exists public.pins_along_route(jsonb, int, int);
drop function if exists public.pins_along_route(jsonb, integer, integer);
drop function if exists public.pins_along_route(jsonb, int, int, text, float8, float8);
drop function if exists public.pins_along_route(jsonb, integer, integer, text, double precision, double precision);

create function public.pins_along_route(
  p_path jsonb,
  p_buffer_m int default 1000,
  p_limit int default 80,
  p_cuisine text default null,
  p_near_lat float8 default null,
  p_near_lng float8 default null
)
returns table (
  id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean,
  score numeric, review_count int, distance_m float8, along float8, cover_url text,
  price_min int, price_max int
)
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
         st_distance(p.coords, v_line::geography), st_linelocatepoint(v_line, p.coords::geometry), p.cover_url,
         p.price_min, p.price_max
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published' and st_dwithin(p.coords, v_line::geography, p_buffer_m)
    and (p_cuisine is null or p.cuisine = p_cuisine)
  order by
    case
      when p_near_lat is not null and p_near_lng is not null
        then st_distance(p.coords, st_setsrid(st_makepoint(p_near_lng, p_near_lat), 4326)::geography)
      else st_linelocatepoint(v_line, p.coords::geometry) * 1000000
    end
  limit least(greatest(coalesce(p_limit, 80), 1), 120);
end $$;

grant execute on function public.pins_along_route(jsonb, int, int, text, float8, float8) to authenticated;

notify pgrst, 'reload schema';

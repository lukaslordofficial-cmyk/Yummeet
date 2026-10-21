-- Mapa w centrum dużego miasta ma po imporcie OSM kilkaset lokali w jednym kadrze.
-- Stary sufit (300) chował większość pinów. Nowy sufit: 1000.

drop function if exists public.pins_in_bbox(float8, float8, float8, float8, text, int, int, int);
drop function if exists public.pins_in_bbox(double precision, double precision, double precision, double precision, text, integer, integer, integer);

create function public.pins_in_bbox(
  p_south float8, p_west float8, p_north float8, p_east float8,
  p_cuisine text default null, p_limit int default 1000,
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
      (p_price_min is null and p_price_max is null)
      or (p.price_min is null and p.price_max is null)
      or (
        coalesce(p.price_min, p.price_max) <= coalesce(p_price_max, 999999)
        and coalesce(p.price_max, p.price_min) >= coalesce(p_price_min, 0)
      )
    )
  order by s.yummeet_score desc nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
end $$;

grant execute on function public.pins_in_bbox(float8, float8, float8, float8, text, int, int, int) to authenticated;

notify pgrst, 'reload schema';

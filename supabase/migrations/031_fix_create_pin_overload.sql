-- =====================================================================
-- 031: Usuń przeciążenia create_pin (PGRST203) — zostaw jedną sygnaturę
-- Objaw: nie da się dodać pinu ("Could not choose the best candidate function")
-- =====================================================================

drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint);
drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint, text);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint, text);
drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint, text, text);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint, text, text);
drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint, text, text, integer, integer);
drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint, text, text, integer);

create function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null, p_address text default null,
  p_price_min int default null, p_price_max int default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_level smallint;
begin
  if p_lat is null or p_lng is null then raise exception 'invalid_coordinates'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
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

  v_level := coalesce(p_price_level, case
    when (p_price_min + p_price_max) / 2.0 < 25 then 1
    when (p_price_min + p_price_max) / 2.0 < 50 then 2
    when (p_price_min + p_price_max) / 2.0 < 90 then 3
    else 4 end);

  insert into public.pins (creator_id, title, description, cuisine, city, address, price_level, cover_url, price_min, price_max, coords)
  values (
    v, trim(p_title), p_description, nullif(trim(coalesce(p_cuisine, '')), ''), p_city,
    nullif(trim(coalesce(p_address, '')), ''), v_level, nullif(trim(coalesce(p_cover_url, '')), ''),
    p_price_min, p_price_max, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  ) returning id into v_id;

  begin
    insert into public.pin_edits (pin_id, editor_id, changes)
    values (v_id, v, jsonb_build_object('created', true, 'title', trim(p_title),
      'price_min', p_price_min, 'price_max', p_price_max));
  exception when others then null;
  end;

  begin perform public._mission_auto_from_pin(v, v_id); exception when others then null; end;
  return v_id;
end $$;

grant execute on function public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int) to authenticated;

notify pgrst, 'reload schema';

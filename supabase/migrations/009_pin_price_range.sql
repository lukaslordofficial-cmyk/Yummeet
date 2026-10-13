-- Zakres cen (najtańsze–najdroższe danie) przy pinie.

alter table public.pins add column if not exists price_min int check (price_min is null or price_min >= 0);
alter table public.pins add column if not exists price_max int check (price_max is null or price_max >= 0);

do $$ begin
  alter table public.pins add constraint pins_price_range_ok check (
    price_min is null or price_max is null or price_max >= price_min
  );
exception when duplicate_object then null;
end $$;

grant update (title, description, cuisine, city, address, price_level, cover_url, price_min, price_max) on public.pins to authenticated;

create or replace function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null, p_address text default null,
  p_price_min int default null, p_price_max int default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_level smallint;
begin
  if exists (
    select 1 from public.pins
    where status = 'published'
      and st_dwithin(coords, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 40)
  ) then
    raise exception 'pin_already_exists';
  end if;
  v_level := p_price_level;
  if v_level is null and p_price_min is not null and p_price_max is not null then
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
  return v_id;
end $$;

grant execute on function public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int) to authenticated;

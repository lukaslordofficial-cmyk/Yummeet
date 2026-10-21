-- =====================================================================
-- 032: strona www przy pinie, usuwanie pinu, próbka 27 lokali z Warszawy
-- Źródło współrzędnych i adresów: OpenStreetMap, 18 października 2026.
-- Cen nie ma — menu zostaje na stronie lokalu.
-- =====================================================================

alter table public.pins add column if not exists website text;
alter table public.pins drop constraint if exists pins_website_len;
alter table public.pins add constraint pins_website_len check (website is null or char_length(website) <= 500);

-- create_pin: jedna sygnatura, opcjonalna strona
drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint, text, text, integer, integer);
drop function if exists public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int, text);
drop function if exists public.create_pin(text, double precision, double precision, text, text, text, smallint, text, text, integer, integer, text);

create function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null, p_address text default null,
  p_price_min int default null, p_price_max int default null, p_website text default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_level smallint; v_web text;
begin
  if p_lat is null or p_lng is null then raise exception 'invalid_coordinates'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if p_price_min is null or p_price_max is null then raise exception 'price_range_required'; end if;
  if p_price_min < 0 or p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  v_web := nullif(trim(coalesce(p_website, '')), '');
  if v_web is not null and char_length(v_web) > 500 then raise exception 'website_too_long'; end if;

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

  insert into public.pins (creator_id, title, description, cuisine, city, address, price_level, cover_url, price_min, price_max, website, coords)
  values (
    v, trim(p_title), p_description, nullif(trim(coalesce(p_cuisine, '')), ''), p_city,
    nullif(trim(coalesce(p_address, '')), ''), v_level, nullif(trim(coalesce(p_cover_url, '')), ''),
    p_price_min, p_price_max, v_web, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
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

grant execute on function public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int, text) to authenticated;

-- update_pin: zapis strony
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text);
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text, text);

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
  p_menu_pdf_url text default null,
  p_website text default null
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
  v_web text;
begin
  select * into old from public.pins where id = p_pin and status = 'published' for update;
  if old.id is null then raise exception 'pin_not_found'; end if;
  if p_price_min is not null and p_price_min < 0 then raise exception 'invalid_price'; end if;
  if p_price_max is not null and p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_min is not null and p_price_max is not null and p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  if p_menu_text is not null and char_length(p_menu_text) > 8000 then raise exception 'menu_too_long'; end if;
  if p_tags is not null and cardinality(p_tags) > 12 then raise exception 'too_many_tags'; end if;
  if p_website is not null then
    v_web := nullif(trim(p_website), '');
    if v_web is not null and char_length(v_web) > 500 then raise exception 'website_too_long'; end if;
  end if;

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
  if p_website is not null and v_web is distinct from old.website then ch := ch || jsonb_build_object('website', true); end if;
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
    website = case when p_website is not null then v_web else website end,
    updated_at = now()
  where id = p_pin;

  begin
    insert into public.pin_edits (pin_id, editor_id, changes) values (p_pin, v, ch);
  exception when others then null;
  end;

  return jsonb_build_object('updated', true, 'pin_id', p_pin, 'changes', ch);
end $$;
grant execute on function public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text, text) to authenticated;

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'price_min', p.price_min, 'price_max', p.price_max,
    'menu_text', p.menu_text, 'menu_photo_url', p.menu_photo_url, 'menu_pdf_url', p.menu_pdf_url, 'tags', coalesce(p.tags, '{}'),
    'website', p.website,
    'is_official', p.is_official, 'creator_id', p.creator_id, 'created_at', p.created_at, 'cover_url', p.cover_url,
    'lat', st_y(p.coords::geometry), 'lng', st_x(p.coords::geometry),
    'summary', (select to_jsonb(s) from public.restaurant_rating_summaries s where s.pin_id = p.id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'author', pr.display_name, 'food', r.food, 'atmosphere', r.atmosphere,
          'service', r.service, 'price_value', r.price_value, 'purposes', r.purposes, 'best_dish', r.best_dish, 'tip', r.tip, 'body', r.body,
          'visit_verified', r.visit_verified, 'created_at', r.created_at) order by r.created_at desc)
        from (select * from public.restaurant_reviews where pin_id = p.id order by created_at desc limit 20) r
        left join public.profiles pr on pr.id = r.user_id), '[]'::jsonb),
    'edit_history', coalesce((select jsonb_agg(jsonb_build_object(
          'id', e.id, 'editor_id', e.editor_id, 'editor_name', ep.display_name,
          'changes', e.changes, 'created_at', e.created_at) order by e.created_at desc)
        from (select * from public.pin_edits where pin_id = p.id order by created_at desc limit 30) e
        left join public.profiles ep on ep.id = e.editor_id), '[]'::jsonb),
    'visited', exists (select 1 from public.visited_places v where v.pin_id = p.id and v.user_id = auth.uid()))
  from public.pins p where p.id = p_id;
$$;

-- Każdy zalogowany może zdjąć pin z mapy (status removed). MVP do sprzątania próbki.
create or replace function public.delete_pin(p_pin uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  update public.pins
     set status = 'removed', updated_at = now()
   where id = p_pin and status = 'published';
  if not found then raise exception 'pin_not_found'; end if;
  begin
    insert into public.pin_edits (pin_id, editor_id, changes)
    values (p_pin, v, jsonb_build_object('removed', true));
  exception when others then null;
  end;
end $$;
grant execute on function public.delete_pin(uuid) to authenticated;

-- Próbka Warszawy. Pomija lokal, który już stoi pod tą nazwą w promieniu 80 m.
insert into public.pins (title, description, cuisine, city, address, website, coords, status, is_official)
select
  v.title,
  'Menu i ceny: ' || v.website || case when v.phone <> '' then '. Tel. ' || v.phone else '' end,
  nullif(v.cuisine, ''),
  'Warszawa',
  v.address,
  v.website,
  st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography,
  'published',
  false
from (values
  ('360°'::text, 'pizza'::text, 'Chłodna 2/18, Warszawa'::text, 'https://360pizza.pl/360-menu-chlodna'::text, '+48 666 408 360'::text, 52.23806::float8, 20.99115::float8),
  ('Ararat', 'middle_east', 'Czerniakowska 58, 00-717 Warszawa', 'http://ararat.warszawa.pl/', '+48 780 089 007', 52.21100, 21.04801),
  ('Beef N'' Pepper', 'steakhouse', 'Nowogrodzka 47A, 00-695 Warszawa', 'http://www.beefandpepper.pl/', '+48 785 025 025', 52.22752, 21.00836),
  ('Bistro Warszawa', 'international', 'Rynek Starego Miasta 1/3, 00-281 Warszawa', 'https://bistrowarszawa.pl/', '+48 22 635 37 69', 52.24961, 21.01295),
  ('Cafe Furkot', 'cafe', 'Chłodna 2/18, Warszawa', 'https://cafefurkot.com.pl', '', 52.23814, 20.99141),
  ('Chicago''s Pizza', 'pizza', 'Jana Kasprowicza 103a, Warszawa', 'https://www.chicagospizza.pl/', '+48 22 864 07 70', 52.28374, 20.94434),
  ('Da Grasso', 'pizza', 'Aleja Niepodległości 121/123, Warszawa', 'https://www.dagrasso.pl/warszawa-mokotow', '', 52.19952, 21.01141),
  ('Efes', 'turkish', 'Aleja Niepodległości 80, Warszawa', 'https://www.restauracjaefes.pl/', '+48 22 898 30 01', 52.19630, 21.01396),
  ('Gaga', 'georgian', 'Aleje Jerozolimskie 111, 02-017 Warszawa', 'https://gaga-rest.pl/', '+48 501 619 057', 52.22573, 20.99402),
  ('Guru', 'indian', 'Widok 8, 00-023 Warszawa', 'https://www.pyszneguru.pl/', '+48 22 857 06 04', 52.23153, 21.01514),
  ('K-bar', 'korean', 'Plac Inwalidów 10, 01-552 Warszawa', 'https://kbar.pl', '', 52.26531, 20.99074),
  ('Klubo - Restauracja Fotoplastikon', 'other', 'Bazyliańska 20, 03-203 Warszawa', 'http://www.fotoplastikon.waw.pl/', '+48 501 716 165', 52.29309, 21.02609),
  ('Maharaja', 'indian', 'Grzybowska 61, Warszawa', 'http://www.maharaja.waw.pl/', '+48 22 416 72 40', 52.23338, 20.98728),
  ('Meltemi', 'greek', 'Opaczewska 43, Warszawa', 'https://kregliccy.pl/meltemi', '+48 691 990 057', 52.20909, 20.96275),
  ('Na Cyplu', 'other', 'Generała Mariusza Zaruskiego 12, 00-468 Warszawa', 'https://www.montaclub.com.pl/', '+48 510 270 501', 52.22557, 21.04560),
  ('Noriko Omakase', 'sushi', 'Mińska 45/204u, 03-808 Warszawa', 'https://norikosushi.pl', '+48 510 339 210', 52.24989, 21.06460),
  ('OTO! Sushi', 'sushi', 'Nowy Świat 46, 00-363 Warszawa', 'https://www.oto-sushi.pl/', '+48 22 828 00 88', 52.23466, 21.01897),
  ('Pianka', 'pizza', 'Zgoda 12, 00-012 Warszawa', 'https://piankaztanka.pl/zgoda/', '+48 22 827 30 03', 52.23366, 21.01135),
  ('Pizzeria K2', 'pizza', 'Usypiskowa 18, Warszawa', 'https://www.pizzeria-k2.pl/', '+48 573 161 696', 52.20466, 20.96170),
  ('Pół Żartem Pół Serio Slow Bistro', 'international', 'Włodarzewska 58S, Warszawa', 'https://catering-mg.pl/slow-bistro/', '+48 735 915 100', 52.20234, 20.95482),
  ('Restauracja muzyczna Struna', 'polish', 'Aleja Władysława Reymonta 12, 01-842 Warszawa', 'https://restauracjastruna.pl/', '+48 504 041 277', 52.27464, 20.93795),
  ('San Thai', 'thai', 'Próżna 10, Warszawa', 'https://restauracjasanthai.pl', '+48 577 607 775', 52.23661, 21.00504),
  ('Smaki Sushi', 'sushi', 'Bukowińska 10, Warszawa', 'https://www.smakisushi.pl/', '', 52.18028, 21.02823),
  ('Stara Kamienica', 'other', 'Widok 8, 00-023 Warszawa', 'https://stara-kamienica.com.pl/', '+48 22 114 43 33', 52.23156, 21.01524),
  ('Tasty', 'polish', 'Wołoska 9A, Warszawa', 'https://www.tasty-restauracja.com/', '+48 787 977 743', 52.18478, 21.00017),
  ('Todo Sushi', 'sushi', 'Zygmunta Krasińskiego 10, 01-615 Warszawa', 'http://todosushi.pl/', '+48 693 770 429', 52.26970, 20.98833),
  ('Vegan Ramen Shop', 'vegan', 'Aleja Jana Pawła II 52/54, 00-152 Warszawa', 'https://www.veganramenshop.pl/', '', 52.24433, 20.99208)
) as v(title, cuisine, address, website, phone, lat, lng)
where not exists (
  select 1 from public.pins p
  where p.status = 'published'
    and p.title = v.title
    and st_dwithin(p.coords, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography, 80)
);

notify pgrst, 'reload schema';

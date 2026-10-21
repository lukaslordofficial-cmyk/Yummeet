-- =====================================================================
-- 036: Telefon + linki do platform dostawy (Wolt / Pyszne / Glovo / Uber Eats)
-- Przyciski w apce pokazują się tylko gdy pole jest wypełnione.
-- =====================================================================

alter table public.pins add column if not exists phone text;
alter table public.pins add column if not exists order_wolt_url text;
alter table public.pins add column if not exists order_pyszne_url text;
alter table public.pins add column if not exists order_glovo_url text;
alter table public.pins add column if not exists order_uber_url text;

alter table public.pins drop constraint if exists pins_phone_len;
alter table public.pins add constraint pins_phone_len check (phone is null or char_length(phone) <= 40);
alter table public.pins drop constraint if exists pins_order_wolt_len;
alter table public.pins add constraint pins_order_wolt_len check (order_wolt_url is null or char_length(order_wolt_url) <= 500);
alter table public.pins drop constraint if exists pins_order_pyszne_len;
alter table public.pins add constraint pins_order_pyszne_len check (order_pyszne_url is null or char_length(order_pyszne_url) <= 500);
alter table public.pins drop constraint if exists pins_order_glovo_len;
alter table public.pins add constraint pins_order_glovo_len check (order_glovo_url is null or char_length(order_glovo_url) <= 500);
alter table public.pins drop constraint if exists pins_order_uber_len;
alter table public.pins add constraint pins_order_uber_len check (order_uber_url is null or char_length(order_uber_url) <= 500);

-- Telefon z opisu (seedy Warszawy/Krakowa/stolic mają „Tel. …”)
update public.pins
set phone = nullif(trim(substring(description from 'Tel\.\s*(.+)$')), '')
where (phone is null or trim(phone) = '')
  and description ~ 'Tel\.';

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'price_min', p.price_min, 'price_max', p.price_max,
    'menu_text', p.menu_text, 'menu_photo_url', p.menu_photo_url, 'menu_pdf_url', p.menu_pdf_url, 'tags', coalesce(p.tags, '{}'),
    'website', p.website,
    'phone', p.phone,
    'order_wolt_url', p.order_wolt_url,
    'order_pyszne_url', p.order_pyszne_url,
    'order_glovo_url', p.order_glovo_url,
    'order_uber_url', p.order_uber_url,
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

drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text);
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text, text);
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text, text, text, text, text, text, text);

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
  p_website text default null,
  p_phone text default null,
  p_order_wolt_url text default null,
  p_order_pyszne_url text default null,
  p_order_glovo_url text default null,
  p_order_uber_url text default null
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
  v_phone text;
  v_wolt text;
  v_pyszne text;
  v_glovo text;
  v_uber text;
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
  if p_phone is not null then
    v_phone := nullif(trim(p_phone), '');
    if v_phone is not null and char_length(v_phone) > 40 then raise exception 'phone_too_long'; end if;
  end if;
  if p_order_wolt_url is not null then
    v_wolt := nullif(trim(p_order_wolt_url), '');
    if v_wolt is not null and char_length(v_wolt) > 500 then raise exception 'order_url_too_long'; end if;
  end if;
  if p_order_pyszne_url is not null then
    v_pyszne := nullif(trim(p_order_pyszne_url), '');
    if v_pyszne is not null and char_length(v_pyszne) > 500 then raise exception 'order_url_too_long'; end if;
  end if;
  if p_order_glovo_url is not null then
    v_glovo := nullif(trim(p_order_glovo_url), '');
    if v_glovo is not null and char_length(v_glovo) > 500 then raise exception 'order_url_too_long'; end if;
  end if;
  if p_order_uber_url is not null then
    v_uber := nullif(trim(p_order_uber_url), '');
    if v_uber is not null and char_length(v_uber) > 500 then raise exception 'order_url_too_long'; end if;
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
  if p_phone is not null and v_phone is distinct from old.phone then ch := ch || jsonb_build_object('phone', true); end if;
  if p_order_wolt_url is not null and v_wolt is distinct from old.order_wolt_url then ch := ch || jsonb_build_object('order_wolt_url', true); end if;
  if p_order_pyszne_url is not null and v_pyszne is distinct from old.order_pyszne_url then ch := ch || jsonb_build_object('order_pyszne_url', true); end if;
  if p_order_glovo_url is not null and v_glovo is distinct from old.order_glovo_url then ch := ch || jsonb_build_object('order_glovo_url', true); end if;
  if p_order_uber_url is not null and v_uber is distinct from old.order_uber_url then ch := ch || jsonb_build_object('order_uber_url', true); end if;
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
    phone = case when p_phone is not null then v_phone else phone end,
    order_wolt_url = case when p_order_wolt_url is not null then v_wolt else order_wolt_url end,
    order_pyszne_url = case when p_order_pyszne_url is not null then v_pyszne else order_pyszne_url end,
    order_glovo_url = case when p_order_glovo_url is not null then v_glovo else order_glovo_url end,
    order_uber_url = case when p_order_uber_url is not null then v_uber else order_uber_url end,
    updated_at = now()
  where id = p_pin;

  begin
    insert into public.pin_edits (pin_id, editor_id, changes) values (p_pin, v, ch);
  exception when others then null;
  end;

  return jsonb_build_object('updated', true, 'pin_id', p_pin, 'changes', ch);
end $$;

grant execute on function public.update_pin(
  uuid, text, text, text, text, text, int, int, text, text, text[], text, text, text, text, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

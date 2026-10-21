-- =====================================================================
-- 029: FIX edycji pinu (brak pins.updated_at) + połowa XP misji
--      + powiadomienie przy zdobyciu karty
-- =====================================================================

alter table public.pins add column if not exists updated_at timestamptz not null default now();

-- Bezpieczny update_pin (bez crasha na updated_at)
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text);
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text);

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
  p_menu_pdf_url text default null
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
begin
  select * into old from public.pins where id = p_pin and status = 'published' for update;
  if old.id is null then raise exception 'pin_not_found'; end if;
  if p_price_min is not null and p_price_min < 0 then raise exception 'invalid_price'; end if;
  if p_price_max is not null and p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_min is not null and p_price_max is not null and p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  if p_menu_text is not null and char_length(p_menu_text) > 8000 then raise exception 'menu_too_long'; end if;
  if p_tags is not null and cardinality(p_tags) > 12 then raise exception 'too_many_tags'; end if;

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
    updated_at = now()
  where id = p_pin;

  begin
    insert into public.pin_edits (pin_id, editor_id, changes) values (p_pin, v, ch);
  exception when others then null;
  end;

  return jsonb_build_object('updated', true, 'pin_id', p_pin, 'changes', ch);
end $$;
grant execute on function public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text) to authenticated;

-- Połowa XP / PD misji (ceil, min 1 jeśli było > 0)
update public.mission_definitions
set reward_xp = greatest(1, (reward_xp + 1) / 2)
where reward_xp > 0;

update public.mission_definitions
set repeat_reward_xp = case
  when repeat_reward_xp is null then null
  when repeat_reward_xp <= 0 then 0
  else greatest(1, (repeat_reward_xp + 1) / 2)
end
where repeat_reward_xp is not null and repeat_reward_xp > 0;

-- Powiadomienie przy każdej zdobytej karcie
create or replace function public._grant_card(p_user uuid, p_card uuid, p_kind text, p_rarity text, p_source_type text, p_source_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_card uuid := p_card; v_uc uuid; v_name text; v_rarity text;
begin
  if v_card is null then
    select id into v_card from public.card_definitions
     where status = 'published' and (p_kind is null or kind = p_kind) and rarity = coalesce(p_rarity, 'common')
     order by random() limit 1;
    if v_card is null then
      select id into v_card from public.card_definitions where status = 'published' and (p_kind is null or kind = p_kind) order by random() limit 1;
    end if;
  end if;
  if v_card is null then return null; end if;
  insert into public.user_cards (user_id, card_id, source_type, source_id) values (p_user, v_card, p_source_type, p_source_id) returning id into v_uc;
  insert into public.card_usage_history (user_card_id, card_id, user_id, action, source_id) values (v_uc, v_card, p_user, 'granted', p_source_id);
  select name, rarity into v_name, v_rarity from public.card_definitions where id = v_card;
  begin
    perform public._notify(
      p_user,
      'reward_card',
      'Nowa karta: ' || coalesce(v_name, 'Yummeet'),
      'Zdobyłeś(aś) kartę' || case when v_rarity is not null then ' (' || v_rarity || ')' else '' end || '. Otwórz Księgę kart.',
      jsonb_build_object('card_id', v_card, 'user_card_id', v_uc, 'source_type', p_source_type),
      'card_grant:' || v_uc::text
    );
  exception when others then null;
  end;
  return v_uc;
end $$;

notify pgrst, 'reload schema';

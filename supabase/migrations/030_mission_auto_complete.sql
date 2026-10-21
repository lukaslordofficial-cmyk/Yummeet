-- =====================================================================
-- 030: Auto-zaliczanie misji bez „Przyjmij”
-- Wykonanie akcji (pin / stół+check-in / oferta / tip) → dopasowanie misji
-- → nagrody (XP, karty). Pin: najpierw peer review (1× OK).
-- =====================================================================

alter table public.mission_definitions add column if not exists verify_kind text;
alter table public.mission_definitions add column if not exists verify_meta jsonb not null default '{}'::jsonb;

-- Dowód „pin” w evidence (auto / peer)
do $$ begin
  alter table public.mission_evidence drop constraint if exists mission_evidence_kind_check;
exception when others then null;
end $$;
alter table public.mission_evidence
  add constraint mission_evidence_kind_check
  check (kind in ('text','photo_url','code','location','pin'));

-- expires_at może być null (misje bez limitu)
alter table public.user_missions alter column expires_at drop not null;
alter table public.user_missions add column if not exists community_open boolean not null default false;
alter table public.user_missions add column if not exists community_approvals int not null default 0;
alter table public.user_missions add column if not exists review_deadline timestamptz;
alter table public.user_missions add column if not exists linked_ref_type text;
alter table public.user_missions add column if not exists linked_ref_id uuid;

create table if not exists public.mission_community_votes (
  user_mission_id uuid not null references public.user_missions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  approved boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_mission_id, reviewer_id)
);

-- --- Reguły auto-match w verify_meta.auto ---
-- any_pin: każdy nowy pin
update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'any_pin', true)
) where code in (
  'det_ghost_venue','det_unknown_cuisine','det_off_radar','det_blank_spot',
  'det_receipt','det_field_report','det_best_dessert'
);

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'cuisine_any', jsonb_build_array('bakery','bakery_only'),
    'tags_any', jsonb_build_array('piekarnia','Piekarnia','bakery'))
) where code in ('det_baker', 'gua_bakery_bell');

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'price_max_lte', 25)
) where code in ('det_two_tens', 'det_full_belly');

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('tgtg','TGTG','paczki','Too Good To Go'))
) where code = 'det_tgtg';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('happy-hour','happy_hour','Happy-Hour','lunch'))
) where code = 'det_happy_hour';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('wege','vege','vegan','wegetariańskie','wegańskie'))
) where code = 'det_green_trail';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('bezglutenowe','gluten-free','alergie'))
) where code = 'det_no_traps';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('nocne','night','po 22'))
) where code = 'det_after_hours';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('grupowe','grupa'))
) where code = 'det_group_table';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'tags_any', jsonb_build_array('śniadania','sniadania','breakfast'))
) where code = 'det_breakfast';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'pin_created', 'cuisine_any', jsonb_build_array('bakery','bakery_only','cafe'),
    'tags_any', jsonb_build_array('cukiernia','deser','przeceny'))
) where code in ('gua_saved_pastry', 'gua_last_chance', 'gua_last_portion', 'gua_second_life_map',
  'gua_course_fridge', 'gua_still_alive', 'gua_red_labels', 'gua_greengrocer', 'gua_restaurant_ally');

-- Oferty / tipy / stoły
update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'food_offer', 'offer_kinds', coalesce(verify_meta->'offer_kinds', '["exchange"]'::jsonb))
) where verify_kind = 'food_offer';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'food_tip')
) where verify_kind = 'food_tip';

update public.mission_definitions set verify_meta = coalesce(verify_meta, '{}'::jsonb) || jsonb_build_object(
  'auto', jsonb_build_object('on', 'event_ready')
) where verify_kind = 'event_checkin';

-- =====================================================================
-- Czy wolno auto-otworzyć / nagrodzić misję
-- =====================================================================
create or replace function public._mission_eligible_auto(p_user uuid, p_mission uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m record; v_done int; v_last timestamptz;
begin
  select * into m from public.mission_definitions where id = p_mission and is_active;
  if m.id is null then return false; end if;
  if exists (
    select 1 from public.user_missions
    where user_id = p_user and mission_id = p_mission
      and status in ('accepted','in_progress','pending_confirmation')
  ) then return true; end if; -- już otwarta — można domknąć
  select count(*), max(created_at) into v_done, v_last
  from public.mission_completions where user_id = p_user and mission_id = p_mission;
  -- auto: tylko pierwsze ukończenie (bez farmienia powtórek)
  if v_done > 0 then return false; end if;
  if m.repeat_limit > 0 and v_done >= m.repeat_limit then return false; end if;
  if v_last is not null and m.cooldown_hours > 0
     and v_last > now() - make_interval(hours => m.cooldown_hours) then return false; end if;
  return true;
end $$;

-- Otwórz misję od razu w in_progress (bez klikania Przyjmij)
create or replace function public._mission_ensure_in_progress(p_user uuid, p_mission uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_um uuid; v_done int;
begin
  select id into v_um from public.user_missions
   where user_id = p_user and mission_id = p_mission
     and status in ('accepted','in_progress','pending_confirmation')
   order by created_at desc limit 1;
  if v_um is not null then
    update public.user_missions set
      status = case when status = 'accepted' then 'in_progress' else status end,
      started_at = coalesce(started_at, now())
    where id = v_um and status = 'accepted';
    return v_um;
  end if;
  if not public._mission_eligible_auto(p_user, p_mission) then return null; end if;
  select count(*) into v_done from public.mission_completions where user_id = p_user and mission_id = p_mission;
  insert into public.user_missions (user_id, mission_id, status, attempt_no, accepted_at, started_at, expires_at)
  values (p_user, p_mission, 'in_progress', v_done + 1, now(), now(), null)
  returning id into v_um;
  begin
    insert into public.mission_participants (user_mission_id, user_id, role)
    values (v_um, p_user, 'participant') on conflict do nothing;
  exception when others then null;
  end;
  return v_um;
end $$;

-- Czy pin pasuje do reguły auto
create or replace function public._mission_pin_matches(p_meta jsonb, p_cuisine text, p_tags text[], p_price_min int, p_price_max int)
returns boolean
language plpgsql immutable as $$
declare auto jsonb := p_meta->'auto';
  v_cuisines jsonb; v_tags jsonb; t text; hit boolean := false;
begin
  if auto is null or coalesce(auto->>'on','') <> 'pin_created' then return false; end if;
  if coalesce((auto->>'any_pin')::boolean, false) then return true; end if;

  v_cuisines := auto->'cuisine_any';
  if v_cuisines is not null and jsonb_typeof(v_cuisines) = 'array' and jsonb_array_length(v_cuisines) > 0 then
    if p_cuisine is not null and v_cuisines ? p_cuisine then hit := true; end if;
  end if;

  v_tags := auto->'tags_any';
  if v_tags is not null and jsonb_typeof(v_tags) = 'array' and p_tags is not null then
    foreach t in array p_tags loop
      if v_tags ? t then hit := true; end if;
    end loop;
  end if;

  if auto ? 'price_max_lte' then
    if coalesce(p_price_max, p_price_min) is not null
       and coalesce(p_price_max, p_price_min) <= (auto->>'price_max_lte')::int then
      hit := true;
    else
      -- jeśli jedynym kryterium jest cena i nie pasuje
      if v_cuisines is null and v_tags is null then return false; end if;
    end if;
  end if;

  -- jeśli są cuisine/tags — wystarczy OR hit; jeśli tylko price — już obsłużone
  if (v_cuisines is not null and jsonb_array_length(v_cuisines) > 0)
     or (v_tags is not null and jsonb_array_length(v_tags) > 0) then
    return hit;
  end if;
  if auto ? 'price_max_lte' then
    return coalesce(p_price_max, p_price_min) is not null
       and coalesce(p_price_max, p_price_min) <= (auto->>'price_max_lte')::int;
  end if;
  return false;
end $$;

-- =====================================================================
-- Auto z pinu
-- =====================================================================
create or replace function public._mission_auto_from_pin(p_user uuid, p_pin uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare m record; pin record; v_um uuid; v_kind text;
begin
  select * into pin from public.pins where id = p_pin;
  if pin.id is null then return; end if;

  for m in
    select * from public.mission_definitions
    where is_active
      and coalesce(verify_kind, '') in ('pin_peer', 'peer_pool')
      and (verify_meta->'auto'->>'on') = 'pin_created'
  loop
    if not public._mission_pin_matches(m.verify_meta, pin.cuisine, pin.tags, pin.price_min, pin.price_max) then
      continue;
    end if;
    if not public._mission_eligible_auto(p_user, m.id) then continue; end if;

    v_um := public._mission_ensure_in_progress(p_user, m.id);
    if v_um is null then continue; end if;

    update public.user_missions set linked_ref_type = 'pin', linked_ref_id = p_pin where id = v_um;
    v_kind := coalesce(m.verify_kind, 'pin_peer');

    if v_kind in ('pin_peer', 'peer_pool') then
      -- peer review (1 akceptacja) — potem nagrody
      begin
        -- nie otwieraj ponownie jeśli już pending
        if exists (select 1 from public.user_missions where id = v_um and status = 'pending_confirmation') then
          continue;
        end if;
        perform public._mission_open_community_review(
          v_um, 'pin',
          'pin:' || p_pin::text || E'\nAuto: dodano „' || coalesce(pin.title, 'lokal') || '”'
            || E'\nMisja: ' || m.name
            || E'\nSprawdź, czy lokal naprawdę jest w tym miejscu.'
        );
      exception when others then null;
      end;
    else
      begin
        perform public._complete_user_mission(v_um, null);
      exception when others then null;
      end;
    end if;
  end loop;
end $$;

-- Stary hook → nowy
create or replace function public._mission_on_pin_created(p_user uuid, p_pin uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._mission_auto_from_pin(p_user, p_pin);
end $$;

-- Fallback: jeśli 025 nie wgrało open_community_review
create or replace function public._mission_open_community_review(p_um uuid, p_kind text, p_content text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into public.mission_evidence (user_mission_id, user_id, kind, content)
  select p_um, um.user_id, case when p_kind in ('text','photo_url','code','location','pin') then p_kind else 'text' end, p_content
  from public.user_missions um where um.id = p_um;

  update public.user_missions set
    status = 'pending_confirmation',
    submitted_at = now(),
    review_deadline = now() + interval '24 hours',
    community_open = true,
    community_approvals = 0,
    confirmer_id = null
  where id = p_um;

  begin
    delete from public.mission_community_votes where user_mission_id = p_um;
  exception when others then null;
  end;
  begin
    perform public._mission_notify_peer_pool(p_um);
  exception when others then null;
  end;
  return jsonb_build_object(
    'pending_confirmation', true,
    'community_review', true,
    'approvals_needed', 1,
    'review_deadline', now() + interval '24 hours'
  );
end $$;

-- =====================================================================
-- Auto z oferty / tipa
-- =====================================================================
create or replace function public._mission_auto_from_food(p_user uuid, p_ref_type text, p_ref_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public as $$
declare m record; v_um uuid; auto jsonb; kinds jsonb;
begin
  for m in
    select * from public.mission_definitions
    where is_active
      and (
        (p_ref_type = 'food_offer' and verify_kind = 'food_offer')
        or (p_ref_type = 'cooking_tip' and verify_kind = 'food_tip')
      )
  loop
    auto := m.verify_meta->'auto';
    if p_ref_type = 'food_offer' then
      if coalesce(auto->>'on', 'food_offer') <> 'food_offer' and coalesce(auto->>'on','') <> '' then continue; end if;
      kinds := coalesce(auto->'offer_kinds', m.verify_meta->'offer_kinds', '[]'::jsonb);
      if kinds <> '[]'::jsonb and not (kinds ? p_kind) then continue; end if;
    end if;

    if not public._mission_eligible_auto(p_user, m.id) then continue; end if;
    v_um := public._mission_ensure_in_progress(p_user, m.id);
    if v_um is null then continue; end if;

    update public.user_missions set
      linked_ref_type = p_ref_type,
      linked_ref_id = p_ref_id
    where id = v_um;

    begin
      perform public._complete_user_mission(v_um, null);
    exception when others then null;
    end;
  end loop;
end $$;

-- Podmień stare food hooks
create or replace function public._mission_try_complete_food(p_user uuid, p_ref_type text, p_ref_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._mission_auto_from_food(p_user, p_ref_type, p_ref_id, p_kind);
end $$;

-- Triggery (idempotent)
do $hook$
begin
  create or replace function public._trg_food_offer_mission()
  returns trigger language plpgsql security definer set search_path = public as $f$
  begin
    perform public._mission_auto_from_food(new.owner_id, 'food_offer', new.id, new.offer_kind);
    return new;
  end $f$;
  drop trigger if exists trg_food_offer_mission on public.food_offers;
  create trigger trg_food_offer_mission
    after insert on public.food_offers
    for each row execute function public._trg_food_offer_mission();

  create or replace function public._trg_cooking_tip_mission()
  returns trigger language plpgsql security definer set search_path = public as $f$
  begin
    perform public._mission_auto_from_food(new.author_id, 'cooking_tip', new.id, coalesce(new.tip_kind, 'recipe'));
    return new;
  end $f$;
  drop trigger if exists trg_cooking_tip_mission on public.cooking_tips;
  create trigger trg_cooking_tip_mission
    after insert on public.cooking_tips
    for each row execute function public._trg_cooking_tip_mission();
exception when others then
  raise notice 'food/tip triggers: %', sqlerrm;
end $hook$;

-- =====================================================================
-- Auto ze stołu (organizator) — po check-in / join
-- =====================================================================
create or replace function public._mission_try_complete_event(p_event uuid, p_organizer uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare um uuid; m record; v_joined int; v_checked int; v_min int;
begin
  select count(*) into v_joined from public.event_participants
   where event_id = p_event and user_id <> p_organizer and status in ('joined','checked_in','attended');
  select count(*) into v_checked from public.event_participants
   where event_id = p_event and user_id <> p_organizer and status in ('checked_in','attended');

  for m in
    select * from public.mission_definitions
    where is_active and coalesce(verify_kind, '') = 'event_checkin'
  loop
    v_min := coalesce((m.verify_meta->>'min_participants')::int, 1);
    if v_joined < v_min then continue; end if;
    if coalesce((m.verify_meta->>'require_checkin')::boolean, true) and v_checked < 1 then continue; end if;
    if not public._mission_eligible_auto(p_organizer, m.id) then continue; end if;

    um := public._mission_ensure_in_progress(p_organizer, m.id);
    if um is null then continue; end if;
    update public.user_missions set linked_ref_type = 'event', linked_ref_id = p_event where id = um;
    begin
      perform public._complete_user_mission(um, null);
    exception when others then null;
    end;
  end loop;
end $$;

-- create_pin: zachowaj wymóg cen z 028 + auto misje
create or replace function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null, p_address text default null,
  p_price_min int default null, p_price_max int default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_level smallint;
begin
  if p_price_min is null or p_price_max is null then raise exception 'price_range_required'; end if;
  if p_price_min < 0 or p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  if exists (
    select 1 from public.pins
    where status = 'published'
      and st_dwithin(coords, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 40)
  ) then raise exception 'pin_already_exists'; end if;

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
    values (v_id, v, jsonb_build_object('created', true, 'title', trim(p_title)));
  exception when others then null;
  end;

  begin perform public._mission_auto_from_pin(v, v_id); exception when others then null; end;
  return v_id;
end $$;
grant execute on function public.create_pin(text, float8, float8, text, text, text, smallint, text, text, int, int) to authenticated;

notify pgrst, 'reload schema';

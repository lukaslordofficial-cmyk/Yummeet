-- =====================================================================
-- 017: 3 sloty zdjęć (dania / misje) zamiast limitu miesięcznego
-- Zwolnienie slotu + usunięcie ze Storage 48 h po zakończeniu oferty/misji
-- Naprawa crona (bez zagnieżdżonych $$)
-- =====================================================================

create table if not exists public.photo_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('food_offer', 'cooking_tip', 'mission_evidence', 'event_photo')),
  ref_id uuid,
  photo_url text not null,
  release_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists photo_slots_user_active_idx
  on public.photo_slots (user_id) where released_at is null;
create index if not exists photo_slots_release_idx
  on public.photo_slots (release_at) where released_at is null and release_at is not null;

alter table public.photo_slots enable row level security;
drop policy if exists photo_slots_own on public.photo_slots;
create policy photo_slots_own on public.photo_slots for select to authenticated using (user_id = auth.uid());
grant select on public.photo_slots to authenticated;

create or replace function public._storage_path_from_url(p_url text, p_bucket text default 'pin-photos')
returns text
language sql immutable as $$
  select nullif(substring(p_url from '/storage/v1/object/public/' || p_bucket || '/(.+)$'), '');
$$;

create or replace function public._delete_storage_url(p_url text)
returns boolean
language plpgsql security definer set search_path = public, storage as $$
declare v_path text;
begin
  v_path := public._storage_path_from_url(p_url, 'pin-photos');
  if v_path is null then return false; end if;
  begin
    delete from storage.objects where bucket_id = 'pin-photos' and name = v_path;
    return true;
  exception when others then
    return false;
  end;
end $$;

-- Status slotów (max 3 aktywne)
create or replace function public.photo_slot_status(p_limit int default 3)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  n int := 0;
  lim int := least(greatest(coalesce(p_limit, 3), 1), 20);
begin
  -- Przy okazji zwolnij to, co już powinno spaść
  perform public.cleanup_photo_slots();
  select count(*)::int into n from public.photo_slots
   where user_id = v and released_at is null;
  return jsonb_build_object(
    'used', n,
    'limit', lim,
    'remaining', greatest(lim - n, 0),
    'model', 'slots'
  );
end $$;
grant execute on function public.photo_slot_status(int) to authenticated;

-- Kompatybilność ze starym klientem
create or replace function public.photo_quota_status(p_limit int default 3)
returns jsonb
language sql security definer set search_path = public as $$
  select public.photo_slot_status(coalesce(p_limit, 3));
$$;
grant execute on function public.photo_quota_status(int) to authenticated;

create or replace function public.claim_photo_slot(p_kind text, p_photo_url text, p_ref_id uuid default null, p_limit int default 3)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  n int;
  lim int := least(greatest(coalesce(p_limit, 3), 1), 20);
  v_id uuid;
begin
  if p_kind not in ('food_offer', 'cooking_tip', 'mission_evidence', 'event_photo') then
    raise exception 'invalid_photo_kind';
  end if;
  if p_photo_url is null or char_length(trim(p_photo_url)) < 8 then
    raise exception 'invalid_photo';
  end if;
  perform public.cleanup_photo_slots();
  select count(*)::int into n from public.photo_slots where user_id = v and released_at is null;
  if n >= lim then raise exception 'photo_slots_full'; end if;

  insert into public.photo_slots (user_id, kind, ref_id, photo_url)
  values (v, p_kind, p_ref_id, trim(p_photo_url))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.claim_photo_slot(text, text, uuid, int) to authenticated;

-- Stary claim → 3 sloty (bez limitu miesięcznego)
create or replace function public.claim_photo_upload(p_limit int default 3)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb;
begin
  st := public.photo_slot_status(coalesce(p_limit, 3));
  if (st->>'remaining')::int <= 0 then raise exception 'photo_slots_full'; end if;
  return st;
end $$;
grant execute on function public.claim_photo_upload(int) to authenticated;

create or replace function public.schedule_photo_slot_release(p_kind text, p_ref_id uuid, p_after interval default interval '48 hours')
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.photo_slots
     set release_at = least(coalesce(release_at, now() + p_after), now() + p_after)
   where kind = p_kind
     and ref_id = p_ref_id
     and released_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.cleanup_photo_slots()
returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare
  r record;
  n_slots int := 0;
  n_files int := 0;
  n_offers int := 0;
begin
  -- Oferty wiszące > 7 dni → expired (potem 48 h na zdjęcie)
  update public.food_offers
     set status = 'expired', updated_at = now()
   where status in ('available', 'reserved')
     and created_at < now() - interval '7 days';
  get diagnostics n_offers = row_count;

  -- Zaplanuj zwolnienie slotów dla terminalnych ofert (jeśli jeszcze nie)
  update public.photo_slots s
     set release_at = coalesce(s.release_at, o.updated_at + interval '48 hours')
    from public.food_offers o
   where s.kind = 'food_offer' and s.ref_id = o.id and s.released_at is null
     and o.status in ('handed_over', 'cancelled', 'expired')
     and s.release_at is null;

  -- Misje zakończone / wygasłe
  update public.photo_slots s
     set release_at = coalesce(s.release_at, coalesce(um.completed_at, um.submitted_at, um.created_at) + interval '48 hours')
    from public.user_missions um
   where s.kind = 'mission_evidence' and s.ref_id = um.id and s.released_at is null
     and um.status in ('completed', 'expired', 'cancelled', 'rejected')
     and s.release_at is null;

  -- Inspiracje / zdjęcia stołów: max 7 dni trzymania, potem release
  update public.photo_slots
     set release_at = coalesce(release_at, created_at + interval '7 days')
   where kind in ('cooking_tip', 'event_photo')
     and released_at is null and release_at is null;

  for r in
    select * from public.photo_slots
     where released_at is null
       and release_at is not null
       and release_at <= now()
  loop
    if public._delete_storage_url(r.photo_url) then n_files := n_files + 1; end if;

    if r.kind = 'food_offer' and r.ref_id is not null then
      update public.food_offers set photo_url = null where id = r.ref_id and photo_url = r.photo_url;
    elsif r.kind = 'cooking_tip' and r.ref_id is not null then
      update public.cooking_tips set photo_url = null where id = r.ref_id and photo_url = r.photo_url;
    elsif r.kind = 'event_photo' and r.ref_id is not null then
      delete from public.event_photos where id = r.ref_id;
    end if;
    -- mission_evidence: content w mission_evidence zostaje jako tekst URL, plik znika ze Storage

    update public.photo_slots set released_at = now() where id = r.id;
    n_slots := n_slots + 1;
  end loop;

  return jsonb_build_object(
    'slots_released', n_slots,
    'files_deleted', n_files,
    'offers_expired', n_offers
  );
end $$;
grant execute on function public.cleanup_photo_slots() to authenticated;
grant execute on function public.cleanup_photo_slots() to service_role;

-- Trigger: przy zmianie statusu oferty → zaplanuj zwolnienie za 48 h
create or replace function public._food_offer_photo_release_trg()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('handed_over', 'cancelled', 'expired')
     and (old.status is distinct from new.status) then
    update public.photo_slots
       set release_at = coalesce(release_at, now() + interval '48 hours')
     where kind = 'food_offer' and ref_id = new.id and released_at is null;
  end if;
  return new;
end $$;
drop trigger if exists food_offer_photo_release on public.food_offers;
create trigger food_offer_photo_release
  after update of status on public.food_offers
  for each row execute function public._food_offer_photo_release_trg();

-- publish_food_offer: zajmij slot przy zdjęciu
create or replace function public.publish_food_offer(
  p_kind text,
  p_title text,
  p_description text default null,
  p_photo_url text default null,
  p_allergens text[] default '{}',
  p_portions int default 1,
  p_city text default null,
  p_street text default null,
  p_place_detail text default null,
  p_lat float8 default null,
  p_lng float8 default null,
  p_storage text default null,
  p_prepared_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._uid();
  v_id uuid;
  v_pt geography;
  r record;
  v_place text;
  v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
begin
  if p_kind not in ('giveaway','exchange','signature','order') then raise exception 'invalid_kind'; end if;
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if p_portions is null or p_portions < 1 or p_portions > 200 then raise exception 'invalid_portions'; end if;
  if p_allergens is null or cardinality(p_allergens) = 0 then raise exception 'allergens_required'; end if;

  if v_photo is not null then
    perform public.claim_photo_slot('food_offer', v_photo, null, 3);
  end if;

  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_place := nullif(trim(concat_ws(', ', nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''))), '');
  perform public.touch_user_geo(p_lat, p_lng);

  insert into public.food_offers (
    owner_id, offer_kind, title, description, photo_url, allergens, portions, portions_left,
    city, street, place_detail, pickup_place_public, place_lat, place_lng, coords,
    storage_conditions, prepared_at, status
  ) values (
    v, p_kind, trim(p_title), nullif(trim(coalesce(p_description,'')),''), v_photo,
    p_allergens, p_portions, p_portions,
    nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''),
    v_place, p_lat, p_lng, v_pt, nullif(trim(coalesce(p_storage,'')),''), p_prepared_at, 'available'
  ) returning id into v_id;

  if v_photo is not null then
    update public.photo_slots
       set ref_id = v_id
     where user_id = v and kind = 'food_offer' and photo_url = v_photo and ref_id is null and released_at is null;
  end if;

  for r in
    select g.user_id from public.user_geo_cache g
    where g.user_id <> v and g.updated_at > now() - interval '30 days' and st_dwithin(g.coords, v_pt, 20000)
    order by g.updated_at desc limit 100
  loop
    perform public._notify(r.user_id, 'food_nearby', 'Nowa oferta jedzenia w okolicy', trim(p_title),
      jsonb_build_object('offer_id', v_id, 'kind', p_kind), 'food:' || v_id || ':' || r.user_id);
  end loop;
  return v_id;
end $$;
grant execute on function public.publish_food_offer(text, text, text, text, text[], int, text, text, text, float8, float8, text, timestamptz) to authenticated;

create or replace function public.publish_cooking_tip(
  p_title text, p_body text, p_photo_url text default null, p_lat float8 default null, p_lng float8 default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid; v_pt geography; r record; v_photo text := nullif(trim(coalesce(p_photo_url,'')),'');
begin
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_body is null or char_length(trim(p_body)) < 10 then raise exception 'invalid_body'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if v_photo is not null then
    perform public.claim_photo_slot('cooking_tip', v_photo, null, 3);
  end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  perform public.touch_user_geo(p_lat, p_lng);
  insert into public.cooking_tips (author_id, title, body, photo_url, place_lat, place_lng, coords)
  values (v, trim(p_title), trim(p_body), v_photo, p_lat, p_lng, v_pt)
  returning id into v_id;
  if v_photo is not null then
    update public.photo_slots set ref_id = v_id, release_at = coalesce(release_at, now() + interval '7 days')
     where user_id = v and kind = 'cooking_tip' and photo_url = v_photo and ref_id is null and released_at is null;
  end if;
  for r in
    select g.user_id from public.user_geo_cache g
    where g.user_id <> v and g.updated_at > now() - interval '30 days' and st_dwithin(g.coords, v_pt, 20000)
    order by g.updated_at desc limit 100
  loop
    perform public._notify(r.user_id, 'tip_nearby', 'Nowa inspiracja kulinarna w okolicy', trim(p_title),
      jsonb_build_object('tip_id', v_id), 'tip:' || v_id || ':' || r.user_id);
  end loop;
  return v_id;
end $$;
grant execute on function public.publish_cooking_tip(text, text, text, float8, float8) to authenticated;

create or replace function public.add_event_photo(p_event uuid, p_photo_url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_photo text := nullif(trim(coalesce(p_photo_url,'')),'');
begin
  if v_photo is null then raise exception 'invalid_photo'; end if;
  if not (
    exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v)
    or public.is_event_member(p_event)
  ) then raise exception 'not_joined'; end if;
  perform public.claim_photo_slot('event_photo', v_photo, null, 3);
  insert into public.event_photos (event_id, uploader_id, photo_url)
  values (p_event, v, v_photo) returning id into v_id;
  update public.photo_slots
     set ref_id = v_id, release_at = coalesce(release_at, now() + interval '7 days')
   where user_id = v and kind = 'event_photo' and photo_url = v_photo and ref_id is null and released_at is null;
  return v_id;
end $$;
grant execute on function public.add_event_photo(uuid, text) to authenticated;

-- mission_submit: slot przy photo_url; zwolnienie przy complete
create or replace function public.mission_submit(p_um uuid, p_kind text, p_content text, p_confirmer uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); um record; m record; v_code text; v_lat float8; v_lng float8;
  v_url text; v_res jsonb;
begin
  select * into um from public.user_missions where id = p_um and user_id = v for update;
  if um.id is null then raise exception 'not_found'; end if;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
  if um.expires_at is not null and um.expires_at < now() then
    update public.user_missions set status = 'expired' where id = p_um;
    perform public.schedule_photo_slot_release('mission_evidence', p_um, interval '48 hours');
    return jsonb_build_object('expired', true);
  end if;
  select * into m from public.mission_definitions where id = um.mission_id;
  if p_content is null or char_length(p_content) > 2000 then raise exception 'invalid_evidence'; end if;

  if p_kind = 'photo_url' then
    v_url := nullif(substring(trim(p_content) from '(https?://\S+)\s*$'), '');
    if v_url is null then v_url := nullif(trim(p_content), ''); end if;
    if v_url is not null and v_url ~ '^https?://' then
      perform public.claim_photo_slot('mission_evidence', v_url, p_um, 3);
    end if;
  end if;

  insert into public.mission_evidence (user_mission_id, user_id, kind, content) values (p_um, v, p_kind, p_content);

  if m.confirmation_method = 'self' then
    v_res := public._complete_user_mission(p_um, null);
  elsif m.confirmation_method = 'code' then
    select confirmation_code into v_code from public.mission_secrets where mission_id = m.id;
    if v_code is null or upper(trim(p_content)) <> upper(v_code) then raise exception 'invalid_code'; end if;
    v_res := public._complete_user_mission(p_um, null);
  elsif m.confirmation_method = 'location' then
    v_lat := split_part(p_content, ',', 1)::float8; v_lng := split_part(p_content, ',', 2)::float8;
    if m.pin_id is null or not exists (select 1 from public.pins where id = m.pin_id and st_dwithin(coords, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 200)) then
      raise exception 'too_far_from_place';
    end if;
    v_res := public._complete_user_mission(p_um, null);
  else
    if p_confirmer is null or p_confirmer = v then raise exception 'confirmer_required'; end if;
    if public.is_blocked(v, p_confirmer) then raise exception 'blocked'; end if;
    update public.user_missions set status = 'pending_confirmation', submitted_at = now(), confirmer_id = p_confirmer where id = p_um;
    insert into public.mission_participants (user_mission_id, user_id, role) values (p_um, p_confirmer, 'confirmer') on conflict do nothing;
    perform public._notify(p_confirmer, 'mission_confirm', 'Prośba o potwierdzenie misji', m.name, jsonb_build_object('user_mission_id', p_um), 'mission_confirm:' || p_um);
    return jsonb_build_object('pending_confirmation', true);
  end if;

  if (v_res->>'completed')::boolean is true then
    perform public.schedule_photo_slot_release('mission_evidence', p_um, interval '48 hours');
  end if;
  return v_res;
end $$;
grant execute on function public.mission_submit(uuid, text, text, uuid) to authenticated;

-- Patch _complete_user_mission: zawsze planuj zwolnienie slotu zdjęcia
create or replace function public._complete_user_mission(p_um uuid, p_confirmer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare um record; m record; v_first boolean; v_xp int; v_cards jsonb := '[]'; r record; i int; v_uc uuid; v_cid uuid; v_main text;
begin
  select * into um from public.user_missions where id = p_um for update;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status not in ('in_progress','pending_confirmation') then raise exception 'invalid_transition'; end if;
  select * into m from public.mission_definitions where id = um.mission_id;
  v_first := not exists (select 1 from public.mission_completions where user_id = um.user_id and mission_id = um.mission_id);
  v_xp := case when v_first then m.reward_xp else m.repeat_reward_xp end;
  for r in select * from public.card_rewards where mission_id = m.id and (v_first or not first_time_only) loop
    for i in 1..r.count loop
      v_uc := public._grant_card(um.user_id, r.card_id, r.kind, r.rarity, 'mission', um.id);
      if v_uc is not null then
        select card_id into v_cid from public.user_cards where id = v_uc;
        v_cards := v_cards || jsonb_build_object('user_card_id', v_uc, 'card_id', v_cid);
      end if;
    end loop;
  end loop;
  insert into public.mission_completions (user_mission_id, user_id, mission_id, is_first, xp, cards)
  values (um.id, um.user_id, um.mission_id, v_first, v_xp, v_cards);
  update public.user_missions set status = 'completed', completed_at = now(), confirmer_id = coalesce(p_confirmer, confirmer_id) where id = um.id;
  perform public._award_xp(um.user_id, v_xp, 'mission', um.id, m.name);
  if m.specialization_code is not null and v_xp > 0 then
    perform public._award_spec_pd(um.user_id, m.specialization_code, v_xp, um.id);
  end if;
  v_main := public.compute_main_specialization(um.user_id);
  if v_main is not null and v_main <> '__versatile__' then
    update public.profiles set primary_specialization = v_main, updated_at = now() where id = um.user_id;
  elsif v_main is null then
    update public.profiles set primary_specialization = null, updated_at = now() where id = um.user_id;
  end if;
  perform public._evaluate_badges(um.user_id);
  perform public.schedule_photo_slot_release('mission_evidence', um.id, interval '48 hours');
  perform public._notify(um.user_id, 'reward_mission', 'Misja ukończona: ' || m.name, '+' || v_xp || ' XP / PD, kart: ' || jsonb_array_length(v_cards),
                         jsonb_build_object('user_mission_id', um.id), 'mission_done:' || um.id);
  return jsonb_build_object('completed', true, 'xp', v_xp, 'pd', v_xp, 'specialization', m.specialization_code, 'cards', v_cards, 'first', v_first);
end $$;

-- Stary cleanup → 48 h + sloty
create or replace function public.cleanup_expired_food_photos(p_days int default 0)
returns jsonb
language sql security definer set search_path = public as $$
  select public.cleanup_photo_slots();
$$;
grant execute on function public.cleanup_expired_food_photos(int) to service_role;
grant execute on function public.cleanup_expired_food_photos(int) to authenticated;

-- Cron co 30 min — bez zagnieżdżonych $$ (to psuło 016)
do $cronsetup$
begin
  begin
    perform cron.unschedule('yummeet-food-photo-cleanup');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('yummeet-photo-slots');
  exception when others then null;
  end;
  perform cron.schedule(
    'yummeet-photo-slots',
    '*/30 * * * *',
    'select public.cleanup_photo_slots()'
  );
exception when others then
  raise notice 'pg_cron niedostępny — cleanup_photo_slots() odpala się przy uploadzie / statusie slotów';
end;
$cronsetup$;

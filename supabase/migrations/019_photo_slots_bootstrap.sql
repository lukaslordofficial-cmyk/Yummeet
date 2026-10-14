-- =====================================================================
-- 019: kompletny bootstrap photo_slots (działa nawet gdy 017/018 padły)
-- Uruchom TEN plik w SQL Editor — jeden raz, cały.
-- =====================================================================

alter table public.food_offers add column if not exists updated_at timestamptz not null default now();

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

create or replace function public.cleanup_photo_slots()
returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare
  r record;
  v_slots int := 0;
  v_files int := 0;
  v_offers int := 0;
begin
  update public.food_offers
     set status = 'expired', updated_at = now()
   where status in ('available', 'reserved')
     and created_at < now() - interval '7 days';
  get diagnostics v_offers = ROW_COUNT;

  update public.photo_slots s
     set release_at = coalesce(s.release_at, coalesce(o.updated_at, o.created_at) + interval '48 hours')
    from public.food_offers o
   where s.kind = 'food_offer' and s.ref_id = o.id and s.released_at is null
     and o.status in ('handed_over', 'cancelled', 'expired')
     and s.release_at is null;

  update public.photo_slots s
     set release_at = coalesce(s.release_at, coalesce(um.completed_at, um.submitted_at, um.created_at) + interval '48 hours')
    from public.user_missions um
   where s.kind = 'mission_evidence' and s.ref_id = um.id and s.released_at is null
     and um.status in ('completed', 'expired', 'cancelled', 'rejected')
     and s.release_at is null;

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
    if public._delete_storage_url(r.photo_url) then
      v_files := v_files + 1;
    end if;
    if r.kind = 'food_offer' and r.ref_id is not null then
      update public.food_offers set photo_url = null where id = r.ref_id and photo_url = r.photo_url;
    elsif r.kind = 'cooking_tip' and r.ref_id is not null then
      begin
        update public.cooking_tips set photo_url = null where id = r.ref_id and photo_url = r.photo_url;
      exception when undefined_table then null;
      end;
    elsif r.kind = 'event_photo' and r.ref_id is not null then
      begin
        delete from public.event_photos where id = r.ref_id;
      exception when undefined_table then null;
      end;
    end if;
    update public.photo_slots set released_at = now() where id = r.id;
    v_slots := v_slots + 1;
  end loop;

  return jsonb_build_object(
    'slots_released', v_slots,
    'files_deleted', v_files,
    'offers_expired', v_offers
  );
end $$;
grant execute on function public.cleanup_photo_slots() to authenticated;
grant execute on function public.cleanup_photo_slots() to service_role;

create or replace function public.photo_slot_status(p_limit int default 3)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_used int := 0;
  lim int := least(greatest(coalesce(p_limit, 3), 1), 20);
begin
  begin perform public.cleanup_photo_slots(); exception when others then null; end;
  select count(*)::int into v_used from public.photo_slots
   where user_id = v and released_at is null;
  return jsonb_build_object(
    'used', v_used, 'limit', lim, 'remaining', greatest(lim - v_used, 0), 'model', 'slots'
  );
end $$;
grant execute on function public.photo_slot_status(int) to authenticated;

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
  v_used int;
  lim int := least(greatest(coalesce(p_limit, 3), 1), 20);
  v_id uuid;
begin
  if p_kind not in ('food_offer', 'cooking_tip', 'mission_evidence', 'event_photo') then
    raise exception 'invalid_photo_kind';
  end if;
  if p_photo_url is null or char_length(trim(p_photo_url)) < 8 then
    raise exception 'invalid_photo';
  end if;
  begin perform public.cleanup_photo_slots(); exception when others then null; end;
  select count(*)::int into v_used from public.photo_slots where user_id = v and released_at is null;
  if v_used >= lim then raise exception 'photo_slots_full'; end if;
  insert into public.photo_slots (user_id, kind, ref_id, photo_url)
  values (v, p_kind, p_ref_id, trim(p_photo_url))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.claim_photo_slot(text, text, uuid, int) to authenticated;

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
declare v_cnt int := 0;
begin
  update public.photo_slots
     set release_at = least(coalesce(release_at, now() + p_after), now() + p_after)
   where kind = p_kind and ref_id = p_ref_id and released_at is null;
  get diagnostics v_cnt = ROW_COUNT;
  return v_cnt;
end $$;

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

create or replace function public.cleanup_expired_food_photos(p_days int default 0)
returns jsonb
language sql security definer set search_path = public as $$
  select public.cleanup_photo_slots();
$$;
grant execute on function public.cleanup_expired_food_photos(int) to service_role;
grant execute on function public.cleanup_expired_food_photos(int) to authenticated;

-- --- Hooki publikacji / misji (idempotentne create or replace) ---
create or replace function public.publish_food_offer(
  p_kind text, p_title text, p_description text default null, p_photo_url text default null,
  p_allergens text[] default '{}', p_portions int default 1,
  p_city text default null, p_street text default null, p_place_detail text default null,
  p_lat float8 default null, p_lng float8 default null, p_storage text default null, p_prepared_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._uid(); v_id uuid; v_pt geography; r record; v_place text;
  v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
begin
  if p_kind not in ('giveaway','exchange','signature','order') then raise exception 'invalid_kind'; end if;
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if p_portions is null or p_portions < 1 or p_portions > 200 then raise exception 'invalid_portions'; end if;
  if p_allergens is null or cardinality(p_allergens) = 0 then raise exception 'allergens_required'; end if;
  if v_photo is not null then perform public.claim_photo_slot('food_offer', v_photo, null, 3); end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_place := nullif(trim(concat_ws(', ', nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_street,'')),''), nullif(trim(coalesce(p_place_detail,'')),''))), '');
  begin perform public.touch_user_geo(p_lat, p_lng); exception when others then null; end;
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
    update public.photo_slots set ref_id = v_id
     where user_id = v and kind = 'food_offer' and photo_url = v_photo and ref_id is null and released_at is null;
  end if;
  begin
    for r in
      select g.user_id from public.user_geo_cache g
      where g.user_id <> v and g.updated_at > now() - interval '30 days' and st_dwithin(g.coords, v_pt, 20000)
      order by g.updated_at desc limit 100
    loop
      perform public._notify(r.user_id, 'food_nearby', 'Nowa oferta jedzenia w okolicy', trim(p_title),
        jsonb_build_object('offer_id', v_id, 'kind', p_kind), 'food:' || v_id || ':' || r.user_id);
    end loop;
  exception when others then null;
  end;
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
  if v_photo is not null then perform public.claim_photo_slot('cooking_tip', v_photo, null, 3); end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  begin perform public.touch_user_geo(p_lat, p_lng); exception when others then null; end;
  insert into public.cooking_tips (author_id, title, body, photo_url, place_lat, place_lng, coords)
  values (v, trim(p_title), trim(p_body), v_photo, p_lat, p_lng, v_pt) returning id into v_id;
  if v_photo is not null then
    update public.photo_slots set ref_id = v_id, release_at = coalesce(release_at, now() + interval '7 days')
     where user_id = v and kind = 'cooking_tip' and photo_url = v_photo and ref_id is null and released_at is null;
  end if;
  return v_id;
end $$;
grant execute on function public.publish_cooking_tip(text, text, text, float8, float8) to authenticated;

do $ev$
begin
  if to_regclass('public.event_photos') is not null then
    execute $fn$
      create or replace function public.add_event_photo(p_event uuid, p_photo_url text)
      returns uuid language plpgsql security definer set search_path = public as $body$
      declare v uuid := public._uid(); v_id uuid; v_photo text := nullif(trim(coalesce(p_photo_url,'')),'');
      begin
        if v_photo is null then raise exception 'invalid_photo'; end if;
        if not (exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) or public.is_event_member(p_event)) then
          raise exception 'not_joined';
        end if;
        perform public.claim_photo_slot('event_photo', v_photo, null, 3);
        insert into public.event_photos (event_id, uploader_id, photo_url) values (p_event, v, v_photo) returning id into v_id;
        update public.photo_slots set ref_id = v_id, release_at = coalesce(release_at, now() + interval '7 days')
         where user_id = v and kind = 'event_photo' and photo_url = v_photo and ref_id is null and released_at is null;
        return v_id;
      end;
      $body$;
    $fn$;
    execute 'grant execute on function public.add_event_photo(uuid, text) to authenticated';
  end if;
end;
$ev$;

-- Cron opcjonalny (może nie być włączony na free — to nie blokuje reszty)
do $cronsetup$
begin
  begin perform cron.unschedule('yummeet-food-photo-cleanup'); exception when others then null; end;
  begin perform cron.unschedule('yummeet-photo-slots'); exception when others then null; end;
  perform cron.schedule('yummeet-photo-slots', '*/30 * * * *', 'select public.cleanup_photo_slots()');
exception when others then
  raise notice 'pg_cron niedostępny — OK, cleanup działa przy uploadzie';
end;
$cronsetup$;

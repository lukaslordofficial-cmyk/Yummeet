-- =====================================================================
-- 018: naprawa cleanup_photo_slots (brak updated_at na food_offers,
--      błąd relation "n") + bezpieczny cron bez walidacji przez SELECT
-- =====================================================================

alter table public.food_offers add column if not exists updated_at timestamptz not null default now();

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
      update public.cooking_tips set photo_url = null where id = r.ref_id and photo_url = r.photo_url;
    elsif r.kind = 'event_photo' and r.ref_id is not null then
      delete from public.event_photos where id = r.ref_id;
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

create or replace function public.photo_slot_status(p_limit int default 3)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_used int := 0;
  lim int := least(greatest(coalesce(p_limit, 3), 1), 20);
begin
  begin
    perform public.cleanup_photo_slots();
  exception when others then
    null;
  end;
  select count(*)::int into v_used from public.photo_slots
   where user_id = v and released_at is null;
  return jsonb_build_object(
    'used', v_used,
    'limit', lim,
    'remaining', greatest(lim - v_used, 0),
    'model', 'slots'
  );
end $$;

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
  begin
    perform public.cleanup_photo_slots();
  exception when others then
    null;
  end;
  select count(*)::int into v_used from public.photo_slots where user_id = v and released_at is null;
  if v_used >= lim then raise exception 'photo_slots_full'; end if;

  insert into public.photo_slots (user_id, kind, ref_id, photo_url)
  values (v, p_kind, p_ref_id, trim(p_photo_url))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.schedule_photo_slot_release(p_kind text, p_ref_id uuid, p_after interval default interval '48 hours')
returns int
language plpgsql security definer set search_path = public as $$
declare v_cnt int := 0;
begin
  update public.photo_slots
     set release_at = least(coalesce(release_at, now() + p_after), now() + p_after)
   where kind = p_kind
     and ref_id = p_ref_id
     and released_at is null;
  get diagnostics v_cnt = ROW_COUNT;
  return v_cnt;
end $$;

-- Cron opcjonalny — nie walidujemy komendy przez natychmiastowy SELECT
do $cronsetup$
begin
  begin perform cron.unschedule('yummeet-food-photo-cleanup'); exception when others then null; end;
  begin perform cron.unschedule('yummeet-photo-slots'); exception when others then null; end;
  perform cron.schedule('yummeet-photo-slots', '*/30 * * * *', 'select public.cleanup_photo_slots()');
exception when others then
  raise notice 'pg_cron niedostępny — cleanup przy uploadzie/statusie wystarczy';
end;
$cronsetup$;

-- Smoke test przeniesiony do 019 (tu photo_slots mogło jeszcze nie istnieć).

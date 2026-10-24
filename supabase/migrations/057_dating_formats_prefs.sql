-- Spacer zamiast wymiany porcji, bez wspólnego gotowania.
-- Najpierw zdejmij starą regułę — inaczej zapis „walk” pada na dating_format.

alter table public.dating_listings drop constraint if exists dating_format;

update public.dating_listings set format = 'picnic' where format = 'cook';
update public.dating_listings set format = 'walk' where format = 'swap';
update public.dating_plans set place_kind = 'picnic' where place_kind = 'cook';
update public.dating_plans set place_kind = 'walk' where place_kind = 'swap';

alter table public.dating_listings add constraint dating_format check (format in ('cafe', 'dinner', 'picnic', 'walk'));

create or replace function public._dating_card(p public.dating_profiles, p_km float8, p_extras boolean)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'age', public._dating_age(p.birth_date),
    'gender', p.gender,
    'photo_url', p.photo_url,
    'bio', p.bio,
    'goal', p.goal,
    'seeking_gender', p.seeking_gender,
    'age_min', p.age_min,
    'age_max', p.age_max,
    'area_label', p.area_label,
    'distance_label', public._dating_distance_label(p_km),
    'about', p.about,
    'kids', p.kids,
    'relationship_model', p.relationship_model
  );
$$;

create or replace function public.dating_publish(p_listing jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_blurb text; v_format text;
begin
  if not exists (select 1 from public.dating_profiles where user_id = v) then raise exception 'dating_profile_required'; end if;
  if exists (select 1 from public.dating_listings where owner_id = v and status = 'active') then raise exception 'dating_active_exists'; end if;
  v_blurb := nullif(trim(p_listing->>'blurb'), '');
  v_format := p_listing->>'format';
  if v_blurb is null or char_length(v_blurb) < 10 or char_length(v_blurb) > 400 then raise exception 'invalid_body'; end if;
  if v_format not in ('cafe', 'dinner', 'picnic', 'walk') then raise exception 'invalid_kind'; end if;
  insert into public.dating_listings (owner_id, blurb, format, area_label, time_window, status)
  values (
    v, v_blurb, v_format,
    nullif(trim(p_listing->>'area_label'), ''),
    nullif(trim(p_listing->>'time_window'), ''),
    'active'
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.dating_save_plan(p_interest uuid, p_plan jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  i public.dating_interests;
  l public.dating_listings;
  v_games text[];
  v_missions text[];
  v_split text;
  v_place text;
  v_time text;
  v_date date;
  v_budget text;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'planning' then raise exception 'dating_not_ready'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v and i.guest_id <> v then raise exception 'not_allowed'; end if;
  v_split := nullif(p_plan->>'split', '');
  v_place := nullif(p_plan->>'place_kind', '');
  v_time := nullif(trim(p_plan->>'meet_time'), '');
  v_budget := nullif(trim(p_plan->>'budget_note'), '');
  if v_split is not null and v_split not in ('half', 'host', 'guest', 'separate', 'later') then raise exception 'invalid_budget'; end if;
  if v_place is not null and v_place not in ('cafe', 'dinner', 'picnic', 'walk') then raise exception 'invalid_kind'; end if;
  if v_time is not null and v_time !~ '^\d{2}:\d{2}$' then raise exception 'invalid_profile'; end if;
  if v_budget is not null and char_length(v_budget) > 200 then raise exception 'invalid_budget'; end if;
  begin
    v_date := nullif(p_plan->>'meet_date', '')::date;
  exception when others then
    raise exception 'invalid_profile';
  end;
  select coalesce(array_agg(x), '{}') into v_games
  from jsonb_array_elements_text(coalesce(p_plan->'game_ids', '[]'::jsonb)) x
  where x in ('two-truths', 'find-someone', 'runaway-story');
  select coalesce(array_agg(x), '{}') into v_missions
  from jsonb_array_elements_text(coalesce(p_plan->'mission_ids', '[]'::jsonb)) x
  where x in ('cook-snack', 'share-dessert', 'picnic-swap');
  if coalesce(array_length(v_games, 1), 0) > 2 or coalesce(array_length(v_missions, 1), 0) > 2 then
    raise exception 'invalid_kind';
  end if;
  insert into public.dating_plans (interest_id, meet_date, meet_time, place_kind, budget_note, split, game_ids, mission_ids, updated_at)
  values (i.id, v_date, v_time, v_place, v_budget, v_split, v_games, v_missions, now())
  on conflict (interest_id) do update set
    meet_date = excluded.meet_date,
    meet_time = excluded.meet_time,
    place_kind = excluded.place_kind,
    budget_note = excluded.budget_note,
    split = excluded.split,
    game_ids = excluded.game_ids,
    mission_ids = excluded.mission_ids,
    updated_at = now();
end $$;

create or replace function public.dating_update(p_id uuid, p_listing jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_blurb text; v_format text;
begin
  v_blurb := nullif(trim(p_listing->>'blurb'), '');
  v_format := p_listing->>'format';
  if v_blurb is null or char_length(v_blurb) < 10 or char_length(v_blurb) > 400 then raise exception 'invalid_body'; end if;
  if v_format not in ('cafe', 'dinner', 'picnic', 'walk') then raise exception 'invalid_kind'; end if;
  update public.dating_listings set
    blurb = v_blurb,
    format = v_format,
    area_label = nullif(trim(p_listing->>'area_label'), ''),
    time_window = nullif(trim(p_listing->>'time_window'), ''),
    updated_at = now()
  where id = p_id and owner_id = v;
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.dating_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  delete from public.dating_listings where id = p_id and owner_id = v;
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.dating_respond(p_interest uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); i public.dating_interests; l public.dating_listings; v_conv uuid;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'pending' then raise exception 'invalid_transition'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v then raise exception 'not_allowed'; end if;
  if public.is_blocked(v, i.guest_id) then raise exception 'blocked'; end if;
  if p_accept then
    update public.dating_interests set status = 'questions', updated_at = now() where id = i.id;
    v_conv := public.chat_open_direct(i.guest_id);
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v, 'Od teraz możecie rozmawiać ze sobą na czacie.');
    perform public._notify(
      i.guest_id,
      'dating_accept',
      'Możecie pisać na czacie',
      'Od teraz możecie rozmawiać ze sobą na czacie. Randka jest w Moje randki.',
      jsonb_build_object('interest_id', i.id, 'conversation_id', v_conv),
      'dating-accept:' || i.id
    );
  else
    update public.dating_interests set status = 'declined', updated_at = now() where id = i.id;
    perform public._notify(i.guest_id, 'dating_decline', 'Bez kontaktu tym razem', 'Organizator nie przyjął zgłoszenia.', jsonb_build_object('interest_id', i.id), 'dating-decline:' || i.id);
  end if;
end $$;

drop policy if exists notif_delete_own on public.notifications;
create policy notif_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());
grant delete on public.notifications to authenticated;

revoke all on function public._dating_card(public.dating_profiles, float8, boolean) from public, anon, authenticated;
revoke all on function public.dating_publish(jsonb) from public, anon;
revoke all on function public.dating_save_plan(uuid, jsonb) from public, anon;
revoke all on function public.dating_update(uuid, jsonb) from public, anon;
revoke all on function public.dating_delete(uuid) from public, anon;
revoke all on function public.dating_respond(uuid, boolean) from public, anon;
grant execute on function public.dating_publish(jsonb) to authenticated;
grant execute on function public.dating_save_plan(uuid, jsonb) to authenticated;
grant execute on function public.dating_update(uuid, jsonb) to authenticated;
grant execute on function public.dating_delete(uuid) to authenticated;
grant execute on function public.dating_respond(uuid, boolean) to authenticated;

-- =====================================================================
-- 022: Inspiracje = przepis | lifehack; czat przy proximity duel
-- =====================================================================

-- --- tip kinds ---
alter table public.cooking_tips add column if not exists tip_kind text;
update public.cooking_tips set tip_kind = 'recipe' where tip_kind is null;
do $$ begin
  alter table public.cooking_tips alter column tip_kind set default 'recipe';
  alter table public.cooking_tips alter column tip_kind set not null;
exception when others then null;
end $$;
do $$ begin
  alter table public.cooking_tips drop constraint if exists cooking_tips_kind_ok;
  alter table public.cooking_tips add constraint cooking_tips_kind_ok
    check (tip_kind in ('recipe', 'lifehack'));
exception when others then null;
end $$;

drop function if exists public.publish_cooking_tip(text, text, text, float8, float8);
create or replace function public.publish_cooking_tip(
  p_title text,
  p_body text,
  p_photo_url text default null,
  p_lat float8 default null,
  p_lng float8 default null,
  p_kind text default 'recipe'
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._uid();
  v_id uuid;
  v_pt geography;
  r record;
  v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
  v_kind text := coalesce(nullif(trim(coalesce(p_kind, '')), ''), 'recipe');
begin
  if v_kind not in ('recipe', 'lifehack') then raise exception 'invalid_kind'; end if;
  if p_title is null or char_length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if p_body is null or char_length(trim(p_body)) < 10 then raise exception 'invalid_body'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;

  if v_photo is not null then
    begin
      perform public.claim_photo_slot('cooking_tip', v_photo, null, 3);
    exception when undefined_function then null;
    end;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  begin perform public.touch_user_geo(p_lat, p_lng); exception when others then null; end;

  insert into public.cooking_tips (author_id, title, body, photo_url, place_lat, place_lng, coords, tip_kind)
  values (v, trim(p_title), trim(p_body), v_photo, p_lat, p_lng, v_pt, v_kind)
  returning id into v_id;

  if v_photo is not null then
    begin
      update public.photo_slots set ref_id = v_id, release_at = coalesce(release_at, now() + interval '7 days')
       where user_id = v and kind = 'cooking_tip' and photo_url = v_photo and ref_id is null and released_at is null;
    exception when others then null;
    end;
  end if;

  begin
    for r in
      select g.user_id from public.user_geo_cache g
      where g.user_id <> v and g.updated_at > now() - interval '30 days' and st_dwithin(g.coords, v_pt, 20000)
      order by g.updated_at desc limit 100
    loop
      perform public._notify(
        r.user_id,
        'tip_nearby',
        case when v_kind = 'lifehack' then 'Nowy life hack w okolicy' else 'Nowy przepis w okolicy' end,
        trim(p_title),
        jsonb_build_object('tip_id', v_id, 'tip_kind', v_kind),
        'tip:' || v_id || ':' || r.user_id
      );
    end loop;
  exception when others then null;
  end;

  return v_id;
end $$;
grant execute on function public.publish_cooking_tip(text, text, text, float8, float8, text) to authenticated;

drop function if exists public.list_tips_nearby(float8, float8, int);
create or replace function public.list_tips_nearby(
  p_lat float8, p_lng float8, p_limit int default 50, p_kind text default null
)
returns table (
  id uuid, author_id uuid, title text, body text, photo_url text, created_at timestamptz,
  author_name text, tip_kind text
)
language plpgsql security definer set search_path = public, extensions as $$
declare v_pt geography; v_kind text := nullif(trim(coalesce(p_kind, '')), '');
begin
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  begin perform public.touch_user_geo(p_lat, p_lng); exception when others then null; end;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  return query
  select t.id, t.author_id, t.title, t.body, t.photo_url, t.created_at, p.display_name, t.tip_kind
  from public.cooking_tips t
  left join public.profiles p on p.id = t.author_id
  where t.coords is not null
    and st_dwithin(t.coords, v_pt, 20000)
    and (v_kind is null or t.tip_kind = v_kind)
  order by t.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
grant execute on function public.list_tips_nearby(float8, float8, int, text) to authenticated;

-- --- duel chat on proximity catch ---
create or replace function public._duel_ensure_chat(p_duel uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  d record;
  v_conv uuid;
begin
  select * into d from public.duels where id = p_duel;
  if d.id is null then return null; end if;

  select id into v_conv from public.conversations where kind = 'duel' and ref_id = p_duel;
  if v_conv is null then
    insert into public.conversations (kind, ref_id, title, created_by)
    values ('duel', p_duel, 'Pojedynek — ustalenia', d.challenger_id)
    on conflict (kind, ref_id) where ref_id is not null do nothing
    returning id into v_conv;
    if v_conv is null then
      select id into v_conv from public.conversations where kind = 'duel' and ref_id = p_duel;
    end if;
  end if;

  if v_conv is not null then
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conv, d.challenger_id), (v_conv, d.opponent_id)
    on conflict do nothing;
  end if;
  return v_conv;
end $$;

create or replace function public.presence_ping(p_lat float8, p_lng float8) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._uid();
  prev record;
  v_pt geography;
  o record;
  v_id uuid;
  v_conv uuid;
  v_created uuid[] := '{}';
  v_convs uuid[] := '{}';
begin
  if not (select duel_mode_enabled from public.profiles where id = v) then raise exception 'duel_mode_disabled'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  select * into prev from public.user_location_presence where user_id = v;
  if prev.user_id is not null then
    if prev.updated_at > now() - interval '20 seconds' then
      return jsonb_build_object('throttled', true, 'duels', '[]'::jsonb, 'conversations', '[]'::jsonb);
    end if;
  end if;
  insert into public.user_location_presence (user_id, coords, updated_at) values (v, v_pt, now())
  on conflict (user_id) do update set coords = excluded.coords, updated_at = excluded.updated_at;
  delete from public.user_location_presence where updated_at < now() - interval '10 minutes';
  if coalesce(prev.suspicious_count, 0) >= 5 then
    return jsonb_build_object('duels', '[]'::jsonb, 'conversations', '[]'::jsonb);
  end if;

  for o in
    select lp.user_id from public.user_location_presence lp join public.profiles p on p.id = lp.user_id
     where lp.user_id <> v and p.duel_mode_enabled and lp.updated_at > now() - interval '2 minutes' and lp.suspicious_count < 5
       and st_dwithin(lp.coords, v_pt, 100)
       and not public.is_blocked(v, lp.user_id)
       and not exists (select 1 from public.duels d where d.created_at > now() - interval '7 days'
                        and ((d.challenger_id = v and d.opponent_id = lp.user_id) or (d.challenger_id = lp.user_id and d.opponent_id = v)))
       and not exists (select 1 from public.duels d where d.status not in ('finished','cancelled','rejected','expired')
                        and ((d.challenger_id = v and d.opponent_id = lp.user_id) or (d.challenger_id = lp.user_id and d.opponent_id = v)))
     limit 1
  loop
    insert into public.duels (mode, challenger_id, opponent_id, status, response_deadline)
    values ('proximity', v, o.user_id, 'round1', now() + interval '15 minutes') returning id into v_id;
    v_created := v_created || v_id;
    v_conv := public._duel_ensure_chat(v_id);
    if v_conv is not null then v_convs := v_convs || v_conv; end if;
    perform public._notify(
      v, 'duel_proximity', 'Yummiteer w pobliżu — pojedynek!',
      'Otwórz czat, żeby ustalić szczegóły wyzwania.',
      jsonb_build_object('duel_id', v_id, 'conversation_id', v_conv),
      'duel_prox:' || v_id
    );
    perform public._notify(
      o.user_id, 'duel_proximity', 'Yummiteer w pobliżu — pojedynek!',
      'Otwórz czat, żeby ustalić szczegóły wyzwania.',
      jsonb_build_object('duel_id', v_id, 'conversation_id', v_conv),
      'duel_prox:' || v_id || ':opp'
    );
  end loop;
  return jsonb_build_object('duels', to_jsonb(v_created), 'conversations', to_jsonb(v_convs));
end $$;

-- Ensure invite accept also uses helper
create or replace function public.duel_respond(p_duel uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record; v_conv uuid;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or d.opponent_id <> v then raise exception 'not_allowed'; end if;
  if d.status <> 'pending_acceptance' then raise exception 'invalid_transition'; end if;
  if d.response_deadline < now() then
    update public.duels set status = 'expired', updated_at = now() where id = p_duel; return;
  end if;
  if not p_accept then
    update public.duels set status = 'rejected', updated_at = now(), finished_at = now() where id = p_duel; return;
  end if;
  update public.duels set status = 'round1', response_deadline = now() + interval '30 minutes', updated_at = now() where id = p_duel;
  v_conv := public._duel_ensure_chat(p_duel);
  perform public._notify(
    d.challenger_id, 'duel_accepted', 'Pojedynek przyjęty!',
    'Ustalcie szczegóły na czacie, potem kamień-papier-nożyce.',
    jsonb_build_object('duel_id', p_duel, 'conversation_id', v_conv),
    'duel_acc:' || p_duel
  );
end $$;

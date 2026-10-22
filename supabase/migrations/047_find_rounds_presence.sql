-- Dwie tury „Znajdź kogoś”, ręczny kod spotkania i licznik odwiedzonych oraz zorganizowanych spotkań.

create table if not exists public.event_find_answers (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  yes boolean,
  names text[] not null default '{}',
  yes_saved boolean not null default false,
  names_saved boolean not null default false,
  primary key (event_id, user_id, prompt)
);

create table if not exists public.event_presence (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('visited', 'organized')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, kind)
);

alter table public.event_find_answers enable row level security;
alter table public.event_presence enable row level security;
revoke all on public.event_find_answers from public, anon, authenticated;
revoke all on public.event_presence from public, anon, authenticated;

create or replace function public._event_find_prompts(p_event uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(coalesce(nullif(body, ''), title) order by created_at), '{}'::text[])
  from public.event_attractions
  where event_id = p_event and category = 'games' and title like 'Znajdź kogoś:%';
$$;

create or replace function public._event_find_phase(p_event uuid)
returns int
language plpgsql stable security definer set search_path = public as $$
declare
  prompts text[] := public._event_find_prompts(p_event);
  members int;
  yes_done int;
  names_done int;
begin
  if prompts is null or coalesce(cardinality(prompts), 0) = 0 then return 1; end if;
  select count(*) into members from public.event_participants
   where event_id = p_event and status in ('joined', 'attended');
  if coalesce(members, 0) = 0 then return 1; end if;
  select count(*) into yes_done
    from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended')
     and (
       select count(*) from unnest(prompts) pr(prompt)
        where exists (
          select 1 from public.event_find_answers a
           where a.event_id = p_event and a.user_id = ep.user_id and a.prompt = pr.prompt and a.yes_saved
        )
     ) = cardinality(prompts);
  if yes_done < members then return 1; end if;
  select count(*) into names_done
    from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended')
     and (
       select count(*) from unnest(prompts) pr(prompt)
        where exists (
          select 1 from public.event_find_answers a
           where a.event_id = p_event and a.user_id = ep.user_id and a.prompt = pr.prompt and a.names_saved
        )
     ) = cardinality(prompts);
  if names_done < members then return 2; end if;
  return 3;
end $$;

create or replace function public._event_find_state(p_event uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := auth.uid();
  phase int := public._event_find_phase(p_event);
  prompts text[] := public._event_find_prompts(p_event);
  n int := coalesce(cardinality(prompts), 0);
  saved boolean := false;
  score int := 0;
  reveal jsonb := '[]'::jsonb;
  pr text;
  mine text[];
  pts int;
  guess text;
  said_yes boolean;
  yes_names jsonb;
  no_names jsonb;
begin
  if n > 0 and v is not null then
    if phase = 1 then
      select count(*) = n into saved from unnest(prompts) x(prompt)
       where exists (
         select 1 from public.event_find_answers a
          where a.event_id = p_event and a.user_id = v and a.prompt = x.prompt and a.yes_saved
       );
    else
      select count(*) = n into saved from unnest(prompts) x(prompt)
       where exists (
         select 1 from public.event_find_answers a
          where a.event_id = p_event and a.user_id = v and a.prompt = x.prompt and a.names_saved
       );
    end if;
  end if;
  if phase = 3 then
    foreach pr in array prompts loop
      select coalesce(jsonb_agg(coalesce(p.display_name, 'Yummiteer') order by p.display_name), '[]'::jsonb)
        into yes_names
        from public.event_find_answers a
        join public.profiles p on p.id = a.user_id
       where a.event_id = p_event and a.prompt = pr and a.yes_saved and a.yes is true;
      select coalesce(jsonb_agg(coalesce(p.display_name, 'Yummiteer') order by p.display_name), '[]'::jsonb)
        into no_names
        from public.event_find_answers a
        join public.profiles p on p.id = a.user_id
       where a.event_id = p_event and a.prompt = pr and a.yes_saved and a.yes is false;
      select a.names into mine
        from public.event_find_answers a
       where a.event_id = p_event and a.user_id = v and a.prompt = pr;
      mine := coalesce(mine, '{}');
      pts := 0;
      foreach guess in array mine loop
        said_yes := null;
        select a.yes into said_yes
          from public.event_find_answers a
          join public.profiles p on p.id = a.user_id
         where a.event_id = p_event and a.prompt = pr and a.yes_saved
           and lower(trim(coalesce(p.display_name, ''))) = lower(trim(guess))
         limit 1;
        if said_yes is true then pts := pts + 1; else pts := pts - 1; end if;
      end loop;
      score := score + pts;
      reveal := reveal || jsonb_build_array(jsonb_build_object(
        'prompt', pr,
        'yes', coalesce(yes_names, '[]'::jsonb),
        'no', coalesce(no_names, '[]'::jsonb),
        'mine', to_jsonb(mine),
        'points', pts
      ));
    end loop;
  end if;
  return jsonb_build_object(
    'phase', phase,
    'saved', coalesce(saved, false),
    'all_saved', phase = 3,
    'score', case when phase = 3 then score else null end,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('prompt', a.prompt, 'yes', a.yes, 'names', to_jsonb(a.names)) order by a.prompt)
      from public.event_find_answers a
      where a.event_id = p_event and a.user_id = v
    ), '[]'::jsonb),
    'reveal', case when phase = 3 then reveal else null end
  );
end $$;

create or replace function public.event_play_board(p_event uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := auth.uid();
  play public.event_play%rowtype;
  v_turn uuid;
  v_limit int := 1;
  v_round int := 1;
  v_has boolean := false;
begin
  perform public._event_play_member(p_event);
  select * into play from public.event_play where event_id = p_event;
  v_has := found;
  if v_has then
    v_round := play.round_no;
  end if;
  select case when body ~ '^[0-9]+$' then least(10, greatest(1, body::int)) else 1 end
    into v_limit
    from public.event_attractions
   where event_id = p_event and title = 'Pytania na osobę'
   limit 1;
  v_limit := coalesce(v_limit, 1);
  if v_has then
    select s.user_id into v_turn
      from (
        select ep.user_id, row_number() over (order by ep.joined_at, ep.user_id) as n
          from public.event_participants ep
         where ep.event_id = p_event and ep.status in ('joined', 'attended')
      ) s
     where not exists (
       select 1 from public.event_question_draws d
        where d.event_id = p_event and d.user_id = s.user_id and d.round_no = v_round and d.answered_at is not null
     )
     order by s.n
     limit 1;
  end if;
  return jsonb_build_object(
    'status', case when v_has then play.status else 'lobby' end,
    'game_key', case when v_has then play.game_key else null end,
    'round_no', v_round,
    'notice', case when v_has then play.notice else null end,
    'limit', v_limit,
    'games', to_jsonb(public._event_plan_games(p_event)),
    'your_turn', v_turn is not distinct from v,
    'turn_name', (select display_name from public.profiles where id = v_turn),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', ep.user_id, 'name', coalesce(p.display_name, 'Yummiteer')) order by ep.joined_at)
      from public.event_participants ep
      join public.profiles p on p.id = ep.user_id
      where ep.event_id = p_event and ep.status in ('joined', 'attended')
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(a.title order by a.created_at)
      from public.event_attractions a
      where a.event_id = p_event and a.category = 'questions'
        and a.title not in ('Notatka organizatora', 'Pytania na osobę')
    ), '[]'::jsonb),
    'prompts', coalesce((
      select jsonb_agg(coalesce(nullif(a.body, ''), a.title) order by a.created_at)
      from public.event_attractions a
      where a.event_id = p_event and a.category = 'games' and a.title like 'Znajdź kogoś:%'
    ), '[]'::jsonb),
    'my_question', (
      select d.question from public.event_question_draws d
      where d.event_id = p_event and d.user_id = v and d.round_no = v_round
    ),
    'my_answered', exists (
      select 1 from public.event_question_draws d
      where d.event_id = p_event and d.user_id = v and d.round_no = v_round and d.answered_at is not null
    ),
    'my_picks', coalesce((
      select jsonb_agg(jsonb_build_object('prompt', f.prompt, 'names', f.names))
      from public.event_find_picks f
      where f.event_id = p_event and f.user_id = v
    ), '[]'::jsonb),
    'find', public._event_find_state(p_event)
  );
end $$;

create or replace function public.event_play_start(p_event uuid, p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_round int := 1;
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  if not (p_game = any (public._event_plan_games(p_event))) then raise exception 'play_not_live'; end if;
  if p_game = 'find-someone' then
    v_round := public._event_find_phase(p_event);
  end if;
  insert into public.event_play (event_id, game_key, round_no, status, notice, updated_at)
  values (p_event, p_game, v_round, 'live', null, now())
  on conflict (event_id) do update
    set game_key = excluded.game_key, round_no = excluded.round_no, status = 'live', notice = null, updated_at = now();
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_find_submit(p_event uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  phase int;
  prompts text[];
  pr text;
  rowj jsonb;
  v_yes boolean;
  v_names text[];
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'find-someone') then
    raise exception 'play_not_live';
  end if;
  phase := public._event_find_phase(p_event);
  if phase >= 3 then raise exception 'play_not_live'; end if;
  prompts := public._event_find_prompts(p_event);
  if coalesce(cardinality(prompts), 0) = 0 then raise exception 'find_incomplete'; end if;
  foreach pr in array prompts loop
    select elem into rowj from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem
     where elem->>'prompt' = pr
     limit 1;
    if rowj is null then raise exception 'find_incomplete'; end if;
    if phase = 1 then
      if jsonb_typeof(rowj->'yes') <> 'boolean' then raise exception 'find_incomplete'; end if;
      v_yes := (rowj->>'yes')::boolean;
      insert into public.event_find_answers (event_id, user_id, prompt, yes, yes_saved)
      values (p_event, v, pr, v_yes, true)
      on conflict (event_id, user_id, prompt) do update set yes = excluded.yes, yes_saved = true;
    else
      select coalesce(array_agg(n), '{}') into v_names
        from (
          select left(trim(x), 80) as n
          from jsonb_array_elements_text(coalesce(rowj->'names', '[]'::jsonb)) as t(x)
          where char_length(trim(x)) > 0
          limit 12
        ) s;
      insert into public.event_find_answers (event_id, user_id, prompt, names, names_saved)
      values (p_event, v, pr, coalesce(v_names, '{}'), true)
      on conflict (event_id, user_id, prompt) do update set names = excluded.names, names_saved = true;
    end if;
  end loop;
  update public.event_play
     set round_no = public._event_find_phase(p_event), updated_at = now()
   where event_id = p_event;
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_claim_code(p_code text, p_event uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  e public.events%rowtype;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_prev text;
  v_conv uuid;
begin
  if v is null then raise exception 'not_authenticated'; end if;
  if char_length(v_code) < 4 then raise exception 'invalid_code'; end if;
  select ev.* into e
    from public.events ev
    join public.event_secrets s on s.event_id = ev.id
   where upper(s.checkin_code) = v_code
     and (p_event is null or ev.id = p_event)
     and now() >= ev.starts_at - interval '4 hours'
     and now() <= ev.starts_at + interval '4 hours'
   order by ev.starts_at desc
   limit 1;
  if e.id is null then
    if exists (
      select 1 from public.event_secrets s
      join public.events ev on ev.id = s.event_id
      where upper(s.checkin_code) = v_code
        and (p_event is null or ev.id = p_event)
        and now() < ev.starts_at - interval '4 hours'
    ) then raise exception 'too_early'; end if;
    if exists (
      select 1 from public.event_secrets s
      join public.events ev on ev.id = s.event_id
      where upper(s.checkin_code) = v_code
        and (p_event is null or ev.id = p_event)
        and now() > ev.starts_at + interval '4 hours'
    ) then raise exception 'event_closed'; end if;
    raise exception 'invalid_code';
  end if;
  if e.organizer_id = v then
    insert into public.event_presence (event_id, user_id, kind) values (e.id, v, 'organized')
    on conflict do nothing;
    return jsonb_build_object('event_id', e.id, 'kind', 'organized');
  end if;
  select status into v_prev from public.event_participants where event_id = e.id and user_id = v;
  if v_prev is null or v_prev = 'left' then
    if e.organizer_id is not null and public.is_blocked(v, e.organizer_id) then raise exception 'blocked'; end if;
    if e.seats_taken >= e.capacity and v_prev is null then raise exception 'event_full'; end if;
    insert into public.event_participants (event_id, user_id, status)
    values (e.id, v, 'joined')
    on conflict (event_id, user_id) do update set status = 'joined', joined_at = now();
    update public.events
       set seats_taken = seats_taken + 1,
           status = case when seats_taken + 1 >= capacity then 'full' else status end,
           updated_at = now()
     where id = e.id;
    select id into v_conv from public.conversations where kind = 'event' and ref_id = e.id;
    if v_conv is not null then
      insert into public.conversation_members (conversation_id, user_id) values (v_conv, v) on conflict do nothing;
    end if;
  end if;
  insert into public.event_presence (event_id, user_id, kind) values (e.id, v, 'visited')
  on conflict do nothing;
  if e.organizer_id is not null then
    insert into public.event_presence (event_id, user_id, kind) values (e.id, e.organizer_id, 'organized')
    on conflict do nothing;
  end if;
  return jsonb_build_object('event_id', e.id, 'kind', 'visited');
end $$;

create or replace function public.profile_stats(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare vis text; me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select coalesce(visibility->>'stats','public') into vis from public.profiles where id = p_user;
  if vis = 'private' and me <> p_user then return null; end if;
  return jsonb_build_object(
    'missions_completed', public._metric(p_user, 'missions_completed'),
    'cards_owned', public._metric(p_user, 'cards_owned'),
    'duels_won', public._metric(p_user, 'duels_won'),
    'events_attended', public._metric(p_user, 'events_attended'),
    'events_visited', (select count(*) from public.event_presence where user_id = p_user and kind = 'visited'),
    'events_organized', (select count(*) from public.event_presence where user_id = p_user and kind = 'organized'),
    'visited_places', (select count(*) from public.visited_places where user_id = p_user),
    'pins_created', public._metric(p_user, 'pins_created'),
    'travel_km', coalesce((select travel_km from public.profiles where id = p_user), 0)
  );
end $$;

revoke all on function public._event_find_prompts(uuid) from public, anon;
revoke all on function public._event_find_phase(uuid) from public, anon;
revoke all on function public._event_find_state(uuid) from public, anon;
revoke all on function public.event_find_submit(uuid, jsonb) from public, anon;
revoke all on function public.event_claim_code(text, uuid) from public, anon;
grant execute on function public.event_play_board(uuid) to authenticated;
grant execute on function public.event_play_start(uuid, text) to authenticated;
grant execute on function public.event_find_submit(uuid, jsonb) to authenticated;
grant execute on function public.event_claim_code(text, uuid) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Kod QR od 4 h przed startem, szerszy GPS, oraz panel zabaw sterowany przez organizatora.

create or replace function public.event_reveal_checkin_code(p_event uuid, p_lat float8, p_lng float8)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); e record; v_lat float8; v_lng float8; v_code text; v_notified timestamptz;
begin
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'not_found'; end if;
  if e.organizer_id <> v then raise exception 'not_allowed'; end if;
  if now() < e.starts_at - interval '4 hours' then raise exception 'too_early'; end if;
  if now() > e.starts_at + interval '4 hours' then raise exception 'event_closed'; end if;
  select lat, lng into v_lat, v_lng from public._event_venue(p_event);
  if v_lat is null or v_lng is null then raise exception 'no_venue_coords'; end if;
  if not st_dwithin(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 400) then
    raise exception 'too_far_from_place';
  end if;
  select checkin_code, code_notified_at into v_code, v_notified from public.event_secrets where event_id = p_event;
  if v_code is null then
    v_code := upper(substr(md5(random()::text || p_event::text), 1, 6));
    insert into public.event_secrets (event_id, checkin_code) values (p_event, v_code)
    on conflict (event_id) do update set checkin_code = coalesce(public.event_secrets.checkin_code, excluded.checkin_code)
    returning checkin_code into v_code;
  end if;
  update public.event_secrets set code_revealed_at = coalesce(code_revealed_at, now()) where event_id = p_event;
  if v_notified is null then
    update public.event_secrets set code_notified_at = now() where event_id = p_event;
    perform public._notify(v, 'event_code', 'Kod obecności gotowy',
      'Jesteś na miejscu. Pokaż gościom kod QR: ' || v_code,
      jsonb_build_object('event_id', p_event, 'code', v_code), 'event_code:' || p_event);
  end if;
  return jsonb_build_object('code', v_code, 'notified', v_notified is null);
end $$;

create or replace function public.event_checkin(p_event uuid, p_code text, p_lat float8 default null, p_lng float8 default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); e record; v_lat float8; v_lng float8;
begin
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'not_found'; end if;
  if e.organizer_id = v then raise exception 'organizer_cannot_checkin'; end if;
  if now() < e.starts_at then raise exception 'too_early'; end if;
  if now() > e.starts_at + interval '4 hours' then raise exception 'event_closed'; end if;
  if not exists (select 1 from public.event_participants where event_id = p_event and user_id = v and status in ('joined','attended')) then
    raise exception 'not_joined';
  end if;
  if upper(trim(p_code)) <> (select checkin_code from public.event_secrets where event_id = p_event) then raise exception 'invalid_code'; end if;
  select lat, lng into v_lat, v_lng from public._event_venue(p_event);
  if v_lat is null or v_lng is null then raise exception 'no_venue_coords'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if not st_dwithin(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 400) then
    raise exception 'too_far_from_place';
  end if;
  update public.event_participants set status = 'attended', attended_at = coalesce(attended_at, now())
    where event_id = p_event and user_id = v and status = 'joined';
  if not found then return jsonb_build_object('attended', true, 'already', true); end if;
  perform public._award_xp(v, 25, 'event_attendance', p_event, e.title);
  perform public._evaluate_badges(v);
  return jsonb_build_object('attended', true);
end $$;

create table if not exists public.event_play (
  event_id uuid primary key references public.events(id) on delete cascade,
  game_key text,
  round_no int not null default 1,
  status text not null default 'lobby',
  notice text,
  updated_at timestamptz not null default now()
);

create table if not exists public.event_question_draws (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_no int not null,
  question text not null,
  answered_at timestamptz,
  primary key (event_id, user_id, round_no)
);

create table if not exists public.event_find_picks (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  names text[] not null default '{}',
  primary key (event_id, user_id, prompt)
);

alter table public.event_play enable row level security;
alter table public.event_question_draws enable row level security;
alter table public.event_find_picks enable row level security;
revoke all on public.event_play from public, anon, authenticated;
revoke all on public.event_question_draws from public, anon, authenticated;
revoke all on public.event_find_picks from public, anon, authenticated;

create or replace function public._event_plan_games(p_event uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k order by ord), '{}'::text[])
  from (
    select 'questions'::text as k, 1 as ord
    where exists (
      select 1 from public.event_attractions a
      where a.event_id = p_event and a.category = 'questions'
        and a.title not in ('Notatka organizatora', 'Pytania na osobę')
    )
    union all
    select 'two-truths', 2
    where exists (select 1 from public.event_attractions a where a.event_id = p_event and a.title = 'Dwie prawdy i jedno kłamstwo')
    union all
    select 'find-someone', 3
    where exists (select 1 from public.event_attractions a where a.event_id = p_event and a.title = 'Znajdź kogoś, kto…')
    union all
    select 'runaway-story', 4
    where exists (select 1 from public.event_attractions a where a.event_id = p_event and a.title = 'Historia, która wymknęła się spod kontroli')
  ) s;
$$;

create or replace function public._event_play_member(p_event uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  if not (
    public.is_event_member(p_event)
    or exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v)
  ) then
    raise exception 'story_members_only';
  end if;
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
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.event_play_start(p_event uuid, p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  if not (p_game = any (public._event_plan_games(p_event))) then raise exception 'play_not_live'; end if;
  insert into public.event_play (event_id, game_key, round_no, status, notice, updated_at)
  values (p_event, p_game, 1, 'live', null, now())
  on conflict (event_id) do update
    set game_key = excluded.game_key, round_no = 1, status = 'live', notice = null, updated_at = now();
  return public.event_play_board(p_event);
end $$;

create or replace function public._event_play_advance(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  play public.event_play%rowtype;
  v_limit int := 1;
  games text[];
  idx int;
  nxt text;
  nxt_name text;
begin
  select * into play from public.event_play where event_id = p_event for update;
  if play.event_id is null or play.game_key is distinct from 'questions' then return; end if;
  if exists (
    select 1 from public.event_participants ep
    where ep.event_id = p_event and ep.status in ('joined', 'attended')
      and not exists (
        select 1 from public.event_question_draws d
        where d.event_id = p_event and d.user_id = ep.user_id and d.round_no = play.round_no and d.answered_at is not null
      )
  ) then
    return;
  end if;
  select case when body ~ '^[0-9]+$' then least(10, greatest(1, body::int)) else 1 end into v_limit
    from public.event_attractions where event_id = p_event and title = 'Pytania na osobę' limit 1;
  v_limit := coalesce(v_limit, 1);
  if play.round_no < v_limit then
    update public.event_play set round_no = round_no + 1, notice = 'Kolejna seria pytań.', updated_at = now() where event_id = p_event;
    return;
  end if;
  games := public._event_plan_games(p_event);
  idx := array_position(games, 'questions');
  nxt := case when idx is null or idx >= cardinality(games) then null else games[idx + 1] end;
  nxt_name := case nxt
    when 'two-truths' then 'Dwie prawdy i jedno kłamstwo'
    when 'find-someone' then 'Znajdź kogoś, kto…'
    when 'runaway-story' then 'Historia, która wymknęła się spod kontroli'
    else null end;
  if nxt is null then
    update public.event_play set status = 'finished', game_key = null, notice = 'Zabawy z planu są skończone.', updated_at = now() where event_id = p_event;
  else
    update public.event_play
      set game_key = nxt, round_no = 1, status = 'live',
          notice = 'Zaczyna się właśnie kolejna zabawa: ' || nxt_name || '.',
          updated_at = now()
    where event_id = p_event;
  end if;
end $$;

create or replace function public.event_play_draw(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  play public.event_play%rowtype;
  v_turn uuid;
  v_q text;
begin
  perform public._event_play_member(p_event);
  select * into play from public.event_play where event_id = p_event for update;
  if play.status is distinct from 'live' or play.game_key is distinct from 'questions' then raise exception 'play_not_live'; end if;
  select s.user_id into v_turn
    from (
      select ep.user_id, row_number() over (order by ep.joined_at, ep.user_id) as n
        from public.event_participants ep
       where ep.event_id = p_event and ep.status in ('joined', 'attended')
    ) s
   where not exists (
     select 1 from public.event_question_draws d
      where d.event_id = p_event and d.user_id = s.user_id and d.round_no = play.round_no and d.answered_at is not null
   )
   order by s.n limit 1;
  if v_turn is distinct from v then raise exception 'not_your_turn'; end if;
  select question into v_q from public.event_question_draws
   where event_id = p_event and user_id = v and round_no = play.round_no;
  if v_q is null then
    select a.title into v_q
      from public.event_attractions a
     where a.event_id = p_event and a.category = 'questions'
       and a.title not in ('Notatka organizatora', 'Pytania na osobę')
       and not exists (
         select 1 from public.event_question_draws d
          where d.event_id = p_event and d.user_id = v and d.question = a.title
       )
     order by random() limit 1;
    if v_q is null then raise exception 'no_questions_left'; end if;
    insert into public.event_question_draws (event_id, user_id, round_no, question) values (p_event, v, play.round_no, v_q);
  end if;
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_play_answered(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); play public.event_play%rowtype;
begin
  perform public._event_play_member(p_event);
  select * into play from public.event_play where event_id = p_event for update;
  if play.status is distinct from 'live' or play.game_key is distinct from 'questions' then raise exception 'play_not_live'; end if;
  update public.event_question_draws set answered_at = coalesce(answered_at, now())
   where event_id = p_event and user_id = v and round_no = play.round_no;
  if not found then raise exception 'not_your_turn'; end if;
  perform public._event_play_advance(p_event);
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_find_save(p_event uuid, p_prompt text, p_names text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); clean text[];
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'find-someone') then
    raise exception 'play_not_live';
  end if;
  select coalesce(array_agg(n), '{}') into clean
    from (
      select left(trim(x), 80) as n
      from unnest(coalesce(p_names, '{}')) as x
      where char_length(trim(x)) > 0
      limit 12
    ) s;
  insert into public.event_find_picks (event_id, user_id, prompt, names)
  values (p_event, v, left(trim(p_prompt), 500), clean)
  on conflict (event_id, user_id, prompt) do update set names = excluded.names;
  return public.event_play_board(p_event);
end $$;

revoke all on function public._event_plan_games(uuid) from public, anon;
revoke all on function public._event_play_member(uuid) from public, anon;
revoke all on function public._event_play_advance(uuid) from public, anon;
revoke all on function public.event_play_board(uuid) from public, anon;
revoke all on function public.event_play_start(uuid, text) from public, anon;
revoke all on function public.event_play_draw(uuid) from public, anon;
revoke all on function public.event_play_answered(uuid) from public, anon;
revoke all on function public.event_find_save(uuid, text, text[]) from public, anon;
grant execute on function public.event_play_board(uuid) to authenticated;
grant execute on function public.event_play_start(uuid, text) to authenticated;
grant execute on function public.event_play_draw(uuid) to authenticated;
grant execute on function public.event_play_answered(uuid) to authenticated;
grant execute on function public.event_find_save(uuid, text, text[]) to authenticated;

notify pgrst, 'reload schema';

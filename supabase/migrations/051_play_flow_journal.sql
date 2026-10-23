-- Kolejna zabawa po zakończeniu rundy, kolejka historii bez osób które wyszły,
-- głosowania, zamknięcie spotkania i podsumowanie w dzienniku.

create table if not exists public.event_story_leaves (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create table if not exists public.event_story_votes (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('end', 'restart')),
  want boolean not null,
  primary key (event_id, user_id, kind)
);
alter table public.event_story_leaves enable row level security;
alter table public.event_story_votes enable row level security;
revoke all on public.event_story_leaves from public, anon, authenticated;
revoke all on public.event_story_votes from public, anon, authenticated;

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
        and a.title not like 'Nagłówek:%'
        and a.title not like 'Treść:%'
        and a.title not like 'Początek historii:%'
    )
    union all
    select 'two-truths', 2
    where exists (select 1 from public.event_attractions a where a.event_id = p_event and a.title = 'Dwie prawdy i jedno kłamstwo')
    union all
    select 'find-someone', 3
    where exists (select 1 from public.event_attractions a where a.event_id = p_event and a.title = 'Znajdź kogoś, kto…')
    union all
    select 'runaway-story', 4
    where exists (
      select 1 from public.event_attractions a
      where a.event_id = p_event
        and (a.title = 'Historia, która wymknęła się spod kontroli' or a.title like 'Początek historii:%')
    )
  ) s;
$$;

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
    select case when btrim(coalesce(a.body, '')) <> '' and a.body <> 'własne' then a.body else a.title end
      into v_q
      from public.event_attractions a
     where a.event_id = p_event and a.category = 'questions'
       and a.title not in ('Notatka organizatora', 'Pytania na osobę')
       and a.title not like 'Początek historii:%'
       and a.title not like 'Nagłówek:%'
       and a.title not like 'Treść:%'
       and a.title not in (
         'Sąsiad i nielegalny biznes', 'Tajemnica dziadka', 'List z przyszłości', 'Pokój numer cztery',
         'CV do mafii', 'Kebab i państwo na Bałkanach', 'Tajny eksperymentalny oddział', 'Obrażony gołąb',
         'Czarodziej i regulamin', 'Cesarz planety', 'Nieznajomy z autobusu', 'Tajemnicza prezentacja',
         'Siedem puszek fasoli', 'Pięćdziesiąt tysięcy i trzy zęby', 'Basen ratujący świat', 'Traktor w centrum handlowym'
       )
       and not exists (
         select 1 from public.event_question_draws d
          where d.event_id = p_event
            and d.question = case when btrim(coalesce(a.body, '')) <> '' and a.body <> 'własne' then a.body else a.title end
       )
     order by random() limit 1;
    if v_q is null then raise exception 'no_questions_left'; end if;
    insert into public.event_question_draws (event_id, user_id, round_no, question) values (p_event, v, play.round_no, v_q);
  end if;
  return public.event_play_board(p_event);
end $$;

create or replace function public._event_play_next_game(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  play public.event_play%rowtype;
  games text[];
  idx int;
  nxt text;
  nxt_name text;
begin
  select * into play from public.event_play where event_id = p_event for update;
  if play.event_id is null or play.status is distinct from 'live' then return; end if;
  games := public._event_plan_games(p_event);
  idx := array_position(games, play.game_key);
  nxt := case when idx is null or idx >= cardinality(games) then null else games[idx + 1] end;
  nxt_name := case nxt
    when 'questions' then 'Zabawa w pytania'
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

create or replace function public._event_play_advance(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  play public.event_play%rowtype;
  v_limit int := 1;
begin
  select * into play from public.event_play where event_id = p_event for update;
  if play.event_id is null or play.status is distinct from 'live' then return; end if;
  if play.game_key = 'questions' then
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
    perform public._event_play_next_game(p_event);
    return;
  end if;
  if play.game_key = 'two-truths' then
    if public._event_truth_phase(p_event) < 3 then return; end if;
    perform public._event_play_next_game(p_event);
    return;
  end if;
  if play.game_key = 'find-someone' then
    if public._event_find_phase(p_event) < 3 then return; end if;
    perform public._event_play_next_game(p_event);
  end if;
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
  ranking jsonb := '[]'::jsonb;
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
    select coalesce(jsonb_agg(jsonb_build_object('id', s.user_id, 'name', s.name, 'score', s.score) order by s.score desc, s.name), '[]'::jsonb)
      into ranking
      from (
        select ep.user_id, coalesce(p.display_name, 'Yummiteer') as name, coalesce((
          select sum(case when exists (
            select 1 from public.event_find_answers a2
              join public.profiles p2 on p2.id = a2.user_id
             where a2.event_id = p_event and a2.prompt = a.prompt and a2.yes_saved and a2.yes is true
               and lower(trim(coalesce(p2.display_name, ''))) = lower(trim(g.guess))
          ) then 1 else -1 end)
          from public.event_find_answers a
          left join lateral unnest(coalesce(a.names, '{}')) as g(guess) on true
         where a.event_id = p_event and a.user_id = ep.user_id and a.names_saved
        ), 0) as score
        from public.event_participants ep
        join public.profiles p on p.id = ep.user_id
       where ep.event_id = p_event and ep.status in ('joined', 'attended')
      ) s;
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
    'reveal', case when phase = 3 then reveal else null end,
    'ranking', case when phase = 3 then ranking else null end
  );
end $$;


create or replace function public._event_story_active(p_event uuid)
returns table(user_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.n
  from (
    select ep.user_id, row_number() over (order by ep.joined_at, ep.user_id) as n
      from public.event_participants ep
     where ep.event_id = p_event and ep.status in ('joined', 'attended')
       and not exists (select 1 from public.event_story_leaves l where l.event_id = p_event and l.user_id = ep.user_id)
  ) s;
$$;

create or replace function public.event_story_board(p_event uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := auth.uid();
  v_turn uuid;
  v_count int;
  v_seats int;
  v_left int;
  v_members int;
  v_closed boolean;
begin
  if v is null then raise exception 'not_authenticated'; end if;
  perform public._event_play_member(p_event);
  select count(*) into v_count from public.event_story_lines where event_id = p_event;
  select count(*) into v_members from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended');
  select count(*) into v_left from public.event_story_leaves where event_id = p_event;
  select count(*) into v_seats from public._event_story_active(p_event);
  if v_seats > 0 then
    select s.user_id into v_turn
      from public._event_story_active(p_event) s
     where (s.n - 1) = (v_count % v_seats);
  end if;
  v_closed := exists (select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null);
  return jsonb_build_object(
    'closed', v_closed,
    'your_turn', v_turn is not distinct from v,
    'turn_user_id', v_turn,
    'turn_name', (select display_name from public.profiles where id = v_turn),
    'left', exists (select 1 from public.event_story_leaves l where l.event_id = p_event and l.user_id = v),
    'left_count', coalesce(v_left, 0),
    'member_count', coalesce(v_members, 0),
    'majority_left', coalesce(v_left, 0) * 2 > coalesce(v_members, 0),
    'end_yes', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'end' and want),
    'end_no', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'end' and not want),
    'my_end_vote', (select want from public.event_story_votes where event_id = p_event and user_id = v and kind = 'end'),
    'restart_yes', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'restart' and want),
    'restart_no', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'restart' and not want),
    'my_restart_vote', (select want from public.event_story_votes where event_id = p_event and user_id = v and kind = 'restart'),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'body', l.body, 'author_id', l.author_id,
        'author', coalesce(p.display_name, 'Uczestnik'), 'created_at', l.created_at
      ) order by l.created_at)
      from public.event_story_lines l
      left join public.profiles p on p.id = l.author_id
      where l.event_id = p_event
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.event_story_add(p_event uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_body text := trim(coalesce(p_body, ''));
  v_turn uuid;
  v_count int;
  v_seats int;
  v_id uuid;
  v_last text;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 1200 then raise exception 'invalid_line'; end if;
  perform public._event_play_member(p_event);
  perform 1 from public.events where id = p_event for update;
  if exists (select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null) then
    raise exception 'story_closed';
  end if;
  if exists (select 1 from public.event_story_leaves l where l.event_id = p_event and l.user_id = v) then
    raise exception 'not_your_turn';
  end if;
  select count(*) into v_count from public.event_story_lines where event_id = p_event;
  select count(*) into v_seats from public._event_story_active(p_event);
  if v_seats < 1 then raise exception 'story_members_only'; end if;
  select s.user_id into v_turn from public._event_story_active(p_event) s where (s.n - 1) = (v_count % v_seats);
  if v_turn is distinct from v then raise exception 'not_your_turn'; end if;
  select l.body into v_last from public.event_story_lines l where l.event_id = p_event order by l.created_at desc limit 1;
  if v_last is not null and v_last = v_body then raise exception 'duplicate_line'; end if;
  insert into public.event_story_lines (event_id, author_id, body) values (p_event, v, v_body) returning id into v_id;
  return v_id;
end $$;

create or replace function public.event_story_draw_line(p_event uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 1200 then raise exception 'invalid_line'; end if;
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  perform 1 from public.events where id = p_event for update;
  if exists (select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null) then
    raise exception 'story_closed';
  end if;
  if exists (select 1 from public.event_story_lines where event_id = p_event) then
    raise exception 'not_your_turn';
  end if;
  insert into public.event_story_lines (event_id, author_id, body) values (p_event, v, v_body) returning id into v_id;
  return v_id;
end $$;

create or replace function public.event_story_leave(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_left int;
  v_members int;
begin
  perform public._event_play_member(p_event);
  insert into public.event_story_leaves (event_id, user_id) values (p_event, v)
  on conflict do nothing;
  select count(*) into v_members from public.event_participants where event_id = p_event and status in ('joined', 'attended');
  select count(*) into v_left from public.event_story_leaves where event_id = p_event;
  if v_left >= v_members then
    insert into public.event_story_sessions (event_id, closed_at) values (p_event, now())
    on conflict (event_id) do update set closed_at = coalesce(public.event_story_sessions.closed_at, now());
  end if;
  return public.event_story_board(p_event);
end $$;

create or replace function public.event_story_vote(p_event uuid, p_kind text, p_want boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  perform public._event_play_member(p_event);
  if p_kind not in ('end', 'restart') then raise exception 'invalid_kind'; end if;
  insert into public.event_story_votes (event_id, user_id, kind, want) values (p_event, v, p_kind, p_want)
  on conflict (event_id, user_id, kind) do update set want = excluded.want;
  return public.event_story_board(p_event);
end $$;

create or replace function public.event_story_restart(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  delete from public.event_story_lines where event_id = p_event;
  delete from public.event_story_leaves where event_id = p_event
    and user_id in (select user_id from public.event_story_votes where event_id = p_event and kind = 'restart' and want);
  insert into public.event_story_leaves (event_id, user_id)
    select p_event, ep.user_id
      from public.event_participants ep
     where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
       and not exists (
         select 1 from public.event_story_votes vt
          where vt.event_id = p_event and vt.user_id = ep.user_id and vt.kind = 'restart' and vt.want
       )
  on conflict do nothing;
  delete from public.event_story_votes where event_id = p_event;
  insert into public.event_story_sessions (event_id, closed_at) values (p_event, null)
  on conflict (event_id) do update set closed_at = null;
  return public.event_story_board(p_event);
end $$;

create or replace function public.event_play_next(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  perform public._event_play_next_game(p_event);
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_finish_meeting(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  update public.events set status = 'finished', updated_at = now() where id = p_event;
  update public.event_play set status = 'finished', notice = 'Spotkanie zakończone.', updated_at = now() where event_id = p_event;
end $$;

create or replace function public.my_meeting_journal(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  return coalesce((
    select jsonb_agg(row_data order by sort_at desc)
    from (
      select e.starts_at as sort_at, jsonb_build_object(
        'id', e.id, 'title', e.title, 'description', e.description, 'theme', e.theme, 'rules', e.rules,
        'kind', e.kind, 'place_name', e.place_name, 'starts_at', e.starts_at, 'status', e.status,
        'my_status', coalesce(ep.status, case when e.organizer_id = v then 'organizer' else null end),
        'capacity', e.capacity, 'seats_taken', e.seats_taken,
        'attractions', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'category', a.category, 'title', a.title, 'body', a.body) order by a.created_at)
          from public.event_attractions a where a.event_id = e.id
        ), '[]'::jsonb),
        'photos', coalesce((
          select jsonb_agg(jsonb_build_object('id', ph.id, 'photo_url', ph.photo_url, 'created_at', ph.created_at) order by ph.created_at)
          from public.event_photos ph where ph.event_id = e.id
        ), '[]'::jsonb),
        'story', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'body', l.body, 'author_id', l.author_id,
            'author', coalesce(p.display_name, 'Uczestnik'), 'created_at', l.created_at
          ) order by l.created_at)
          from public.event_story_lines l
          left join public.profiles p on p.id = l.author_id
          where l.event_id = e.id
        ), '[]'::jsonb),
        'question_draws', coalesce((
          select jsonb_agg(jsonb_build_object('name', coalesce(p.display_name, 'Uczestnik'), 'question', d.question, 'round', d.round_no) order by d.round_no, p.display_name)
          from public.event_question_draws d
          join public.profiles p on p.id = d.user_id
          where d.event_id = e.id
        ), '[]'::jsonb),
        'truths', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', coalesce(p.display_name, 'Uczestnik'),
            'truths', jsonb_build_array(
              case when l.lie = 0 then null else l.line1 end,
              case when l.lie = 1 then null else l.line2 end,
              case when l.lie = 2 then null else l.line3 end
            ),
            'lie', case l.lie when 0 then l.line1 when 1 then l.line2 else l.line3 end
          ) order by p.display_name)
          from public.event_truth_lines l
          join public.profiles p on p.id = l.user_id
          where l.event_id = e.id
        ), '[]'::jsonb),
        'find_answers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'prompt', a.prompt,
            'name', coalesce(p.display_name, 'Uczestnik'),
            'yes', a.yes
          ) order by a.prompt, p.display_name)
          from public.event_find_answers a
          join public.profiles p on p.id = a.user_id
          where a.event_id = e.id and a.yes_saved
        ), '[]'::jsonb),
        'find_scores', coalesce((
          select jsonb_agg(jsonb_build_object('name', s.name, 'score', s.score) order by s.score desc, s.name)
          from (
            select coalesce(p.display_name, 'Uczestnik') as name, coalesce((
              select sum(case when exists (
                select 1 from public.event_find_answers a2
                  join public.profiles p2 on p2.id = a2.user_id
                 where a2.event_id = e.id and a2.prompt = a.prompt and a2.yes_saved and a2.yes is true
                   and lower(trim(coalesce(p2.display_name, ''))) = lower(trim(g.guess))
              ) then 1 else -1 end)
              from public.event_find_answers a
              left join lateral unnest(coalesce(a.names, '{}')) as g(guess) on true
             where a.event_id = e.id and a.user_id = ep.user_id and a.names_saved
            ), 0) as score
            from public.event_participants ep
            join public.profiles p on p.id = ep.user_id
           where ep.event_id = e.id and ep.status in ('joined', 'attended')
          ) s
        ), '[]'::jsonb)
      ) as row_data
      from public.events e
      left join public.event_participants ep on ep.event_id = e.id and ep.user_id = v
      where e.organizer_id = v or ep.user_id is not null
      order by e.starts_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) q
  ), '[]'::jsonb);
end $$;

revoke all on function public._event_play_next_game(uuid) from public, anon;
revoke all on function public.event_story_leave(uuid) from public, anon;
revoke all on function public.event_story_vote(uuid, text, boolean) from public, anon;
revoke all on function public.event_story_restart(uuid) from public, anon;
revoke all on function public.event_finish_meeting(uuid) from public, anon;
grant execute on function public.event_story_leave(uuid) to authenticated;
grant execute on function public.event_story_vote(uuid, text, boolean) to authenticated;
grant execute on function public.event_story_restart(uuid) to authenticated;
grant execute on function public.event_finish_meeting(uuid) to authenticated;
grant execute on function public.event_play_next(uuid) to authenticated;
grant execute on function public.event_play_draw(uuid) to authenticated;
grant execute on function public.event_story_board(uuid) to authenticated;
grant execute on function public.event_story_add(uuid, text) to authenticated;
grant execute on function public.event_story_draw_line(uuid, text) to authenticated;
grant execute on function public.my_meeting_journal(int) to authenticated;

notify pgrst, 'reload schema';

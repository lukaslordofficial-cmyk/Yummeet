-- Dwie prawdy na wielu telefonach: zdania, typowanie prawda/fałsz, zgoda na nagrodę.
-- Pula pytań losuje treść z body, gdy organizator dodał zdanie startowe historii.
-- Ocena organizatora jest dostępna dla uczestnika także przed startem spotkania.

create table if not exists public.event_truth_lines (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  line1 text not null,
  line2 text not null,
  line3 text not null,
  lie smallint not null check (lie between 0 and 2),
  saved boolean not null default true,
  primary key (event_id, user_id)
);

create table if not exists public.event_truth_guesses (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  marks boolean[] not null,
  saved boolean not null default true,
  primary key (event_id, user_id, target_id),
  check (user_id <> target_id),
  check (cardinality(marks) = 3)
);

create table if not exists public.event_truth_stakes (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agreed boolean not null,
  primary key (event_id, user_id)
);

alter table public.event_truth_lines enable row level security;
alter table public.event_truth_guesses enable row level security;
alter table public.event_truth_stakes enable row level security;
revoke all on public.event_truth_lines from public, anon, authenticated;
revoke all on public.event_truth_guesses from public, anon, authenticated;
revoke all on public.event_truth_stakes from public, anon, authenticated;

create or replace function public._event_truth_phase(p_event uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  members int;
  ready int;
  guessers int;
begin
  select count(*) into members
    from public.event_participants
   where event_id = p_event and status in ('joined', 'attended');
  if coalesce(members, 0) < 2 then return 1; end if;
  select count(*) into ready
    from public.event_truth_lines l
    join public.event_participants ep on ep.event_id = l.event_id and ep.user_id = l.user_id
   where l.event_id = p_event and l.saved and ep.status in ('joined', 'attended');
  if ready < members then return 1; end if;
  select count(*) into guessers
    from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended')
     and not exists (
       select 1 from public.event_participants other
        where other.event_id = p_event
          and other.status in ('joined', 'attended')
          and other.user_id <> ep.user_id
          and not exists (
            select 1 from public.event_truth_guesses g
             where g.event_id = p_event and g.user_id = ep.user_id and g.target_id = other.user_id and g.saved
          )
     );
  if guessers < members then return 2; end if;
  return 3;
end $$;

create or replace function public._event_truth_state(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid := auth.uid();
  phase int := public._event_truth_phase(p_event);
  members int := 0;
  yes_count int := 0;
  mine_saved boolean := false;
  guesses_saved boolean := false;
  others jsonb := '[]'::jsonb;
  rec record;
  pts int;
  line_pts int[];
  i int;
  actual boolean;
  guess boolean;
  total int := 0;
begin
  select count(*) into members
    from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended');
  select count(*) into yes_count
    from public.event_truth_stakes s
    join public.event_participants ep on ep.event_id = s.event_id and ep.user_id = s.user_id
   where s.event_id = p_event and s.agreed and ep.status in ('joined', 'attended');
  select exists (
    select 1 from public.event_truth_lines l
     where l.event_id = p_event and l.user_id = v and l.saved
  ) into mine_saved;
  select not exists (
    select 1 from public.event_participants ep
     where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
       and not exists (
         select 1 from public.event_truth_guesses g
          where g.event_id = p_event and g.user_id = v and g.target_id = ep.user_id and g.saved
       )
  ) into guesses_saved;

  if phase >= 2 then
    for rec in
      select ep.user_id, coalesce(p.display_name, 'Yummiteer') as name,
             l.line1, l.line2, l.line3, l.lie, g.marks
        from public.event_participants ep
        join public.profiles p on p.id = ep.user_id
        join public.event_truth_lines l on l.event_id = p_event and l.user_id = ep.user_id and l.saved
        left join public.event_truth_guesses g on g.event_id = p_event and g.user_id = v and g.target_id = ep.user_id
       where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
       order by ep.joined_at, ep.user_id
    loop
      pts := 0;
      line_pts := array[0, 0, 0];
      if phase >= 3 and rec.marks is not null then
        for i in 1..3 loop
          actual := (i - 1) is distinct from rec.lie;
          guess := rec.marks[i];
          if guess is not distinct from actual then
            pts := pts + 1;
            line_pts[i] := 1;
          else
            pts := pts - 1;
            line_pts[i] := -1;
          end if;
        end loop;
        total := total + pts;
      end if;
      others := others || jsonb_build_array(jsonb_build_object(
        'id', rec.user_id,
        'name', rec.name,
        'lines', jsonb_build_array(rec.line1, rec.line2, rec.line3),
        'guesses', case when rec.marks is null then '[]'::jsonb else to_jsonb(rec.marks) end,
        'truth', case when phase >= 3 then jsonb_build_array((rec.lie <> 0), (rec.lie <> 1), (rec.lie <> 2)) else null end,
        'line_points', case when phase >= 3 and rec.marks is not null then to_jsonb(line_pts) else null end,
        'points', case when phase >= 3 and rec.marks is not null then pts else null end
      ));
    end loop;
  end if;

  return jsonb_build_object(
    'phase', phase,
    'saved', case when phase <= 1 then mine_saved else guesses_saved end,
    'lines_saved', mine_saved,
    'guesses_saved', case when phase >= 2 then guesses_saved else false end,
    'all_saved', phase >= 2,
    'score', case when phase >= 3 then total else null end,
    'stake', jsonb_build_object(
      'mine', (select s.agreed from public.event_truth_stakes s where s.event_id = p_event and s.user_id = v),
      'yes', yes_count,
      'total', members,
      'unanimous', members > 0 and yes_count = members
    ),
    'mine', (
      select jsonb_build_object('lines', jsonb_build_array(l.line1, l.line2, l.line3), 'lie', l.lie)
      from public.event_truth_lines l
      where l.event_id = p_event and l.user_id = v
    ),
    'others', others
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
      select jsonb_agg(
        case when btrim(coalesce(a.body, '')) <> '' and a.body <> 'własne' then a.body else a.title end
        order by a.created_at
      )
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
    'find', public._event_find_state(p_event),
    'truths', public._event_truth_state(p_event)
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
  elsif p_game = 'two-truths' then
    v_round := public._event_truth_phase(p_event);
  end if;
  insert into public.event_play (event_id, game_key, round_no, status, notice, updated_at)
  values (p_event, p_game, v_round, 'live', null, now())
  on conflict (event_id) do update
    set game_key = excluded.game_key, round_no = excluded.round_no, status = 'live', notice = null, updated_at = now();
  return public.event_play_board(p_event);
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
    select case when btrim(coalesce(a.body, '')) <> '' and a.body <> 'własne' then a.body else a.title end
      into v_q
      from public.event_attractions a
     where a.event_id = p_event and a.category = 'questions'
       and a.title not in ('Notatka organizatora', 'Pytania na osobę')
       and not exists (
         select 1 from public.event_question_draws d
          where d.event_id = p_event and d.user_id = v
            and d.question = case when btrim(coalesce(a.body, '')) <> '' and a.body <> 'własne' then a.body else a.title end
       )
     order by random() limit 1;
    if v_q is null then raise exception 'no_questions_left'; end if;
    insert into public.event_question_draws (event_id, user_id, round_no, question) values (p_event, v, play.round_no, v_q);
  end if;
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_truth_submit(p_event uuid, p_lines jsonb, p_lie int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  l1 text;
  l2 text;
  l3 text;
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'two-truths') then
    raise exception 'play_not_live';
  end if;
  if public._event_truth_phase(p_event) <> 1 then raise exception 'play_not_live'; end if;
  if p_lie is null or p_lie not between 0 and 2 then raise exception 'truth_incomplete'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) <> 3 then raise exception 'truth_incomplete'; end if;
  l1 := btrim(p_lines->>0);
  l2 := btrim(p_lines->>1);
  l3 := btrim(p_lines->>2);
  if char_length(l1) < 2 or char_length(l2) < 2 or char_length(l3) < 2
     or char_length(l1) > 400 or char_length(l2) > 400 or char_length(l3) > 400 then
    raise exception 'truth_incomplete';
  end if;
  insert into public.event_truth_lines (event_id, user_id, line1, line2, line3, lie, saved)
  values (p_event, v, l1, l2, l3, p_lie, true)
  on conflict (event_id, user_id) do update
    set line1 = excluded.line1, line2 = excluded.line2, line3 = excluded.line3, lie = excluded.lie, saved = true;
  update public.event_play
     set round_no = public._event_truth_phase(p_event), updated_at = now()
   where event_id = p_event;
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_truth_guess(p_event uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  rec record;
  rowj jsonb;
  marks boolean[];
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'two-truths') then
    raise exception 'play_not_live';
  end if;
  if public._event_truth_phase(p_event) <> 2 then raise exception 'play_not_live'; end if;
  for rec in
    select ep.user_id
      from public.event_participants ep
     where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
  loop
    select elem into rowj
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem
     where elem->>'target' = rec.user_id::text
     limit 1;
    if rowj is null or jsonb_typeof(rowj->'marks') <> 'array' or jsonb_array_length(rowj->'marks') <> 3 then
      raise exception 'truth_incomplete';
    end if;
    if (rowj#>>'{marks,0}') is null or (rowj#>>'{marks,1}') is null or (rowj#>>'{marks,2}') is null then
      raise exception 'truth_incomplete';
    end if;
    marks := array[
      (rowj#>>'{marks,0}')::boolean,
      (rowj#>>'{marks,1}')::boolean,
      (rowj#>>'{marks,2}')::boolean
    ];
    insert into public.event_truth_guesses (event_id, user_id, target_id, marks, saved)
    values (p_event, v, rec.user_id, marks, true)
    on conflict (event_id, user_id, target_id) do update
      set marks = excluded.marks, saved = true;
  end loop;
  update public.event_play
     set round_no = public._event_truth_phase(p_event), updated_at = now()
   where event_id = p_event;
  return public.event_play_board(p_event);
end $$;

create or replace function public.event_truth_stake(p_event uuid, p_agreed boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'two-truths') then
    raise exception 'play_not_live';
  end if;
  if p_agreed is null then raise exception 'truth_incomplete'; end if;
  insert into public.event_truth_stakes (event_id, user_id, agreed)
  values (p_event, v, p_agreed)
  on conflict (event_id, user_id) do update set agreed = excluded.agreed;
  return public.event_play_board(p_event);
end $$;

create or replace function public.save_organizer_review(
  p_event uuid,
  p_hospitality smallint,
  p_organization smallint,
  p_atmosphere smallint,
  p_communication smallint,
  p_tip text default null,
  p_body text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  e record;
  v_id uuid;
begin
  if p_hospitality not between 1 and 5 or p_organization not between 1 and 5
     or p_atmosphere not between 1 and 5 or p_communication not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'not_found'; end if;
  if e.organizer_id is null then raise exception 'no_organizer'; end if;
  if e.organizer_id = v then raise exception 'cannot_review_self'; end if;
  if not exists (
    select 1 from public.event_participants
    where event_id = p_event and user_id = v and status in ('joined', 'attended')
  ) then
    raise exception 'not_joined';
  end if;
  insert into public.organizer_reviews (
    event_id, organizer_id, reviewer_id, hospitality, organization, atmosphere, communication, tip, body
  ) values (
    p_event, e.organizer_id, v, p_hospitality, p_organization, p_atmosphere, p_communication,
    nullif(btrim(coalesce(p_tip, '')), ''), nullif(btrim(coalesce(p_body, '')), '')
  )
  on conflict (event_id, reviewer_id) do update set
    hospitality = excluded.hospitality,
    organization = excluded.organization,
    atmosphere = excluded.atmosphere,
    communication = excluded.communication,
    tip = excluded.tip,
    body = excluded.body
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public._event_truth_phase(uuid) from public, anon;
revoke all on function public._event_truth_state(uuid) from public, anon;
revoke all on function public.event_truth_submit(uuid, jsonb, int) from public, anon;
revoke all on function public.event_truth_guess(uuid, jsonb) from public, anon;
revoke all on function public.event_truth_stake(uuid, boolean) from public, anon;
grant execute on function public._event_truth_phase(uuid) to authenticated;
grant execute on function public._event_truth_state(uuid) to authenticated;
grant execute on function public.event_play_board(uuid) to authenticated;
grant execute on function public.event_play_start(uuid, text) to authenticated;
grant execute on function public.event_play_draw(uuid) to authenticated;
grant execute on function public.event_truth_submit(uuid, jsonb, int) to authenticated;
grant execute on function public.event_truth_guess(uuid, jsonb) to authenticated;
grant execute on function public.event_truth_stake(uuid, boolean) to authenticated;
grant execute on function public.save_organizer_review(uuid, smallint, smallint, smallint, smallint, text, text) to authenticated;

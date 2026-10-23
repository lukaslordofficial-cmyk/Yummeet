-- Pary tytuł–instrukcja nie wymagają SQL.
-- Tu: Prawda czy kłamstwo (3–9 zdań, ranking), kolejność planu, punktacja Znajdź kogoś (wstrzymanie = 0).

alter table public.event_truth_lines
  add column if not exists lines text[];

update public.event_truth_lines
   set lines = array[line1, line2, line3]
 where lines is null or cardinality(lines) = 0;

do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'event_truth_lines'
       and pg_get_constraintdef(c.oid) ilike '%lie%'
  loop
    execute format('alter table public.event_truth_lines drop constraint if exists %I', r.conname);
  end loop;
  for r in
    select c.conname
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'event_truth_guesses'
       and pg_get_constraintdef(c.oid) ilike '%cardinality%'
  loop
    execute format('alter table public.event_truth_guesses drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.event_truth_lines
  add constraint event_truth_lines_lie_range check (lie between 0 and 8);
alter table public.event_truth_guesses
  add constraint event_truth_guesses_marks_len check (cardinality(marks) between 3 and 9);

create or replace function public._event_truth_limit(p_event uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select least(9, greatest(3, body::int))
      from public.event_attractions
     where event_id = p_event and title = 'Zdania prawda czy kłamstwo' and body ~ '^[0-9]+$'
     limit 1
  ), 3);
$$;

create or replace function public._event_plan_games(p_event uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k order by first_at, ord), '{}'::text[])
  from (
    select k, min(created_at) as first_at, min(ord) as ord
    from (
      select 'questions'::text as k, a.created_at, 1 as ord
        from public.event_attractions a
       where a.event_id = p_event and a.category = 'questions'
         and a.title not in ('Notatka organizatora', 'Pytania na osobę', 'Zdania prawda czy kłamstwo')
         and a.title not like 'Nagłówek:%'
         and a.title not like 'Treść:%'
         and a.title not like 'Początek historii:%'
      union all
      select 'two-truths', a.created_at, 2
        from public.event_attractions a
       where a.event_id = p_event
         and a.title in ('Prawda czy kłamstwo', 'Dwie prawdy i jedno kłamstwo')
      union all
      select 'find-someone', a.created_at, 3
        from public.event_attractions a
       where a.event_id = p_event
         and (a.title = 'Znajdź kogoś, kto…' or a.title like 'Znajdź kogoś: %')
      union all
      select 'runaway-story', a.created_at, 4
        from public.event_attractions a
       where a.event_id = p_event
         and (a.title = 'Historia, która wymknęła się spod kontroli' or a.title like 'Początek historii:%')
    ) raw
    group by k
  ) s;
$$;

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
    when 'two-truths' then 'Prawda czy kłamstwo'
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
  no_count int := 0;
  mine_saved boolean := false;
  guesses_saved boolean := false;
  others jsonb := '[]'::jsonb;
  ranking jsonb := '[]'::jsonb;
  rec record;
  pts int;
  line_pts int[];
  i int;
  n int;
  actual boolean;
  guess boolean;
  total int := 0;
  v_lines text[];
  v_limit int := public._event_truth_limit(p_event);
begin
  select count(*) into members
    from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended');
  select count(*) into yes_count
    from public.event_truth_stakes s
    join public.event_participants ep on ep.event_id = s.event_id and ep.user_id = s.user_id
   where s.event_id = p_event and s.agreed and ep.status in ('joined', 'attended');
  select count(*) into no_count
    from public.event_truth_stakes s
    join public.event_participants ep on ep.event_id = s.event_id and ep.user_id = s.user_id
   where s.event_id = p_event and not s.agreed and ep.status in ('joined', 'attended');
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
             l.line1, l.line2, l.line3, l.lines, l.lie, g.marks
        from public.event_participants ep
        join public.profiles p on p.id = ep.user_id
        join public.event_truth_lines l on l.event_id = p_event and l.user_id = ep.user_id and l.saved
        left join public.event_truth_guesses g on g.event_id = p_event and g.user_id = v and g.target_id = ep.user_id
       where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
       order by ep.joined_at, ep.user_id
    loop
      v_lines := coalesce(nullif(rec.lines, '{}'::text[]), array[rec.line1, rec.line2, rec.line3]);
      n := cardinality(v_lines);
      pts := 0;
      line_pts := array_fill(0, array[greatest(n, 1)]);
      if phase >= 3 and rec.marks is not null then
        for i in 1..n loop
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
        'lines', to_jsonb(v_lines),
        'guesses', case when rec.marks is null then '[]'::jsonb else to_jsonb(rec.marks) end,
        'truth', case when phase >= 3 then (
          select jsonb_agg((gs.i - 1) is distinct from rec.lie order by gs.i)
            from generate_series(1, n) as gs(i)
        ) else null end,
        'line_points', case when phase >= 3 and rec.marks is not null then to_jsonb(line_pts) else null end,
        'points', case when phase >= 3 and rec.marks is not null then pts else null end
      ));
    end loop;
  end if;

  if phase >= 3 then
    select coalesce(
      jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'score', r.score) order by r.score desc, r.joined_at, r.id),
      '[]'::jsonb
    )
      into ranking
      from (
        select ep.user_id as id,
               ep.joined_at,
               coalesce(p.display_name, 'Yummiteer') as name,
               coalesce((
                 select sum(
                   case
                     when ((i - 1) is distinct from l.lie) is not distinct from g.marks[i] then 1
                     else -1
                   end
                 )
                 from public.event_truth_guesses g
                 join public.event_truth_lines l
                   on l.event_id = g.event_id and l.user_id = g.target_id and l.saved
                 cross join generate_series(
                   1,
                   cardinality(coalesce(nullif(l.lines, '{}'::text[]), array[l.line1, l.line2, l.line3]))
                 ) as gs(i)
                 where g.event_id = p_event and g.user_id = ep.user_id and g.saved
               ), 0) as score
          from public.event_participants ep
          join public.profiles p on p.id = ep.user_id
         where ep.event_id = p_event and ep.status in ('joined', 'attended')
      ) r;
  end if;

  return jsonb_build_object(
    'phase', phase,
    'saved', case when phase <= 1 then mine_saved else guesses_saved end,
    'lines_saved', mine_saved,
    'guesses_saved', case when phase >= 2 then guesses_saved else false end,
    'all_saved', phase >= 2,
    'limit', v_limit,
    'score', case when phase >= 3 then total else null end,
    'stake', jsonb_build_object(
      'mine', (select s.agreed from public.event_truth_stakes s where s.event_id = p_event and s.user_id = v),
      'yes', yes_count,
      'no', no_count,
      'total', members,
      'unanimous', members > 0 and yes_count = members
    ),
    'mine', (
      select jsonb_build_object(
        'lines', to_jsonb(coalesce(nullif(l.lines, '{}'::text[]), array[l.line1, l.line2, l.line3])),
        'lie', l.lie
      )
      from public.event_truth_lines l
      where l.event_id = p_event and l.user_id = v
    ),
    'others', others,
    'ranking', ranking
  );
end $$;

create or replace function public.event_truth_submit(p_event uuid, p_lines jsonb, p_lie int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  n int := public._event_truth_limit(p_event);
  i int;
  arr text[] := '{}';
  chunk text;
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'two-truths') then
    raise exception 'play_not_live';
  end if;
  if public._event_truth_phase(p_event) <> 1 then raise exception 'play_not_live'; end if;
  if p_lie is null or p_lie < 0 or p_lie >= n then raise exception 'truth_incomplete'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) <> n then raise exception 'truth_incomplete'; end if;
  for i in 0..n - 1 loop
    chunk := btrim(p_lines->>i);
    if char_length(chunk) < 2 or char_length(chunk) > 400 then raise exception 'truth_incomplete'; end if;
    arr := arr || chunk;
  end loop;
  insert into public.event_truth_lines (event_id, user_id, line1, line2, line3, lines, lie, saved)
  values (p_event, v, arr[1], arr[2], arr[3], arr, p_lie, true)
  on conflict (event_id, user_id) do update
    set line1 = excluded.line1, line2 = excluded.line2, line3 = excluded.line3,
        lines = excluded.lines, lie = excluded.lie, saved = true;
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
  n int;
  v_lines text[];
begin
  perform public._event_play_member(p_event);
  if not exists (select 1 from public.event_play where event_id = p_event and status = 'live' and game_key = 'two-truths') then
    raise exception 'play_not_live';
  end if;
  if public._event_truth_phase(p_event) <> 2 then raise exception 'play_not_live'; end if;
  for rec in
    select ep.user_id, l.line1, l.line2, l.line3, l.lines
      from public.event_participants ep
      join public.event_truth_lines l on l.event_id = p_event and l.user_id = ep.user_id and l.saved
     where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
  loop
    v_lines := coalesce(nullif(rec.lines, '{}'::text[]), array[rec.line1, rec.line2, rec.line3]);
    n := cardinality(v_lines);
    select elem into rowj
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem
     where elem->>'target' = rec.user_id::text
     limit 1;
    if rowj is null or jsonb_typeof(rowj->'marks') <> 'array' or jsonb_array_length(rowj->'marks') <> n then
      raise exception 'truth_incomplete';
    end if;
    select coalesce(array_agg((t.elem::text in ('true', 't')) order by t.ord), '{}'::boolean[])
      into marks
      from jsonb_array_elements(rowj->'marks') with ordinality as t(elem, ord);
    if cardinality(marks) <> n then raise exception 'truth_incomplete'; end if;
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
        if said_yes is true then
          pts := pts + 1;
        elsif said_yes is false then
          pts := pts - 1;
        end if;
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
          select sum(
            case
              when a2.yes is true then 1
              when a2.yes is false then -1
              else 0
            end
          )
          from public.event_find_answers a
          cross join unnest(coalesce(a.names, '{}'::text[])) as g(guess)
          left join public.profiles p2
            on lower(trim(coalesce(p2.display_name, ''))) = lower(trim(g.guess))
          left join public.event_find_answers a2
            on a2.event_id = p_event and a2.prompt = a.prompt and a2.yes_saved and a2.user_id = p2.id
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

revoke all on function public._event_truth_limit(uuid) from public, anon;
grant execute on function public._event_truth_limit(uuid) to authenticated;

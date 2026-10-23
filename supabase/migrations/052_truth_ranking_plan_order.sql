-- Klasyfikacja Dwóch prawd oraz kolejność zabaw według dodania do planu.

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
         and a.title not in ('Notatka organizatora', 'Pytania na osobę')
         and a.title not like 'Nagłówek:%'
         and a.title not like 'Treść:%'
         and a.title not like 'Początek historii:%'
      union all
      select 'two-truths', a.created_at, 2
        from public.event_attractions a
       where a.event_id = p_event and a.title = 'Dwie prawdy i jedno kłamstwo'
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
  ranking jsonb := '[]'::jsonb;
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
                 cross join generate_series(1, 3) as gs(i)
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
    'others', others,
    'ranking', ranking
  );
end $$;

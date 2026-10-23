-- Kolejna zabawa dla wszystkich, rezygnacja z historii, trwałe zdjęcia spotkania, recap w dzienniku.

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists event_photos_event_idx on public.event_photos (event_id, created_at desc);
alter table public.event_photos enable row level security;
drop policy if exists event_photos_read on public.event_photos;
create policy event_photos_read on public.event_photos for select to authenticated
  using (
    public.is_event_member(event_id)
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );
drop policy if exists event_photos_insert on public.event_photos;
create policy event_photos_insert on public.event_photos for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and (
      public.is_event_member(event_id)
      or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
    )
  );
grant select, insert on public.event_photos to authenticated;

create table if not exists public.event_story_archive (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  session_no int not null,
  title text not null default 'Historia, która wymknęła się spod kontroli',
  lines jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  unique (event_id, session_no)
);
create index if not exists event_story_archive_event_idx on public.event_story_archive (event_id, session_no);
alter table public.event_story_archive enable row level security;
revoke all on public.event_story_archive from public, anon, authenticated;

create or replace function public._event_story_snapshot(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_no int;
  v_lines jsonb;
  v_title text := 'Historia, która wymknęła się spod kontroli';
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'body', l.body, 'author_id', l.author_id,
    'author', coalesce(p.display_name, 'Uczestnik'), 'created_at', l.created_at
  ) order by l.created_at), '[]'::jsonb)
    into v_lines
    from public.event_story_lines l
    left join public.profiles p on p.id = l.author_id
   where l.event_id = p_event;
  if v_lines is null or v_lines = '[]'::jsonb then return; end if;
  if exists (
    select 1 from public.event_story_archive a
     where a.event_id = p_event and a.lines = v_lines
  ) then return; end if;
  select coalesce(max(session_no), 0) + 1 into v_no from public.event_story_archive where event_id = p_event;
  insert into public.event_story_archive (event_id, session_no, title, lines)
  values (p_event, v_no, v_title, v_lines);
end $$;

create or replace function public._event_games_remaining(p_event uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  play public.event_play%rowtype;
  games text[];
  idx int;
begin
  select * into play from public.event_play where event_id = p_event;
  games := public._event_plan_games(p_event);
  if play.event_id is null then return coalesce(cardinality(games), 0) > 0; end if;
  if play.status is not distinct from 'finished' then return false; end if;
  idx := array_position(games, play.game_key);
  if idx is null then return coalesce(cardinality(games), 0) > 0; end if;
  return idx < cardinality(games);
end $$;

create or replace function public.event_play_next(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  play public.event_play%rowtype;
begin
  perform public._event_play_member(p_event);
  select * into play from public.event_play where event_id = p_event for update;
  if play.event_id is null or play.status is distinct from 'live' then
    return public.event_play_board(p_event);
  end if;
  if play.game_key = 'find-someone' and public._event_find_phase(p_event) < 3 then
    raise exception 'play_not_live';
  end if;
  if play.game_key = 'two-truths' and public._event_truth_phase(p_event) < 3 then
    raise exception 'play_not_live';
  end if;
  if play.game_key = 'questions' then
    perform public._event_play_advance(p_event);
  elsif play.game_key = 'runaway-story' then
    if not exists (
      select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null
    ) then
      raise exception 'play_not_live';
    end if;
    perform public._event_play_next_game(p_event);
  else
    perform public._event_play_next_game(p_event);
  end if;
  return public.event_play_board(p_event);
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
  v_org uuid;
begin
  perform public._event_play_member(p_event);
  select organizer_id into v_org from public.events where id = p_event;
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
    'games_remaining', public._event_games_remaining(p_event),
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
        and a.title not in ('Notatka organizatora', 'Pytania na osobę', 'Zdania prawda czy kłamstwo')
        and a.title not like 'Nagłówek:%'
        and a.title not like 'Treść:%'
        and a.title not like 'Początek historii:%'
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
    'truths', public._event_truth_state(p_event),
    'my_review', (
      select r.hospitality from public.organizer_reviews r
       where r.event_id = p_event and r.reviewer_id = v
       limit 1
    ),
    'can_rate', v is distinct from v_org and (
      (v_has and play.status = 'finished')
      or exists (select 1 from public.events e where e.id = p_event and e.status = 'finished')
    )
  );
end $$;

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
  v_org uuid;
  v_left_me boolean;
begin
  if v is null then raise exception 'not_authenticated'; end if;
  perform public._event_play_member(p_event);
  select organizer_id into v_org from public.events where id = p_event;
  select count(*) into v_count from public.event_story_lines where event_id = p_event;
  select count(*) into v_members from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended');
  select count(*) into v_left from public.event_story_leaves where event_id = p_event;
  select count(*) into v_seats from public._event_story_active(p_event);
  v_left_me := exists (select 1 from public.event_story_leaves l where l.event_id = p_event and l.user_id = v);
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
    'left', v_left_me,
    'hide_story', v_left_me and not v_closed,
    'left_count', coalesce(v_left, 0),
    'member_count', coalesce(v_members, 0),
    'active_count', coalesce(v_seats, 0),
    'majority_left', coalesce(v_left, 0) * 2 > coalesce(v_members, 0),
    'left_notice', case when v_left_me then null else (
      select string_agg(coalesce(p.display_name, 'Uczestnik') || ' zrezygnował z gry i gracie bez niego.', E'\n' order by l.created_at)
        from public.event_story_leaves l
        join public.profiles p on p.id = l.user_id
       where l.event_id = p_event
    ) end,
    'end_yes', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'end' and want),
    'end_no', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'end' and not want),
    'my_end_vote', (select want from public.event_story_votes where event_id = p_event and user_id = v and kind = 'end'),
    'restart_yes', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'restart' and want),
    'restart_no', (select count(*) from public.event_story_votes where event_id = p_event and kind = 'restart' and not want),
    'my_restart_vote', (select want from public.event_story_votes where event_id = p_event and user_id = v and kind = 'restart'),
    'close_prompt', v is not distinct from v_org
      and v_closed
      and exists (
        select 1 from public.event_story_votes vt
         where vt.event_id = p_event and vt.user_id = v and vt.kind = 'restart' and not vt.want
      )
      and not public._event_games_remaining(p_event),
    'lines', case when v_left_me and not v_closed then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'body', l.body, 'author_id', l.author_id,
        'author', coalesce(p.display_name, 'Uczestnik'), 'created_at', l.created_at
      ) order by l.created_at)
      from public.event_story_lines l
      left join public.profiles p on p.id = l.author_id
      where l.event_id = p_event
    ), '[]'::jsonb) end
  );
end $$;

create or replace function public.event_story_leave(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_name text;
  v_seats int;
begin
  perform public._event_play_member(p_event);
  if exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  insert into public.event_story_leaves (event_id, user_id) values (p_event, v)
  on conflict do nothing;
  select coalesce(display_name, 'Uczestnik') into v_name from public.profiles where id = v;
  update public.event_play
     set notice = v_name || ' zrezygnował z gry i gracie bez niego.', updated_at = now()
   where event_id = p_event;
  select count(*) into v_seats from public._event_story_active(p_event);
  if v_seats <= 1 then
    perform public._event_story_snapshot(p_event);
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

create or replace function public.event_story_close(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  perform public._event_story_snapshot(p_event);
  insert into public.event_story_sessions (event_id, closed_at) values (p_event, now())
  on conflict (event_id) do update set closed_at = coalesce(public.event_story_sessions.closed_at, now());
end $$;

create or replace function public.event_story_restart(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  perform public._event_story_snapshot(p_event);
  delete from public.event_story_lines where event_id = p_event;
  delete from public.event_story_leaves where event_id = p_event;
  insert into public.event_story_leaves (event_id, user_id)
    select p_event, ep.user_id
      from public.event_participants ep
     where ep.event_id = p_event and ep.status in ('joined', 'attended') and ep.user_id <> v
       and exists (
         select 1 from public.event_story_votes vt
          where vt.event_id = p_event and vt.user_id = ep.user_id and vt.kind = 'restart' and not vt.want
       )
  on conflict do nothing;
  delete from public.event_story_votes where event_id = p_event;
  insert into public.event_story_sessions (event_id, closed_at) values (p_event, null)
  on conflict (event_id) do update set closed_at = null;
  return public.event_story_board(p_event);
end $$;

create or replace function public.add_event_photo(p_event uuid, p_photo_url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_id uuid;
  v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
begin
  if v_photo is null or char_length(v_photo) < 8 then raise exception 'invalid_photo'; end if;
  if not (
    exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v)
    or public.is_event_member(p_event)
  ) then raise exception 'not_joined'; end if;
  insert into public.event_photos (event_id, uploader_id, photo_url)
  values (p_event, v, v_photo) returning id into v_id;
  return v_id;
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
  update public.photo_slots
     set released_at = coalesce(released_at, now()), release_at = null
   where kind = 'event_photo' and released_at is null;

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
   where kind = 'cooking_tip'
     and released_at is null and release_at is null;

  for r in
    select * from public.photo_slots
     where released_at is null
       and release_at is not null
       and release_at <= now()
       and kind is distinct from 'event_photo'
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
        'stories', coalesce((
          select jsonb_agg(jsonb_build_object('title', a.title, 'lines', a.lines) order by a.session_no)
          from public.event_story_archive a
          where a.event_id = e.id
        ), '[]'::jsonb),
        'question_draws', coalesce((
          select jsonb_agg(jsonb_build_object('name', coalesce(p.display_name, 'Uczestnik'), 'question', d.question, 'round', d.round_no) order by d.round_no, p.display_name)
          from public.event_question_draws d
          join public.profiles p on p.id = d.user_id
          where d.event_id = e.id
        ), '[]'::jsonb),
        'truths', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', t.name,
            'lines', t.lines,
            'score', t.score
          ) order by t.score desc, t.name)
          from (
            select coalesce(p.display_name, 'Uczestnik') as name,
                   (
                     select jsonb_agg(jsonb_build_object(
                       'text', ln.line,
                       'truth', (ln.ord - 1) is distinct from l.lie
                     ) order by ln.ord)
                     from unnest(coalesce(nullif(l.lines, '{}'::text[]), array[l.line1, l.line2, l.line3])) with ordinality as ln(line, ord)
                   ) as lines,
                   coalesce((
                     select sum(
                       case
                         when ((i - 1) is distinct from tl.lie) is not distinct from g.marks[i] then 1
                         else -1
                       end
                     )
                     from public.event_truth_guesses g
                     join public.event_truth_lines tl
                       on tl.event_id = g.event_id and tl.user_id = g.target_id and tl.saved
                     cross join generate_series(
                       1,
                       cardinality(coalesce(nullif(tl.lines, '{}'::text[]), array[tl.line1, tl.line2, tl.line3]))
                     ) as gs(i)
                     where g.event_id = e.id and g.user_id = l.user_id and g.saved
                   ), 0) as score
              from public.event_truth_lines l
              join public.profiles p on p.id = l.user_id
             where l.event_id = e.id and l.saved
          ) t
        ), '[]'::jsonb),
        'truths_ranking', coalesce((
          select jsonb_agg(jsonb_build_object('name', s.name, 'score', s.score) order by s.score desc, s.name)
          from (
            select coalesce(p.display_name, 'Uczestnik') as name, coalesce((
              select sum(
                case
                  when ((i - 1) is distinct from tl.lie) is not distinct from g.marks[i] then 1
                  else -1
                end
              )
              from public.event_truth_guesses g
              join public.event_truth_lines tl
                on tl.event_id = g.event_id and tl.user_id = g.target_id and tl.saved
              cross join generate_series(
                1,
                cardinality(coalesce(nullif(tl.lines, '{}'::text[]), array[tl.line1, tl.line2, tl.line3]))
              ) as gs(i)
              where g.event_id = e.id and g.user_id = ep.user_id and g.saved
            ), 0) as score
            from public.event_participants ep
            join public.profiles p on p.id = ep.user_id
           where ep.event_id = e.id and ep.status in ('joined', 'attended')
             and exists (select 1 from public.event_truth_lines l where l.event_id = e.id and l.saved)
          ) s
        ), '[]'::jsonb),
        'find_yes', coalesce((
          select jsonb_agg(jsonb_build_object('prompt', x.prompt, 'names', x.names) order by x.prompt)
          from (
            select a.prompt, coalesce(jsonb_agg(coalesce(p.display_name, 'Uczestnik') order by p.display_name), '[]'::jsonb) as names
              from public.event_find_answers a
              join public.profiles p on p.id = a.user_id
             where a.event_id = e.id and a.yes_saved and a.yes is true
             group by a.prompt
          ) x
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
              select sum(
                case
                  when a2.yes is true then 1
                  when a2.yes is false then -1
                  else 0
                end
              )
              from public.event_find_answers a
              left join lateral unnest(coalesce(a.names, '{}'::text[])) as g(guess) on true
              left join public.profiles p2
                on lower(trim(coalesce(p2.display_name, ''))) = lower(trim(g.guess))
              left join public.event_find_answers a2
                on a2.event_id = e.id and a2.prompt = a.prompt and a2.yes_saved and a2.user_id = p2.id
             where a.event_id = e.id and a.user_id = ep.user_id and a.names_saved
            ), 0) as score
            from public.event_participants ep
            join public.profiles p on p.id = ep.user_id
           where ep.event_id = e.id and ep.status in ('joined', 'attended')
             and exists (select 1 from public.event_find_answers a where a.event_id = e.id)
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

revoke all on function public.event_play_next(uuid) from public, anon;
revoke all on function public.event_play_board(uuid) from public, anon;
revoke all on function public.event_story_board(uuid) from public, anon;
revoke all on function public.event_story_leave(uuid) from public, anon;
revoke all on function public.event_story_vote(uuid, text, boolean) from public, anon;
revoke all on function public.event_story_close(uuid) from public, anon;
revoke all on function public.event_story_restart(uuid) from public, anon;
revoke all on function public.add_event_photo(uuid, text) from public, anon;
revoke all on function public.my_meeting_journal(int) from public, anon;
grant execute on function public.event_play_next(uuid) to authenticated;
grant execute on function public.event_play_board(uuid) to authenticated;
grant execute on function public.event_story_board(uuid) to authenticated;
grant execute on function public.event_story_leave(uuid) to authenticated;
grant execute on function public.event_story_vote(uuid, text, boolean) to authenticated;
grant execute on function public.event_story_close(uuid) to authenticated;
grant execute on function public.event_story_restart(uuid) to authenticated;
grant execute on function public.add_event_photo(uuid, text) to authenticated;
grant execute on function public.cleanup_photo_slots() to authenticated;
grant execute on function public.cleanup_photo_slots() to service_role;
grant execute on function public.my_meeting_journal(int) to authenticated;

notify pgrst, 'reload schema';

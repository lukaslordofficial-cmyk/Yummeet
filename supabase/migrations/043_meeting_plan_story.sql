-- Plan spotkania widoczny przed dołączeniem oraz wspólna historia przy stole.

drop policy if exists event_attractions_read on public.event_attractions;
create policy event_attractions_read on public.event_attractions
  for select to authenticated
  using (true);

create table if not exists public.event_story_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);
create index if not exists event_story_lines_event_idx on public.event_story_lines (event_id, created_at);

create table if not exists public.event_story_sessions (
  event_id uuid primary key references public.events(id) on delete cascade,
  closed_at timestamptz
);

alter table public.event_story_lines enable row level security;
alter table public.event_story_sessions enable row level security;
revoke all on public.event_story_lines from public, anon, authenticated;
revoke all on public.event_story_sessions from public, anon, authenticated;

create or replace function public.event_story_board(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid := auth.uid();
  v_turn uuid;
  v_count int;
  v_seats int;
begin
  if v is null then raise exception 'not_authenticated'; end if;
  if not (
    public.is_event_member(p_event)
    or exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v)
  ) then
    raise exception 'story_members_only';
  end if;
  select count(*) into v_count from public.event_story_lines where event_id = p_event;
  select count(*) into v_seats from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended');
  if v_seats > 0 then
    select s.user_id into v_turn
      from (
        select ep.user_id, row_number() over (order by ep.joined_at, ep.user_id) - 1 as idx
          from public.event_participants ep
         where ep.event_id = p_event and ep.status in ('joined', 'attended')
      ) s
     where s.idx = (v_count % v_seats);
  end if;
  return jsonb_build_object(
    'closed', exists (select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null),
    'your_turn', v_turn is not distinct from v,
    'turn_user_id', v_turn,
    'turn_name', (select display_name from public.profiles where id = v_turn),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'body', l.body,
        'author_id', l.author_id,
        'author', coalesce(p.display_name, 'Uczestnik'),
        'created_at', l.created_at
      ) order by l.created_at)
      from public.event_story_lines l
      left join public.profiles p on p.id = l.author_id
      where l.event_id = p_event
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.event_story_add(p_event uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  if not (
    public.is_event_member(p_event)
    or exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v)
  ) then
    raise exception 'story_members_only';
  end if;
  perform 1 from public.events where id = p_event for update;
  if exists (select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null) then
    raise exception 'story_closed';
  end if;
  select count(*) into v_count from public.event_story_lines where event_id = p_event;
  select count(*) into v_seats from public.event_participants ep
   where ep.event_id = p_event and ep.status in ('joined', 'attended');
  if v_seats < 1 then raise exception 'story_members_only'; end if;
  select s.user_id into v_turn
    from (
      select ep.user_id, row_number() over (order by ep.joined_at, ep.user_id) - 1 as idx
        from public.event_participants ep
       where ep.event_id = p_event and ep.status in ('joined', 'attended')
    ) s
   where s.idx = (v_count % v_seats);
  if v_turn is distinct from v then raise exception 'not_your_turn'; end if;
  select l.body into v_last from public.event_story_lines l
   where l.event_id = p_event order by l.created_at desc limit 1;
  if v_last is not null and v_last = v_body then raise exception 'duplicate_line'; end if;
  insert into public.event_story_lines (event_id, author_id, body) values (p_event, v, v_body) returning id into v_id;
  return v_id;
end $$;

create or replace function public.event_story_close(p_event uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  insert into public.event_story_sessions (event_id, closed_at) values (p_event, now())
  on conflict (event_id) do update set closed_at = coalesce(public.event_story_sessions.closed_at, now());
end $$;

revoke all on function public.event_story_board(uuid) from public, anon;
revoke all on function public.event_story_add(uuid, text) from public, anon;
revoke all on function public.event_story_close(uuid) from public, anon;
grant execute on function public.event_story_board(uuid) to authenticated;
grant execute on function public.event_story_add(uuid, text) to authenticated;
grant execute on function public.event_story_close(uuid) to authenticated;

create or replace function public.my_meeting_journal(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

grant execute on function public.my_meeting_journal(int) to authenticated;
notify pgrst, 'reload schema';

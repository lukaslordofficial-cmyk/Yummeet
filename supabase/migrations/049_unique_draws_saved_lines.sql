-- Wylosowane pytanie znika z puli dla całego spotkania.
-- Organizator może wstawić kolejne zdanie startowe historii także poza swoją turą.
-- Własne zdania „Znajdź kogoś” zostają na koncie użytkownika.

create table if not exists public.user_saved_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('find_prompt')),
  body text not null check (char_length(btrim(body)) between 5 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, kind, body)
);
create index if not exists user_saved_lines_user_idx on public.user_saved_lines (user_id, kind, created_at);

alter table public.user_saved_lines enable row level security;
drop policy if exists user_saved_lines_own on public.user_saved_lines;
create policy user_saved_lines_own on public.user_saved_lines
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_saved_lines to authenticated;

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

create or replace function public.event_story_draw_line(p_event uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
  v_last text;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 1200 then raise exception 'invalid_line'; end if;
  if not exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v) then
    raise exception 'not_allowed';
  end if;
  perform 1 from public.events where id = p_event for update;
  if exists (select 1 from public.event_story_sessions s where s.event_id = p_event and s.closed_at is not null) then
    raise exception 'story_closed';
  end if;
  select l.body into v_last from public.event_story_lines l
   where l.event_id = p_event order by l.created_at desc limit 1;
  if v_last is not null and v_last = v_body then raise exception 'duplicate_line'; end if;
  insert into public.event_story_lines (event_id, author_id, body) values (p_event, v, v_body) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.event_story_draw_line(uuid, text) from public, anon;
grant execute on function public.event_play_draw(uuid) to authenticated;
grant execute on function public.event_story_draw_line(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Kategorie spotkań siedzą na istniejącym wydarzeniu.
-- Zwykła ocena lokalu (restaurant_reviews, 1–5) zostaje.
-- Degustacje dopisują dania i karty 1–10. Średnia na pinie liczy się z kart.

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'events' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.events add constraint events_kind_check
  check (kind in ('open_table','speed_friending','official','food_exchange','volunteer','dinner','tasting'));

alter table public.events add column if not exists category_key text;
alter table public.events add column if not exists subcategory_key text;
alter table public.events add column if not exists template_key text;
alter table public.events add column if not exists duration_min int;
alter table public.events add column if not exists budget_per_person int;
alter table public.events add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.events drop constraint if exists events_duration_min_check;
alter table public.events add constraint events_duration_min_check
  check (duration_min is null or duration_min between 15 and 720);
alter table public.events drop constraint if exists events_budget_per_person_check;
alter table public.events add constraint events_budget_per_person_check
  check (budget_per_person is null or budget_per_person between 0 and 5000);

create table if not exists public.event_dishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_dishes_event_idx on public.event_dishes (event_id, sort);
create index if not exists event_dishes_pin_idx on public.event_dishes (pin_id);

create table if not exists public.dish_ratings (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.event_dishes(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  taste smallint check (taste between 1 and 10),
  look smallint check (look between 1 and 10),
  texture smallint check (texture between 1 and 10),
  aroma smallint check (aroma between 1 and 10),
  composition smallint check (composition between 1 and 10),
  technique smallint check (technique between 1 and 10),
  value smallint check (value between 1 and 10),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (dish_id, user_id)
);
create index if not exists dish_ratings_event_idx on public.dish_ratings (event_id);

alter table public.event_dishes enable row level security;
alter table public.dish_ratings enable row level security;
drop policy if exists event_dishes_read on public.event_dishes;
create policy event_dishes_read on public.event_dishes for select to authenticated using (true);
drop policy if exists dish_ratings_read on public.dish_ratings;
create policy dish_ratings_read on public.dish_ratings for select to authenticated using (true);
revoke insert, update, delete on public.event_dishes from authenticated;
revoke insert, update, delete on public.dish_ratings from authenticated;
grant select on public.event_dishes to authenticated;
grant select on public.dish_ratings to authenticated;

create or replace function public.event_set_meeting(
  p_event uuid,
  p_category text,
  p_subcategory text,
  p_template text,
  p_kind text,
  p_duration int,
  p_budget int
) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  if p_duration is not null and (p_duration < 15 or p_duration > 720) then raise exception 'invalid_duration'; end if;
  if p_budget is not null and (p_budget < 0 or p_budget > 5000) then raise exception 'invalid_budget'; end if;
  if p_kind is not null and p_kind not in ('open_table','speed_friending','official','food_exchange','volunteer','dinner','tasting') then
    raise exception 'invalid_kind';
  end if;
  update public.events
    set category_key = nullif(trim(p_category), ''),
        subcategory_key = nullif(trim(p_subcategory), ''),
        template_key = nullif(trim(p_template), ''),
        kind = coalesce(p_kind, kind),
        duration_min = p_duration,
        budget_per_person = p_budget
  where id = p_event and organizer_id = v;
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.event_add_dish(p_event uuid, p_name text, p_description text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_pin uuid; n int;
begin
  if v is null then raise exception 'not_authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 or char_length(trim(p_name)) > 120 then raise exception 'invalid_title'; end if;
  select pin_id into v_pin from public.events where id = p_event and organizer_id = v;
  if not found then raise exception 'not_allowed'; end if;
  select count(*) into n from public.event_dishes where event_id = p_event;
  if n >= 12 then raise exception 'too_many_dishes'; end if;
  insert into public.event_dishes (event_id, pin_id, name, description, sort)
  values (p_event, v_pin, trim(p_name), left(coalesce(p_description, ''), 500), n)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_dish_rating(
  p_dish uuid,
  p_taste smallint, p_look smallint, p_texture smallint, p_aroma smallint,
  p_composition smallint, p_technique smallint, p_value smallint,
  p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); e uuid; v_id uuid;
begin
  if v is null then raise exception 'not_authenticated'; end if;
  select event_id into e from public.event_dishes where id = p_dish;
  if e is null then raise exception 'not_found'; end if;
  if not public.is_event_member(e) then raise exception 'not_joined'; end if;
  if num_nonnulls(p_taste, p_look, p_texture, p_aroma, p_composition, p_technique, p_value) < 1 then
    raise exception 'need_score';
  end if;
  insert into public.dish_ratings (dish_id, event_id, user_id, taste, look, texture, aroma, composition, technique, value, note)
  values (p_dish, e, v, p_taste, p_look, p_texture, p_aroma, p_composition, p_technique, p_value, left(coalesce(p_note, ''), 500))
  on conflict (dish_id, user_id) do update set
    taste = excluded.taste, look = excluded.look, texture = excluded.texture, aroma = excluded.aroma,
    composition = excluded.composition, technique = excluded.technique, value = excluded.value,
    note = excluded.note
  returning id into v_id;
  return v_id;
end $$;

create or replace function public._dish_rows(p_pin uuid, p_event uuid)
returns table (
  dish_id uuid, name text, description text, created_at timestamptz, user_id uuid,
  taste smallint, look smallint, texture smallint, aroma smallint,
  composition smallint, technique smallint, value smallint, note text
)
language sql stable security definer set search_path = public as $$
  select d.id, d.name, d.description, d.created_at, r.user_id,
         r.taste, r.look, r.texture, r.aroma, r.composition, r.technique, r.value, r.note
  from public.event_dishes d
  left join public.dish_ratings r on r.dish_id = d.id
  where (p_pin is not null and d.pin_id = p_pin) or (p_event is not null and d.event_id = p_event);
$$;

create or replace function public.pin_dish_summary(p_pin uuid)
returns table (
  dish_key text, name text, description text, average numeric, rating_count int,
  taste numeric, look numeric, texture numeric, aroma numeric, composition numeric, technique numeric, value numeric
)
language sql stable security definer set search_path = public as $$
  with cards as (
    select lower(trim(name)) as dish_key, name, description, created_at, user_id,
           taste, look, texture, aroma, composition, technique, value,
           (select round(avg(v)::numeric, 1) from unnest(array[taste, look, texture, aroma, composition, technique, value]) v where v is not null) as score
    from public._dish_rows(p_pin, null)
    where user_id is not null
  )
  select c.dish_key,
         (array_agg(c.name order by c.created_at desc))[1],
         coalesce((array_agg(c.description order by c.created_at desc) filter (where c.description <> ''))[1], ''),
         round(avg(c.score), 1),
         count(*)::int,
         round(avg(c.taste), 1), round(avg(c.look), 1), round(avg(c.texture), 1), round(avg(c.aroma), 1),
         round(avg(c.composition), 1), round(avg(c.technique), 1), round(avg(c.value), 1)
  from cards c
  where c.score is not null
  group by c.dish_key
  order by avg(c.score) desc nulls last, count(*) desc;
$$;

create or replace function public.event_dish_board(p_event uuid)
returns table (
  dish_id uuid, name text, description text, sort int,
  average numeric, rating_count int,
  taste numeric, look numeric, texture numeric, aroma numeric, composition numeric, technique numeric, value numeric,
  my_taste smallint, my_look smallint, my_texture smallint, my_aroma smallint,
  my_composition smallint, my_technique smallint, my_value smallint, my_note text
)
language sql stable security definer set search_path = public as $$
  select d.id, d.name, d.description, d.sort,
         round(avg(s.score), 1),
         count(s.score)::int,
         round(avg(r.taste), 1), round(avg(r.look), 1), round(avg(r.texture), 1), round(avg(r.aroma), 1),
         round(avg(r.composition), 1), round(avg(r.technique), 1), round(avg(r.value), 1),
         max(r.taste) filter (where r.user_id = public._uid()),
         max(r.look) filter (where r.user_id = public._uid()),
         max(r.texture) filter (where r.user_id = public._uid()),
         max(r.aroma) filter (where r.user_id = public._uid()),
         max(r.composition) filter (where r.user_id = public._uid()),
         max(r.technique) filter (where r.user_id = public._uid()),
         max(r.value) filter (where r.user_id = public._uid()),
         max(r.note) filter (where r.user_id = public._uid())
  from public.event_dishes d
  left join public.dish_ratings r on r.dish_id = d.id
  left join lateral (
    select round(avg(v)::numeric, 1) as score
    from unnest(array[r.taste, r.look, r.texture, r.aroma, r.composition, r.technique, r.value]) v
    where v is not null
  ) s on true
  where d.event_id = p_event
  group by d.id
  order by d.sort, min(d.created_at);
$$;

grant execute on function public.event_set_meeting(uuid, text, text, text, text, int, int) to authenticated;
grant execute on function public.event_add_dish(uuid, text, text) to authenticated;
grant execute on function public.save_dish_rating(uuid, smallint, smallint, smallint, smallint, smallint, smallint, smallint, text) to authenticated;
grant execute on function public.pin_dish_summary(uuid) to authenticated;
grant execute on function public.event_dish_board(uuid) to authenticated;

notify pgrst, 'reload schema';

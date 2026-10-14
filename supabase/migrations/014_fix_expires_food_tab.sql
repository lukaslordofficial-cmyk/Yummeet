-- =====================================================================
-- 014: fix ambiguous expires_at + Jedzenie (offer_kind + cooking_tips)
-- =====================================================================

create or replace function public.mission_accept(p_mission uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); m record; v_done int; v_last timestamptz; v_id uuid;
begin
  select * into m from public.mission_definitions where id = p_mission and is_active;
  if m.id is null or not public._mission_visible(v, m.id, m.specialization_code) then raise exception 'mission_not_available'; end if;
  select count(*), max(created_at) into v_done, v_last from public.mission_completions where user_id = v and mission_id = p_mission;
  if m.repeat_limit > 0 and v_done >= m.repeat_limit then raise exception 'repeat_limit_reached'; end if;
  if v_last is not null and v_last > now() - make_interval(hours => m.cooldown_hours) then raise exception 'cooldown_active'; end if;
  if (select count(*) from public.user_missions where user_id = v and created_at > now() - interval '1 day') >= 20 then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.user_missions where user_id = v and mission_id = p_mission and status in ('accepted','in_progress','pending_confirmation')) then
    raise exception 'mission_already_open';
  end if;
  insert into public.user_missions (user_id, mission_id, status, attempt_no, expires_at)
  values (v, p_mission, 'accepted', v_done + 1, null) returning id into v_id;
  insert into public.mission_participants (user_mission_id, user_id, role) values (v_id, v, 'participant');
  return v_id;
end $$;

create or replace function public.mission_start(p_um uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  update public.user_missions um
     set status = 'in_progress', started_at = now()
   where um.id = p_um and um.user_id = v and um.status = 'accepted'
     and (um.expires_at is null or um.expires_at > now());
  if not found then raise exception 'invalid_transition'; end if;
end $$;

create or replace function public.get_mission_board()
returns table (mission_id uuid, code text, name text, description text, category text, specialization_code text, participation text,
               difficulty smallint, confirmation_method text, duration_hours int, reward_xp int, steps jsonb, safety_rules text,
               is_primary boolean, user_mission_id uuid, user_status text, expires_at timestamptz, completions int, card_reward_count int)
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_pref text; v_main text;
begin
  -- Kwalifikuj kolumny: RETURNS TABLE tworzy zmienne o tych samych nazwach (ambiguous expires_at).
  update public.user_missions um
     set status = 'expired'
   where um.user_id = v
     and um.status in ('accepted','in_progress')
     and um.expires_at is not null
     and um.expires_at < now();

  select p.preferred_specialization into v_pref from public.profiles p where p.id = v;
  v_main := public.compute_main_specialization(v);

  return query
  select m.id, m.code, m.name, m.description, m.category, m.specialization_code, m.participation, m.difficulty, m.confirmation_method,
         m.duration_hours, m.reward_xp, m.steps, m.safety_rules,
         (m.specialization_code is not null and m.specialization_code = coalesce(v_pref, case when v_main = '__versatile__' then null else v_main end)),
         um.id,
         coalesce(um.status, 'available')::text,
         um.expires_at,
         (select count(*)::int from public.mission_completions c where c.user_id = v and c.mission_id = m.id),
         (select coalesce(sum(cr.count), 0)::int from public.card_rewards cr where cr.mission_id = m.id)
  from public.mission_definitions m
  left join lateral (
    select x.id, x.status, x.expires_at
    from public.user_missions x
    where x.user_id = v and x.mission_id = m.id
    order by x.created_at desc
    limit 1
  ) um on true
  where m.is_active
  order by (m.specialization_code = v_pref) desc nulls last, m.difficulty, m.name;
end $$;

-- ---------- Jedzenie: rodzaje ofert + tipy ----------
alter table public.food_offers add column if not exists offer_kind text;
update public.food_offers set offer_kind = 'giveaway' where offer_kind is null;
do $$ begin
  alter table public.food_offers alter column offer_kind set default 'giveaway';
  alter table public.food_offers alter column offer_kind set not null;
exception when others then null;
end $$;
do $$ begin
  alter table public.food_offers add constraint food_offers_kind_ok
    check (offer_kind in ('giveaway','exchange','signature','order'));
exception when duplicate_object then null;
end $$;

alter table public.food_offers add column if not exists place_lat float8;
alter table public.food_offers add column if not exists place_lng float8;

grant insert, update, delete on public.food_offers to authenticated;
grant select on public.food_offers to authenticated;

create table if not exists public.cooking_tips (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  body text not null check (char_length(trim(body)) between 10 and 4000),
  photo_url text,
  created_at timestamptz not null default now()
);
alter table public.cooking_tips enable row level security;
drop policy if exists cooking_tips_read on public.cooking_tips;
create policy cooking_tips_read on public.cooking_tips for select to authenticated using (true);
drop policy if exists cooking_tips_own on public.cooking_tips;
create policy cooking_tips_own on public.cooking_tips for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
grant select, insert, update, delete on public.cooking_tips to authenticated;

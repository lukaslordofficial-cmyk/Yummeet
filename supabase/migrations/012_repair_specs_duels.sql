-- =====================================================================
-- 012: REPAIR — uruchom TO, jeśli 010/011 padły.
-- Idempotentne: tworzy brakujące tabele, 4 specjalizacje, misje,
-- ogranicza pojedynki do proximity + 1×/tydzień, ranking ≤20 km.
-- =====================================================================

-- ---------- Specjalizacje (najpierw — FK dla misji i skilli) ----------
insert into public.specialization_definitions (code, name, description, color, icon, card_affinity, sort, is_active) values
 ('detective', 'Smakosz Detektyw',
  'W lochach mapy Yummeet tropisz zapachy i znaki. Twoja lupa widzi knajpy-widma, białe plamy i sekrety menu. Za każde odkrycie i weryfikację rosną Twoje PD Detektywa — społeczność ufa Twoim raportom z miejsca zdarzenia.',
  '#2C2520', 'magnify', '{explorer,taster,strategy}', 1, true),
 ('host', 'Gospodarz Stołu',
  'Kiedy pusty stół czeka, Ty stawiasz krzesło i zapalasz rozmowę. Organizujesz spotkania, pikniki i wymiany wiedzy — nie musisz być duszą imprezy, wystarczy że dasz ludziom pretekst, by się poznać. PD Gospodarza rosną z realnymi spotkaniami.',
  '#F4A261', 'account-group', '{hospitality,integration}', 2, true),
 ('alchemist', 'Kulinarny Alchemik',
  'W Twoim kotle składniki stają się złotem smaku. Wyzwania, wymiany obiadów i kuźnia trików: uczysz się, uczysz innych i — gdy chcesz — gotujesz dla społeczności. PD Alchemika płyną z kreatywności i rzetelnych realizacji, nie z pustych deklaracji.',
  '#A27E5D', 'flask-outline', '{culinary,tasting}', 3, true),
 ('guardian', 'Strażnik Żywności',
  'Stoisz na straży ostatniego kęsa. Ratujesz nadwyżki, mapujesz przeceny i jadłodzielnie, przekazujesz jedzenie bezpiecznie tam, gdzie ma sens. PD Strażnika rosną dopiero gdy posiłek naprawdę uniknie marnowania.',
  '#38A342', 'shield-check', '{solidarity,logistics}', 4, true)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, color = excluded.color,
  icon = excluded.icon, sort = excluded.sort, is_active = true;

-- Remap starych kodów (bezpiecznie, jeśli jeszcze istnieją)
update public.mission_definitions set specialization_code = 'detective' where specialization_code in ('critic','explorer');
update public.mission_definitions set specialization_code = 'host' where specialization_code in ('connector','romantic');
update public.mission_definitions set specialization_code = 'alchemist' where specialization_code = 'chef';
update public.mission_definitions set specialization_code = 'guardian' where specialization_code = 'rescuer';
update public.card_definitions set specialization_code = 'detective' where specialization_code in ('critic','explorer');
update public.card_definitions set specialization_code = 'host' where specialization_code in ('connector','romantic');
update public.card_definitions set specialization_code = 'alchemist' where specialization_code = 'chef';
update public.card_definitions set specialization_code = 'guardian' where specialization_code = 'rescuer';

-- Jedna para (user, nowy_kod) — critic+explorer mapują się na detective (bez podwójnego ON CONFLICT).
insert into public.user_specializations (user_id, code, is_primary)
select user_id, new_code, bool_or(is_primary)
from (
  select user_id,
    case code
      when 'critic' then 'detective' when 'explorer' then 'detective'
      when 'connector' then 'host' when 'romantic' then 'host'
      when 'chef' then 'alchemist' when 'rescuer' then 'guardian'
      else code
    end as new_code,
    is_primary
  from public.user_specializations
  where code in ('critic','explorer','connector','romantic','chef','rescuer')
) mapped
group by user_id, new_code
on conflict (user_id, code) do update set is_primary = public.user_specializations.is_primary or excluded.is_primary;
delete from public.user_specializations where code in ('critic','explorer','connector','romantic','chef','rescuer');

update public.profiles set primary_specialization = case primary_specialization
  when 'critic' then 'detective' when 'explorer' then 'detective'
  when 'connector' then 'host' when 'romantic' then 'host'
  when 'chef' then 'alchemist' when 'rescuer' then 'guardian'
  else primary_specialization end
where primary_specialization in ('critic','explorer','connector','romantic','chef','rescuer');

update public.specialization_definitions set is_active = false
where code in ('critic','explorer','connector','romantic','chef','rescuer');

-- ---------- Piny: menu / tagi / edycja ----------
alter table public.pins add column if not exists menu_text text;
alter table public.pins add column if not exists menu_photo_url text;
alter table public.pins add column if not exists tags text[] not null default '{}';
do $$ begin
  alter table public.pins add constraint pins_menu_text_len check (menu_text is null or char_length(menu_text) <= 8000);
exception when duplicate_object then null;
end $$;

create table if not exists public.pin_edits (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  editor_id uuid not null references public.profiles(id) on delete cascade,
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists pin_edits_pin_idx on public.pin_edits (pin_id, created_at desc);
alter table public.pin_edits enable row level security;
drop policy if exists pin_edits_select on public.pin_edits;
create policy pin_edits_select on public.pin_edits for select to authenticated using (true);
grant select on public.pin_edits to authenticated;
grant update (title, description, cuisine, city, address, price_level, cover_url, price_min, price_max, menu_text, menu_photo_url, tags)
  on public.pins to authenticated;

-- ---------- Profil kulinarny + preferowana specjalizacja ----------
alter table public.profiles add column if not exists preferred_specialization text;
do $$ begin
  alter table public.profiles
    add constraint profiles_preferred_specialization_fkey
    foreign key (preferred_specialization) references public.specialization_definitions(code);
exception when duplicate_object then null;
end $$;
alter table public.profiles add column if not exists signature_dish text;
alter table public.profiles add column if not exists favorite_cuisine text;
alter table public.profiles add column if not exists culinary_skill_level smallint;
alter table public.profiles add column if not exists diet_style text;
alter table public.profiles add column if not exists spice_tolerance_label text;
alter table public.profiles add column if not exists superpowers text[] not null default '{}';
alter table public.profiles add column if not exists collab_forms text[] not null default '{}';
alter table public.profiles add column if not exists cooking_paid_enabled boolean not null default false;
alter table public.profiles add column if not exists cooking_legal_consents jsonb not null default '{}'::jsonb;

grant update (
  username, display_name, avatar_url, bio, visibility, notification_prefs,
  preferred_specialization, signature_dish, favorite_cuisine, culinary_skill_level,
  diet_style, spice_tolerance_label, superpowers, collab_forms,
  cooking_paid_enabled, cooking_legal_consents
) on public.profiles to authenticated;

-- ---------- Postęp PD + skille ----------
create table if not exists public.specialization_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.specialization_definitions(code),
  pd int not null default 0 check (pd >= 0),
  level int not null default 1,
  missions_completed int not null default 0 check (missions_completed >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, code)
);
alter table public.specialization_progress enable row level security;
drop policy if exists spec_progress_select on public.specialization_progress;
create policy spec_progress_select on public.specialization_progress for select to authenticated using (true);
grant select on public.specialization_progress to authenticated;

create table if not exists public.skill_definitions (
  code text primary key,
  specialization_code text not null references public.specialization_definitions(code),
  name text not null,
  description text not null default '',
  unlock_level int not null default 2 check (unlock_level >= 1),
  sort int not null default 0,
  is_active boolean not null default true
);
alter table public.skill_definitions enable row level security;
drop policy if exists skill_defs_select on public.skill_definitions;
create policy skill_defs_select on public.skill_definitions for select to authenticated using (true);
grant select on public.skill_definitions to authenticated;

create table if not exists public.user_skills (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_code text not null references public.skill_definitions(code),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, skill_code)
);
alter table public.user_skills enable row level security;
drop policy if exists user_skills_select on public.user_skills;
create policy user_skills_select on public.user_skills for select to authenticated using (true);
grant select on public.user_skills to authenticated;

insert into public.skill_definitions (code, specialization_code, name, description, unlock_level, sort) values
 ('det_scout', 'detective', 'Lupa Kartografa', 'Szybsze rozpoznawanie luk na mapie i lepsze podpowiedzi przy dodawaniu pinów.', 2, 1),
 ('det_verify', 'detective', 'Pieczęć Detektywa', 'Twoje aktualizacje pinów budują wiarygodność społeczności.', 2, 2),
 ('host_invite', 'host', 'Otwarte Krzesło', 'Łatwiejsze zapraszanie i widoczność Twoich stołów.', 2, 1),
 ('host_circle', 'host', 'Krąg Gospodarza', 'Bonus za regularne, bezpieczne spotkania.', 2, 2),
 ('alc_lab', 'alchemist', 'Laboratorium Smaku', 'Odblokowuje ścieżkę wyzwań i publikacji trików.', 2, 1),
 ('alc_craft', 'alchemist', 'Fach Kuchenny', 'Ścieżka wymian i ofert gotowania (bez płatności w aplikacji).', 2, 2),
 ('gua_rescue', 'guardian', 'Sieć Ratunku', 'Lepsza widoczność ofert oddania i przecen w okolicy.', 2, 1),
 ('gua_pantry', 'guardian', 'Straż Spiżarni', 'Narzędzia bezpiecznego opisu alergenów i przechowywania.', 2, 2)
on conflict (code) do update set name = excluded.name, description = excluded.description, unlock_level = excluded.unlock_level;

create or replace function public._spec_level_for_pd(p_pd int) returns int
language sql stable set search_path = public as $$
  select coalesce((select max(level) from public.level_definitions where min_xp <= greatest(p_pd, 0)), 1);
$$;

create or replace function public._award_spec_pd(p_user uuid, p_code text, p_amount int, p_um uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_pd int; v_lvl int; sk record;
begin
  if p_code is null or p_amount is null or p_amount <= 0 then return; end if;
  if not exists (select 1 from public.specialization_definitions where code = p_code and is_active) then return; end if;
  insert into public.specialization_progress (user_id, code, pd, level, missions_completed, updated_at)
  values (p_user, p_code, p_amount, public._spec_level_for_pd(p_amount), 1, now())
  on conflict (user_id, code) do update set
    pd = public.specialization_progress.pd + excluded.pd,
    missions_completed = public.specialization_progress.missions_completed + 1,
    level = public._spec_level_for_pd(public.specialization_progress.pd + excluded.pd),
    updated_at = now();
  select pd, level into v_pd, v_lvl from public.specialization_progress where user_id = p_user and code = p_code;
  for sk in
    select * from public.skill_definitions
    where specialization_code = p_code and is_active and unlock_level <= v_lvl
      and code not in (select skill_code from public.user_skills where user_id = p_user)
  loop
    insert into public.user_skills (user_id, skill_code) values (p_user, sk.code) on conflict do nothing;
  end loop;
end $$;

create or replace function public.compute_main_specialization(p_user uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare top_pd int; cnt int; code text;
begin
  select max(pd) into top_pd from public.specialization_progress where user_id = p_user and pd > 0;
  if top_pd is null then return null; end if;
  select count(*) into cnt from public.specialization_progress where user_id = p_user and pd = top_pd;
  if cnt > 1 then return '__versatile__'; end if;
  select sp.code into code from public.specialization_progress sp where sp.user_id = p_user and sp.pd = top_pd limit 1;
  return code;
end $$;

create or replace function public.set_preferred_specialization(p_code text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if p_code is not null and not exists (
    select 1 from public.specialization_definitions where code = p_code and is_active
  ) then raise exception 'invalid_specialization'; end if;
  update public.profiles set preferred_specialization = p_code, updated_at = now() where id = v;
  delete from public.user_specializations where user_id = v;
  if p_code is not null then
    insert into public.user_specializations (user_id, code, is_primary) values (v, p_code, false);
  end if;
end $$;
grant execute on function public.set_preferred_specialization(text) to authenticated;

create or replace function public.choose_specialization(p_primary text, p_interests text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.set_preferred_specialization(p_primary);
end $$;

create or replace function public.get_specialization_hub()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_main text; v_pref text; specs jsonb;
begin
  select preferred_specialization into v_pref from public.profiles where id = v;
  v_main := public.compute_main_specialization(v);
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', d.code, 'name', d.name, 'description', d.description, 'color', d.color, 'icon', d.icon, 'sort', d.sort,
    'pd', coalesce(p.pd, 0), 'level', coalesce(p.level, 1),
    'missions_completed', coalesce(p.missions_completed, 0),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', s.code, 'name', s.name, 'description', s.description, 'unlock_level', s.unlock_level,
        'status', case
          when us.skill_code is not null then 'unlocked'
          when coalesce(p.level, 1) >= s.unlock_level then 'available'
          else 'locked' end
      ) order by s.sort)
      from public.skill_definitions s
      left join public.user_skills us on us.user_id = v and us.skill_code = s.code
      where s.specialization_code = d.code and s.is_active
    ), '[]'::jsonb)
  ) order by d.sort), '[]'::jsonb)
  into specs
  from public.specialization_definitions d
  left join public.specialization_progress p on p.user_id = v and p.code = d.code
  where d.is_active;
  return jsonb_build_object(
    'preferred', v_pref,
    'main', v_main,
    'main_label', case
      when v_main is null then 'Nowicjusz'
      when v_main = '__versatile__' then 'Wszechstronny Yummiter'
      else (select name from public.specialization_definitions where code = v_main) end,
    'specializations', specs
  );
end $$;
grant execute on function public.get_specialization_hub() to authenticated;

create or replace function public._mission_visible(p_user uuid, p_mission uuid, p_spec text) returns boolean
language sql stable security definer set search_path = public as $$ select true; $$;

create or replace function public.get_mission_board()
returns table (mission_id uuid, code text, name text, description text, category text, specialization_code text, participation text,
               difficulty smallint, confirmation_method text, duration_hours int, reward_xp int, steps jsonb, safety_rules text,
               is_primary boolean, user_mission_id uuid, user_status text, expires_at timestamptz, completions int, card_reward_count int)
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_pref text; v_main text;
begin
  update public.user_missions set status = 'expired'
   where user_id = v and status in ('accepted','in_progress') and user_missions.expires_at < now();
  select preferred_specialization into v_pref from public.profiles where id = v;
  v_main := public.compute_main_specialization(v);
  return query
  select m.id, m.code, m.name, m.description, m.category, m.specialization_code, m.participation, m.difficulty, m.confirmation_method,
         m.duration_hours, m.reward_xp, m.steps, m.safety_rules,
         (m.specialization_code is not null and m.specialization_code = coalesce(v_pref, case when v_main = '__versatile__' then null else v_main end)),
         um.id, coalesce(um.status, 'available'), um.expires_at,
         (select count(*)::int from public.mission_completions c where c.user_id = v and c.mission_id = m.id),
         (select coalesce(sum(cr.count), 0)::int from public.card_rewards cr where cr.mission_id = m.id)
  from public.mission_definitions m
  left join lateral (select * from public.user_missions x where x.user_id = v and x.mission_id = m.id order by x.created_at desc limit 1) um on true
  where m.is_active
  order by (m.specialization_code = v_pref) desc nulls last, m.difficulty, m.name;
end $$;

create or replace function public._complete_user_mission(p_um uuid, p_confirmer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare um record; m record; v_first boolean; v_xp int; v_cards jsonb := '[]'; r record; i int; v_uc uuid; v_cid uuid; v_main text;
begin
  select * into um from public.user_missions where id = p_um for update;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status not in ('in_progress','pending_confirmation') then raise exception 'invalid_transition'; end if;
  select * into m from public.mission_definitions where id = um.mission_id;
  v_first := not exists (select 1 from public.mission_completions where user_id = um.user_id and mission_id = um.mission_id);
  v_xp := case when v_first then m.reward_xp else m.repeat_reward_xp end;
  for r in select * from public.card_rewards where mission_id = m.id and (v_first or not first_time_only) loop
    for i in 1..r.count loop
      v_uc := public._grant_card(um.user_id, r.card_id, r.kind, r.rarity, 'mission', um.id);
      if v_uc is not null then
        select card_id into v_cid from public.user_cards where id = v_uc;
        v_cards := v_cards || jsonb_build_object('user_card_id', v_uc, 'card_id', v_cid);
      end if;
    end loop;
  end loop;
  insert into public.mission_completions (user_mission_id, user_id, mission_id, is_first, xp, cards)
  values (um.id, um.user_id, um.mission_id, v_first, v_xp, v_cards);
  update public.user_missions set status = 'completed', completed_at = now(), confirmer_id = coalesce(p_confirmer, confirmer_id) where id = um.id;
  perform public._award_xp(um.user_id, v_xp, 'mission', um.id, m.name);
  if m.specialization_code is not null and v_xp > 0 then
    perform public._award_spec_pd(um.user_id, m.specialization_code, v_xp, um.id);
  end if;
  v_main := public.compute_main_specialization(um.user_id);
  if v_main is not null and v_main <> '__versatile__' then
    update public.profiles set primary_specialization = v_main, updated_at = now() where id = um.user_id;
  elsif v_main is null then
    update public.profiles set primary_specialization = null, updated_at = now() where id = um.user_id;
  end if;
  perform public._evaluate_badges(um.user_id);
  perform public._notify(um.user_id, 'reward_mission', 'Misja ukończona: ' || m.name, '+' || v_xp || ' XP / PD, kart: ' || jsonb_array_length(v_cards),
                         jsonb_build_object('user_mission_id', um.id), 'mission_done:' || um.id);
  return jsonb_build_object('completed', true, 'xp', v_xp, 'pd', v_xp, 'specialization', m.specialization_code, 'cards', v_cards, 'first', v_first);
end $$;

-- update_pin + pin_details (skrót: pełna logika jak w 010)
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text);
create or replace function public.update_pin(
  p_pin uuid,
  p_title text default null,
  p_description text default null,
  p_cuisine text default null,
  p_city text default null,
  p_address text default null,
  p_price_min int default null,
  p_price_max int default null,
  p_menu_text text default null,
  p_menu_photo_url text default null,
  p_tags text[] default null,
  p_cover_url text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  old record;
  ch jsonb := '{}'::jsonb;
  v_level smallint;
begin
  select * into old from public.pins where id = p_pin and status = 'published' for update;
  if old.id is null then raise exception 'pin_not_found'; end if;
  if p_price_min is not null and p_price_min < 0 then raise exception 'invalid_price'; end if;
  if p_price_max is not null and p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_min is not null and p_price_max is not null and p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  if p_menu_text is not null and char_length(p_menu_text) > 8000 then raise exception 'menu_too_long'; end if;
  if p_tags is not null and cardinality(p_tags) > 12 then raise exception 'too_many_tags'; end if;

  if p_title is not null and trim(p_title) is distinct from old.title then
    ch := ch || jsonb_build_object('title', jsonb_build_object('from', old.title, 'to', trim(p_title)));
  end if;
  if p_description is not null and p_description is distinct from old.description then ch := ch || jsonb_build_object('description', true); end if;
  if p_cuisine is not null and nullif(trim(p_cuisine),'') is distinct from old.cuisine then
    ch := ch || jsonb_build_object('cuisine', jsonb_build_object('from', old.cuisine, 'to', nullif(trim(p_cuisine),'')));
  end if;
  if p_city is not null and p_city is distinct from old.city then
    ch := ch || jsonb_build_object('city', jsonb_build_object('from', old.city, 'to', p_city));
  end if;
  if p_address is not null and nullif(trim(p_address),'') is distinct from old.address then ch := ch || jsonb_build_object('address', true); end if;
  if p_price_min is not null and p_price_min is distinct from old.price_min then
    ch := ch || jsonb_build_object('price_min', jsonb_build_object('from', old.price_min, 'to', p_price_min));
  end if;
  if p_price_max is not null and p_price_max is distinct from old.price_max then
    ch := ch || jsonb_build_object('price_max', jsonb_build_object('from', old.price_max, 'to', p_price_max));
  end if;
  if p_menu_text is not null and p_menu_text is distinct from old.menu_text then ch := ch || jsonb_build_object('menu_text', true); end if;
  if p_menu_photo_url is not null and p_menu_photo_url is distinct from old.menu_photo_url then ch := ch || jsonb_build_object('menu_photo_url', true); end if;
  if p_cover_url is not null and p_cover_url is distinct from old.cover_url then ch := ch || jsonb_build_object('cover_url', true); end if;
  if p_tags is not null and p_tags is distinct from old.tags then
    ch := ch || jsonb_build_object('tags', jsonb_build_object('from', to_jsonb(old.tags), 'to', to_jsonb(p_tags)));
  end if;
  if ch = '{}'::jsonb then return jsonb_build_object('updated', false, 'pin_id', p_pin); end if;

  v_level := old.price_level;
  if coalesce(p_price_min, old.price_min) is not null and coalesce(p_price_max, old.price_max) is not null then
    v_level := case
      when (coalesce(p_price_min, old.price_min) + coalesce(p_price_max, old.price_max)) / 2.0 < 25 then 1
      when (coalesce(p_price_min, old.price_min) + coalesce(p_price_max, old.price_max)) / 2.0 < 50 then 2
      when (coalesce(p_price_min, old.price_min) + coalesce(p_price_max, old.price_max)) / 2.0 < 90 then 3
      else 4 end;
  end if;

  update public.pins set
    title = case when p_title is not null then trim(p_title) else title end,
    description = coalesce(p_description, description),
    cuisine = case when p_cuisine is not null then nullif(trim(p_cuisine),'') else cuisine end,
    city = coalesce(p_city, city),
    address = case when p_address is not null then nullif(trim(p_address),'') else address end,
    price_min = coalesce(p_price_min, price_min),
    price_max = coalesce(p_price_max, price_max),
    price_level = v_level,
    menu_text = coalesce(p_menu_text, menu_text),
    menu_photo_url = coalesce(p_menu_photo_url, menu_photo_url),
    cover_url = coalesce(p_cover_url, cover_url),
    tags = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_pin;
  insert into public.pin_edits (pin_id, editor_id, changes) values (p_pin, v, ch);
  return jsonb_build_object('updated', true, 'pin_id', p_pin, 'changes', ch);
end $$;
grant execute on function public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text) to authenticated;

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'price_min', p.price_min, 'price_max', p.price_max,
    'menu_text', p.menu_text, 'menu_photo_url', p.menu_photo_url, 'tags', coalesce(p.tags, '{}'),
    'is_official', p.is_official, 'creator_id', p.creator_id, 'created_at', p.created_at, 'cover_url', p.cover_url,
    'lat', st_y(p.coords::geometry), 'lng', st_x(p.coords::geometry),
    'summary', (select to_jsonb(s) from public.restaurant_rating_summaries s where s.pin_id = p.id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'author', pr.display_name, 'food', r.food, 'atmosphere', r.atmosphere,
          'service', r.service, 'price_value', r.price_value, 'purposes', r.purposes, 'best_dish', r.best_dish, 'tip', r.tip, 'body', r.body,
          'visit_verified', r.visit_verified, 'created_at', r.created_at) order by r.created_at desc)
        from (select * from public.restaurant_reviews where pin_id = p.id order by created_at desc limit 20) r
        left join public.profiles pr on pr.id = r.user_id), '[]'::jsonb),
    'edit_history', coalesce((select jsonb_agg(jsonb_build_object(
          'id', e.id, 'editor_id', e.editor_id, 'editor_name', ep.display_name,
          'changes', e.changes, 'created_at', e.created_at) order by e.created_at desc)
        from (select * from public.pin_edits where pin_id = p.id order by created_at desc limit 30) e
        left join public.profiles ep on ep.id = e.editor_id), '[]'::jsonb),
    'visited', exists (select 1 from public.visited_places v where v.pin_id = p.id and v.user_id = auth.uid()))
  from public.pins p where p.id = p_id;
$$;

-- Backfill PD
insert into public.specialization_progress (user_id, code, pd, level, missions_completed, updated_at)
select c.user_id, m.specialization_code, sum(c.xp)::int, public._spec_level_for_pd(sum(c.xp)::int), count(*)::int, now()
from public.mission_completions c
join public.mission_definitions m on m.id = c.mission_id
where m.specialization_code is not null
group by c.user_id, m.specialization_code
on conflict (user_id, code) do update set
  pd = excluded.pd, level = excluded.level, missions_completed = excluded.missions_completed, updated_at = now();

insert into public.user_skills (user_id, skill_code)
select distinct p.user_id, s.code
from public.specialization_progress p
join public.skill_definitions s on s.specialization_code = p.code and s.is_active and s.unlock_level <= p.level
on conflict do nothing;

-- ---------- Pojedynki: tylko w pobliżu, max 1× / tydzień ta sama para ----------
create or replace function public.duel_invite(p_opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'proximity_only';
end $$;

create or replace function public.presence_ping(p_lat float8, p_lng float8) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); prev record; v_pt geography; o record; v_id uuid; v_created uuid[] := '{}';
begin
  if not (select duel_mode_enabled from public.profiles where id = v) then raise exception 'duel_mode_disabled'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  select * into prev from public.user_location_presence where user_id = v;
  if prev.user_id is not null then
    if prev.updated_at > now() - interval '20 seconds' then return jsonb_build_object('throttled', true, 'duels', '[]'::jsonb); end if;
  end if;
  insert into public.user_location_presence (user_id, coords, updated_at) values (v, v_pt, now())
  on conflict (user_id) do update set coords = excluded.coords, updated_at = excluded.updated_at;
  delete from public.user_location_presence where updated_at < now() - interval '10 minutes';
  if coalesce(prev.suspicious_count, 0) >= 5 then return jsonb_build_object('duels', '[]'::jsonb); end if;
  for o in
    select lp.user_id from public.user_location_presence lp join public.profiles p on p.id = lp.user_id
     where lp.user_id <> v and p.duel_mode_enabled and lp.updated_at > now() - interval '2 minutes' and lp.suspicious_count < 5
       and st_dwithin(lp.coords, v_pt, 100)
       and not public.is_blocked(v, lp.user_id)
       and not exists (select 1 from public.duels d where d.created_at > now() - interval '7 days'
                        and ((d.challenger_id = v and d.opponent_id = lp.user_id) or (d.challenger_id = lp.user_id and d.opponent_id = v)))
       and not exists (select 1 from public.duels d where d.status not in ('finished','cancelled','rejected','expired')
                        and ((d.challenger_id = v and d.opponent_id = lp.user_id) or (d.challenger_id = lp.user_id and d.opponent_id = v)))
     limit 1
  loop
    insert into public.duels (mode, challenger_id, opponent_id, status, response_deadline)
    values ('proximity', v, o.user_id, 'round1', now() + interval '15 minutes') returning id into v_id;
    v_created := v_created || v_id;
    perform public._notify(v, 'duel_proximity', 'Yummiteer w pobliżu — pojedynek!', 'Wchodzisz w tryb pojedynku.', jsonb_build_object('duel_id', v_id), 'duel_prox:' || v_id);
    perform public._notify(o.user_id, 'duel_proximity', 'Yummiteer w pobliżu — pojedynek!', 'Wchodzisz w tryb pojedynku.', jsonb_build_object('duel_id', v_id), 'duel_prox:' || v_id);
  end loop;
  return jsonb_build_object('duels', to_jsonb(v_created));
end $$;

-- Lekki ping lokalizacji (do rankingu 20 km) — bez wymogu trybu pojedynków
create or replace function public.touch_location(p_lat float8, p_lng float8) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_pt geography;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  insert into public.user_location_presence (user_id, coords, updated_at)
  values (v, v_pt, now())
  on conflict (user_id) do update set coords = excluded.coords, updated_at = now();
end $$;
grant execute on function public.touch_location(float8, float8) to authenticated;

drop function if exists public.duel_leaderboard(int);
create or replace function public.duel_leaderboard(p_lat float8, p_lng float8, p_limit int default 50)
returns table (user_id uuid, display_name text, wins int, losses int, cards_won int, cards_lost int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v uuid := auth.uid(); v_pt geography;
begin
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  return query
  select p.id, p.display_name,
    (select count(*)::int from public.duels d where d.winner_id = p.id),
    (select count(*)::int from public.duels d where d.winner_id is not null and d.winner_id <> p.id and p.id in (d.challenger_id, d.opponent_id)),
    (select count(*)::int from public.card_usage_history h where h.user_id = p.id and h.action = 'won'),
    (select count(*)::int from public.card_usage_history h where h.user_id = p.id and h.action = 'lost')
  from public.profiles p
  left join public.user_location_presence lp on lp.user_id = p.id
  where (coalesce(p.visibility->>'stats','public') = 'public' or p.id = v)
    and (
      p.id = v
      or (lp.coords is not null and lp.updated_at > now() - interval '7 days' and st_dwithin(lp.coords, v_pt, 20000))
    )
  order by 3 desc, 5 desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
grant execute on function public.duel_leaderboard(float8, float8, int) to authenticated;

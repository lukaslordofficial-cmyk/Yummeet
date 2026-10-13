-- Historia przejechanych Gastro-Tras + knajpy z recenzją po drodze.

create table if not exists public.travel_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  place_a text not null,
  place_b text not null,
  a_lat float8, a_lng float8, b_lat float8, b_lng float8,
  mode text not null default 'car',
  distance_m numeric not null default 0,
  km_tracked numeric not null default 0,
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  pin_ids uuid[] not null default '{}',
  reviewed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists travel_routes_user_idx on public.travel_routes (user_id, ended_at desc);

alter table public.travel_routes enable row level security;
drop policy if exists travel_routes_own on public.travel_routes;
create policy travel_routes_own on public.travel_routes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.travel_routes to authenticated;

-- Zamknięcie trasy: zapis + knajpy z trasy, przy których user ma recenzję.
create or replace function public.travel_route_finish(
  p_title text, p_place_a text, p_place_b text,
  p_a_lat float8, p_a_lng float8, p_b_lat float8, p_b_lng float8,
  p_mode text, p_distance_m numeric, p_km_tracked numeric,
  p_started_at timestamptz, p_pin_ids uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_reviewed jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'pin_id', r.pin_id, 'title', p.title, 'reviewed_at', r.created_at
  ) order by r.created_at), '[]'::jsonb)
  into v_reviewed
  from public.restaurant_reviews r
  join public.pins p on p.id = r.pin_id
  where r.user_id = v
    and r.pin_id = any(coalesce(p_pin_ids, '{}'))
    and r.created_at >= p_started_at - interval '1 hour';

  insert into public.travel_routes (
    user_id, title, place_a, place_b, a_lat, a_lng, b_lat, b_lng,
    mode, distance_m, km_tracked, started_at, ended_at, pin_ids, reviewed
  ) values (
    v, trim(p_title), trim(p_place_a), trim(p_place_b), p_a_lat, p_a_lng, p_b_lat, p_b_lng,
    coalesce(p_mode, 'car'), coalesce(p_distance_m, 0), coalesce(p_km_tracked, 0),
    p_started_at, now(), coalesce(p_pin_ids, '{}'), coalesce(v_reviewed, '[]'::jsonb)
  ) returning id into v_id;
  return v_id;
end $$;

grant execute on function public.travel_route_finish(
  text, text, text, float8, float8, float8, float8, text, numeric, numeric, timestamptz, uuid[]
) to authenticated;

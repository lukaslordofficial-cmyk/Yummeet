-- Pin cover photos + cuisine filter on route search + storage bucket.

alter table public.pins add column if not exists cover_url text;

do $$ begin
  revoke update on public.pins from authenticated;
  grant update (title, description, cuisine, city, address, price_level, cover_url) on public.pins to authenticated;
exception when others then null;
end $$;

create or replace function public.create_pin(
  p_title text, p_lat float8, p_lng float8,
  p_description text default null, p_cuisine text default null, p_city text default null,
  p_price_level smallint default null, p_cover_url text default null
) returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if (select count(*) from public.pins where creator_id = v and created_at > now() - interval '1 day') >= 30 then raise exception 'rate_limited'; end if;
  insert into public.pins (creator_id, title, description, cuisine, city, price_level, cover_url, coords)
  values (v, trim(p_title), p_description, p_cuisine, p_city, p_price_level, nullif(trim(p_cover_url), ''),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'is_official', p.is_official, 'creator_id', p.creator_id, 'created_at', p.created_at,
    'cover_url', p.cover_url,
    'lat', st_y(p.coords::geometry), 'lng', st_x(p.coords::geometry),
    'summary', (select to_jsonb(s) from public.restaurant_rating_summaries s where s.pin_id = p.id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'author', pr.display_name, 'food', r.food, 'atmosphere', r.atmosphere,
          'service', r.service, 'price_value', r.price_value, 'purposes', r.purposes, 'best_dish', r.best_dish, 'tip', r.tip, 'body', r.body,
          'visit_verified', r.visit_verified, 'created_at', r.created_at) order by r.created_at desc)
        from (select * from public.restaurant_reviews where pin_id = p.id order by created_at desc limit 20) r
        left join public.profiles pr on pr.id = r.user_id), '[]'::jsonb),
    'visited', exists (select 1 from public.visited_places v where v.pin_id = p.id and v.user_id = auth.uid()))
  from public.pins p where p.id = p_id;
$$;

create or replace function public.pins_along_route(
  p_path jsonb, p_buffer_m int default 1000, p_limit int default 100, p_cuisine text default null
)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean, score numeric, review_count int, distance_m float8, along float8)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_line geometry; n int;
begin
  if jsonb_typeof(p_path) <> 'array' then raise exception 'invalid_path'; end if;
  n := jsonb_array_length(p_path);
  if n < 2 or n > 2000 then raise exception 'invalid_path_length'; end if;
  if p_buffer_m < 50 or p_buffer_m > 10000 then raise exception 'invalid_buffer'; end if;
  select st_setsrid(st_makeline(array_agg(st_makepoint((e->>0)::float8, (e->>1)::float8) order by o)), 4326)
    into v_line from jsonb_array_elements(p_path) with ordinality as t(e, o);
  if v_line is null or not st_isvalid(v_line) or st_npoints(v_line) < 2 then raise exception 'invalid_geometry'; end if;
  if st_xmin(v_line) < -180 or st_xmax(v_line) > 180 or st_ymin(v_line) < -90 or st_ymax(v_line) > 90 then raise exception 'invalid_coordinates'; end if;
  return query
  select p.id, p.title, st_y(p.coords::geometry), st_x(p.coords::geometry), p.cuisine, p.is_official, s.yummeet_score, coalesce(s.review_count, 0),
         st_distance(p.coords, v_line::geography), st_linelocatepoint(v_line, p.coords::geometry)
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published' and st_dwithin(p.coords, v_line::geography, p_buffer_m)
    and (p_cuisine is null or p.cuisine = p_cuisine)
  order by st_linelocatepoint(v_line, p.coords::geometry)
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;

-- Storage bucket for pin photos (public read, authenticated write to own folder).
insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "pin_photos_public_read" on storage.objects;
create policy "pin_photos_public_read" on storage.objects
  for select to public using (bucket_id = 'pin-photos');

drop policy if exists "pin_photos_owner_insert" on storage.objects;
create policy "pin_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pin_photos_owner_update" on storage.objects;
create policy "pin_photos_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pin_photos_owner_delete" on storage.objects;
create policy "pin_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ensure realtime publication includes events/messages (idempotent).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.events'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.event_participants'; exception when duplicate_object then null; end;
  end if;
end $$;

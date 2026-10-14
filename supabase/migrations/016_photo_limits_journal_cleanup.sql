-- =====================================================================
-- 016: limity zdjęć (10 free), pin/menu 1×, dziennik spotkań, cleanup Storage
-- =====================================================================

alter table public.pins add column if not exists menu_pdf_url text;

-- Quota free: 10 / miesiąc (potrawy, inspiracje, zdjęcia stołów — NIE pin lokalu/menu)
create or replace function public.claim_photo_upload(p_limit int default 10)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); ym text := to_char(now() at time zone 'utc', 'YYYY-MM'); n int;
begin
  insert into public.photo_upload_quota (user_id, year_month, count)
  values (v, ym, 1)
  on conflict (user_id, year_month) do update
    set count = public.photo_upload_quota.count + 1
    where public.photo_upload_quota.count < p_limit
  returning count into n;
  if n is null then
    select count into n from public.photo_upload_quota where user_id = v and year_month = ym;
    raise exception 'photo_quota_exceeded';
  end if;
  return jsonb_build_object('used', n, 'limit', p_limit, 'year_month', ym);
end $$;
grant execute on function public.claim_photo_upload(int) to authenticated;

create or replace function public.photo_quota_status(p_limit int default 10)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid(); ym text := to_char(now() at time zone 'utc', 'YYYY-MM'); n int := 0;
begin
  select coalesce(count, 0) into n from public.photo_upload_quota where user_id = v and year_month = ym;
  return jsonb_build_object('used', n, 'limit', p_limit, 'remaining', greatest(p_limit - n, 0), 'year_month', ym);
end $$;
grant execute on function public.photo_quota_status(int) to authenticated;

-- update_pin: cover / menu photo / menu pdf — tylko jeśli jeszcze puste (pierwszy wygrywa)
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text);
drop function if exists public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text);
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
  p_cover_url text default null,
  p_menu_pdf_url text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  old record;
  ch jsonb := '{}'::jsonb;
  v_level smallint;
  v_cover text;
  v_menu_photo text;
  v_menu_pdf text;
begin
  select * into old from public.pins where id = p_pin and status = 'published' for update;
  if old.id is null then raise exception 'pin_not_found'; end if;
  if p_price_min is not null and p_price_min < 0 then raise exception 'invalid_price'; end if;
  if p_price_max is not null and p_price_max < 0 then raise exception 'invalid_price'; end if;
  if p_price_min is not null and p_price_max is not null and p_price_max < p_price_min then raise exception 'invalid_price_range'; end if;
  if p_menu_text is not null and char_length(p_menu_text) > 8000 then raise exception 'menu_too_long'; end if;
  if p_tags is not null and cardinality(p_tags) > 12 then raise exception 'too_many_tags'; end if;

  -- Blokada: 1 zdjęcie lokalu / 1 menu / 1 PDF na pin
  if p_cover_url is not null and nullif(trim(p_cover_url),'') is not null then
    if old.cover_url is not null and old.cover_url is distinct from nullif(trim(p_cover_url),'') then
      raise exception 'pin_cover_locked';
    end if;
    v_cover := nullif(trim(p_cover_url),'');
  end if;
  if p_menu_photo_url is not null and nullif(trim(p_menu_photo_url),'') is not null then
    if old.menu_photo_url is not null and old.menu_photo_url is distinct from nullif(trim(p_menu_photo_url),'') then
      raise exception 'pin_menu_photo_locked';
    end if;
    v_menu_photo := nullif(trim(p_menu_photo_url),'');
  end if;
  if p_menu_pdf_url is not null and nullif(trim(p_menu_pdf_url),'') is not null then
    if old.menu_pdf_url is not null and old.menu_pdf_url is distinct from nullif(trim(p_menu_pdf_url),'') then
      raise exception 'pin_menu_pdf_locked';
    end if;
    v_menu_pdf := nullif(trim(p_menu_pdf_url),'');
  end if;

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
  if v_menu_photo is not null and v_menu_photo is distinct from old.menu_photo_url then ch := ch || jsonb_build_object('menu_photo_url', true); end if;
  if v_menu_pdf is not null and v_menu_pdf is distinct from old.menu_pdf_url then ch := ch || jsonb_build_object('menu_pdf_url', true); end if;
  if v_cover is not null and v_cover is distinct from old.cover_url then ch := ch || jsonb_build_object('cover_url', true); end if;
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
    menu_photo_url = coalesce(v_menu_photo, menu_photo_url),
    menu_pdf_url = coalesce(v_menu_pdf, menu_pdf_url),
    cover_url = coalesce(v_cover, cover_url),
    tags = coalesce(p_tags, tags),
    updated_at = now()
  where id = p_pin;
  insert into public.pin_edits (pin_id, editor_id, changes) values (p_pin, v, ch);
  return jsonb_build_object('updated', true, 'pin_id', p_pin, 'changes', ch);
end $$;
grant execute on function public.update_pin(uuid, text, text, text, text, text, int, int, text, text, text[], text, text) to authenticated;

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'price_min', p.price_min, 'price_max', p.price_max,
    'menu_text', p.menu_text, 'menu_photo_url', p.menu_photo_url, 'menu_pdf_url', p.menu_pdf_url, 'tags', coalesce(p.tags, '{}'),
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

-- Zdjęcia otwartych stołów (wchodzą w limit 10/mies.)
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

create or replace function public.add_event_photo(p_event uuid, p_photo_url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid;
begin
  if p_photo_url is null or char_length(trim(p_photo_url)) < 8 then raise exception 'invalid_photo'; end if;
  if not (
    exists (select 1 from public.events e where e.id = p_event and e.organizer_id = v)
    or public.is_event_member(p_event)
  ) then raise exception 'not_joined'; end if;
  perform public.claim_photo_upload(10);
  insert into public.event_photos (event_id, uploader_id, photo_url)
  values (p_event, v, trim(p_photo_url)) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.add_event_photo(uuid, text) to authenticated;

-- Dziennik spotkań: stoły, które user odwiedził / do których dołączył / które organizował
create or replace function public.my_meeting_journal(p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  return coalesce((
    select jsonb_agg(row_data order by sort_at desc)
    from (
      select e.starts_at as sort_at, jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'description', e.description,
        'theme', e.theme,
        'rules', e.rules,
        'kind', e.kind,
        'place_name', e.place_name,
        'starts_at', e.starts_at,
        'status', e.status,
        'my_status', coalesce(ep.status, case when e.organizer_id = v then 'organizer' else null end),
        'capacity', e.capacity,
        'seats_taken', e.seats_taken,
        'attractions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'category', a.category, 'title', a.title, 'body', a.body
          ) order by a.created_at)
          from public.event_attractions a where a.event_id = e.id
        ), '[]'::jsonb),
        'photos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', ph.id, 'photo_url', ph.photo_url, 'created_at', ph.created_at
          ) order by ph.created_at)
          from public.event_photos ph where ph.event_id = e.id
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

-- Wyciągnij ścieżkę obiektu z public URL Storage
create or replace function public._storage_path_from_url(p_url text, p_bucket text default 'pin-photos')
returns text
language sql immutable as $$
  select nullif(
    substring(p_url from '/storage/v1/object/public/' || p_bucket || '/(.+)$'),
    ''
  );
$$;

-- Life Saver: usuń zdjęcia ofert zakończonych/wygasłych > 30 dni (+ auto-expire starych available)
create or replace function public.cleanup_expired_food_photos(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare
  r record;
  v_path text;
  n_cleared int := 0;
  n_deleted int := 0;
begin
  -- Auto-expire długo wiszących ofert
  update public.food_offers
     set status = 'expired', updated_at = now()
   where status in ('available', 'reserved')
     and created_at < now() - make_interval(days => greatest(p_days, 1));

  for r in
    select id, photo_url
    from public.food_offers
    where photo_url is not null
      and status in ('handed_over', 'cancelled', 'expired')
      and coalesce(updated_at, created_at) < now() - make_interval(days => greatest(p_days, 1))
  loop
    v_path := public._storage_path_from_url(r.photo_url, 'pin-photos');
    update public.food_offers set photo_url = null where id = r.id;
    n_cleared := n_cleared + 1;
    if v_path is not null then
      begin
        delete from storage.objects
         where bucket_id = 'pin-photos' and name = v_path;
        n_deleted := n_deleted + 1;
      exception when others then
        null; -- brak uprawnień / plik już usunięty
      end;
    end if;
  end loop;

  return jsonb_build_object('urls_cleared', n_cleared, 'storage_deleted', n_deleted, 'days', p_days);
end $$;
grant execute on function public.cleanup_expired_food_photos(int) to service_role;

-- Opcjonalny cron (jeśli rozszerzenie pg_cron dostępne w projekcie)
do $$ begin
  perform cron.schedule(
    'yummeet-food-photo-cleanup',
    '0 3 * * *',
    $$select public.cleanup_expired_food_photos(30)$$
  );
exception when others then
  raise notice 'pg_cron niedostępny — uruchamiaj cleanup_expired_food_photos(30) ręcznie lub z Edge Function';
end $$;

-- =====================================================================
-- 034: Upewnij się, że pin_details zwraca website + uzupełnij brakujące URL-e
-- =====================================================================

alter table public.pins add column if not exists website text;

-- Gdy website puste, a w opisie był link — przepisz go do website
update public.pins
set website = substring(description from 'https?://[^[:space:]]+')
where (website is null or trim(website) = '')
  and description ~* 'https?://';

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'price_min', p.price_min, 'price_max', p.price_max,
    'menu_text', p.menu_text, 'menu_photo_url', p.menu_photo_url, 'menu_pdf_url', p.menu_pdf_url, 'tags', coalesce(p.tags, '{}'),
    'website', p.website,
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

notify pgrst, 'reload schema';

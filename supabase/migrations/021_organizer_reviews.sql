-- =====================================================================
-- 021: Oceny organizatorów spotkań (gwiazdki + opinie, jak lokale)
-- =====================================================================

create table if not exists public.organizer_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  hospitality smallint not null check (hospitality between 1 and 5),
  organization smallint not null check (organization between 1 and 5),
  atmosphere smallint not null check (atmosphere between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  tip text check (char_length(tip) <= 280),
  body text check (char_length(body) <= 3000),
  created_at timestamptz not null default now(),
  unique (event_id, reviewer_id)
);
create index if not exists organizer_reviews_org_idx on public.organizer_reviews (organizer_id);
create index if not exists organizer_reviews_event_idx on public.organizer_reviews (event_id);

alter table public.organizer_reviews enable row level security;

drop policy if exists org_reviews_read on public.organizer_reviews;
create policy org_reviews_read on public.organizer_reviews for select to authenticated using (true);
revoke insert, update, delete on public.organizer_reviews from authenticated;

create or replace view public.organizer_rating_summaries with (security_invoker = true) as
select organizer_id,
       count(*)::int as review_count,
       round(avg(hospitality)::numeric, 2) as hospitality,
       round(avg(organization)::numeric, 2) as organization,
       round(avg(atmosphere)::numeric, 2) as atmosphere,
       round(avg(communication)::numeric, 2) as communication,
       round(avg((hospitality + organization + atmosphere + communication) / 4.0)::numeric, 2) as yummeet_score
from public.organizer_reviews
group by organizer_id;
grant select on public.organizer_rating_summaries to authenticated;

create or replace function public.save_organizer_review(
  p_event uuid,
  p_hospitality smallint,
  p_organization smallint,
  p_atmosphere smallint,
  p_communication smallint,
  p_tip text default null,
  p_body text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._uid();
  e record;
  v_id uuid;
begin
  if p_hospitality not between 1 and 5 or p_organization not between 1 and 5
     or p_atmosphere not between 1 and 5 or p_communication not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;
  select * into e from public.events where id = p_event;
  if e.id is null then raise exception 'not_found'; end if;
  if e.organizer_id is null then raise exception 'no_organizer'; end if;
  if e.organizer_id = v then raise exception 'cannot_review_self'; end if;
  if e.starts_at > now() then raise exception 'too_early'; end if;
  if not exists (
    select 1 from public.event_participants
    where event_id = p_event and user_id = v and status in ('joined', 'attended')
  ) then
    raise exception 'not_joined';
  end if;
  insert into public.organizer_reviews (
    event_id, organizer_id, reviewer_id, hospitality, organization, atmosphere, communication, tip, body
  ) values (
    p_event, e.organizer_id, v, p_hospitality, p_organization, p_atmosphere, p_communication,
    nullif(btrim(coalesce(p_tip, '')), ''), nullif(btrim(coalesce(p_body, '')), '')
  )
  on conflict (event_id, reviewer_id) do update set
    hospitality = excluded.hospitality,
    organization = excluded.organization,
    atmosphere = excluded.atmosphere,
    communication = excluded.communication,
    tip = excluded.tip,
    body = excluded.body
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.organizer_rating(p_user uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'organizer_id', p_user,
    'summary', (select to_jsonb(s) from public.organizer_rating_summaries s where s.organizer_id = p_user),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'event_id', r.event_id,
        'event_title', e.title,
        'reviewer_id', r.reviewer_id,
        'author', pr.display_name,
        'hospitality', r.hospitality,
        'organization', r.organization,
        'atmosphere', r.atmosphere,
        'communication', r.communication,
        'tip', r.tip,
        'body', r.body,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from (select * from public.organizer_reviews where organizer_id = p_user order by created_at desc limit 20) r
      left join public.profiles pr on pr.id = r.reviewer_id
      left join public.events e on e.id = r.event_id
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.save_organizer_review(uuid, smallint, smallint, smallint, smallint, text, text) to authenticated;
grant execute on function public.organizer_rating(uuid) to authenticated;

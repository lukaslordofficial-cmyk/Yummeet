-- Rezerwacja miejsca działa od utworzenia spotkania do jego zamknięcia,
-- niezależnie od okna kodu QR (4 godziny wokół startu).

create or replace function public.event_join(p_event uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); e record; v_prev text; v_conv uuid;
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null then raise exception 'not_found'; end if;
  select status into v_prev from public.event_participants where event_id = p_event and user_id = v;
  if v_prev in ('joined','attended') then return jsonb_build_object('already_joined', true); end if;
  if e.status = 'full' or e.seats_taken >= e.capacity then raise exception 'event_full'; end if;
  if e.status in ('finished', 'cancelled') then raise exception 'booking_closed'; end if;
  if e.status is distinct from 'open' then raise exception 'booking_closed'; end if;
  if e.organizer_id is not null and public.is_blocked(v, e.organizer_id) then raise exception 'blocked'; end if;
  insert into public.event_participants (event_id, user_id, status) values (p_event, v, 'joined')
    on conflict (event_id, user_id) do update set status = 'joined', joined_at = now();
  update public.events set seats_taken = seats_taken + 1, status = case when seats_taken + 1 >= capacity then 'full' else status end, updated_at = now() where id = p_event;
  select id into v_conv from public.conversations where kind = 'event' and ref_id = p_event;
  if v_conv is not null then insert into public.conversation_members (conversation_id, user_id) values (v_conv, v) on conflict do nothing; end if;
  if e.organizer_id is not null then
    perform public._notify(e.organizer_id, 'event_join', 'Nowy uczestnik: ' || e.title, null, jsonb_build_object('event_id', p_event), 'event_join:' || p_event || ':' || v);
  end if;
  perform public._notify(v, 'event_booked', 'Rezerwacja potwierdzona', e.title, jsonb_build_object('event_id', p_event), 'event_booked:' || p_event);
  return jsonb_build_object('joined', true);
end $$;

revoke all on function public.event_join(uuid) from public, anon;
grant execute on function public.event_join(uuid) to authenticated;

notify pgrst, 'reload schema';

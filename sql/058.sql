-- Akceptacja zgłoszenia otwiera czat i zostawia wiadomość dla drugiej osoby.
create or replace function public.dating_respond(p_interest uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); i public.dating_interests; l public.dating_listings; v_conv uuid;
begin
  select * into i from public.dating_interests where id = p_interest;
  if not found or i.status <> 'pending' then raise exception 'invalid_transition'; end if;
  select * into l from public.dating_listings where id = i.listing_id;
  if l.owner_id <> v then raise exception 'not_allowed'; end if;
  if public.is_blocked(v, i.guest_id) then raise exception 'blocked'; end if;
  if p_accept then
    update public.dating_interests set status = 'questions', updated_at = now() where id = i.id;
    v_conv := public.chat_open_direct(i.guest_id);
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v, 'Od teraz możecie rozmawiać ze sobą na czacie.');
    perform public._notify(
      i.guest_id,
      'dating_accept',
      'Możecie pisać na czacie',
      'Od teraz możecie rozmawiać ze sobą na czacie. Randka jest w Moje randki.',
      jsonb_build_object('interest_id', i.id, 'conversation_id', v_conv),
      'dating-accept:' || i.id
    );
  else
    update public.dating_interests set status = 'declined', updated_at = now() where id = i.id;
    perform public._notify(i.guest_id, 'dating_decline', 'Bez kontaktu tym razem', 'Organizator nie przyjął zgłoszenia.', jsonb_build_object('interest_id', i.id), 'dating-decline:' || i.id);
  end if;
end $$;

revoke all on function public.dating_respond(uuid, boolean) from public, anon;
grant execute on function public.dating_respond(uuid, boolean) to authenticated;

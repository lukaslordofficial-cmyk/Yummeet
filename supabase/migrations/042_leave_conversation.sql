-- Usuwa czat z listy zalogowanej osoby. Rozmowa zostaje dla pozostałych uczestników.

create or replace function public.conversation_leave(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  delete from public.conversation_members
   where conversation_id = p_conv and user_id = v;
  if not found then raise exception 'not_member'; end if;
end $$;

grant execute on function public.conversation_leave(uuid) to authenticated;

notify pgrst, 'reload schema';

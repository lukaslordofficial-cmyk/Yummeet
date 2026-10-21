-- Powiadomienie przy nowej wiadomości (dla odbiorców w rozmowie)
create or replace function public._trg_messages_after()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_name text;
begin
  select coalesce(display_name, 'Yummiter') into v_name from public.profiles where id = new.sender_id;
  for r in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
  loop
    perform public._notify(
      r.user_id,
      'message',
      v_name || ' wysłał Ci wiadomość',
      left(coalesce(new.body, ''), 120),
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id),
      'msg:' || new.id || ':' || r.user_id
    );
  end loop;
  return new;
end $$;

drop trigger if exists trg_messages_notify on public.messages;
create trigger trg_messages_notify
  after insert on public.messages
  for each row execute function public._trg_messages_after();

-- Realtime: notifications + messages (dla pływającej ikony w apce)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
  end if;
end $$;

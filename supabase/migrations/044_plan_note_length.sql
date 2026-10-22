-- Notatka planu mieści pulę pytań i osobne akapity zabaw.

do $$
declare r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.event_attractions'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%body%'
  loop
    execute format('alter table public.event_attractions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.event_attractions
  drop constraint if exists event_attractions_body_len;
alter table public.event_attractions
  add constraint event_attractions_body_len check (char_length(body) <= 8000);

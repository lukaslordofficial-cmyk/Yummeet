-- Własne pytania, zdania „Znajdź kogoś” i początki historii na koncie użytkownika.

alter table public.user_saved_lines add column if not exists label text not null default '';

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'user_saved_lines' and con.contype = 'c'
  loop
    execute format('alter table public.user_saved_lines drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.user_saved_lines add constraint user_saved_lines_kind_check
  check (kind in ('find_prompt', 'question', 'story_starter'));
alter table public.user_saved_lines add constraint user_saved_lines_body_check
  check (char_length(btrim(body)) between 5 and 2000);
alter table public.user_saved_lines add constraint user_saved_lines_label_check
  check (char_length(label) <= 80);

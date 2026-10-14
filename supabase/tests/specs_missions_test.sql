-- Spec PD + pin edit + double-complete (requires 010+011 applied)
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000c','c@test.pl','{"name":"Celina"}') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c', false);
do $$
declare um uuid; r jsonb; n int; hub jsonb; pin uuid;
begin
  perform set_preferred_specialization('guardian');
  hub := get_specialization_hub();
  assert hub->>'main_label' = 'Nowicjusz', 'expected Nowicjusz got ' || (hub->>'main_label');
  assert hub->>'preferred' = 'guardian', 'preferred';

  um := mission_accept((select id from mission_definitions where code='det_baker' and is_active));
  perform mission_start(um);
  r := mission_submit(um, 'text', 'Dodałem pin piekarni przy rynku');
  assert (r->>'completed')::boolean, 'det mission ' || r;
  assert (r->>'pd')::int = (r->>'xp')::int, 'pd should match xp reward';

  select pd into n from specialization_progress where user_id = auth.uid() and code = 'detective';
  assert n = (r->>'xp')::int, 'detective pd ' || n;

  hub := get_specialization_hub();
  assert hub->>'main' = 'detective', 'main should be detective from PD';

  r := mission_submit(um, 'text', 'again');
  assert (r->>'already_completed')::boolean, 'double complete must be idempotent';

  pin := create_pin('Test Edit Pin', 52.25, 21.01, 'desc', 'polish', 'Warszawa', null, null, null, 15, 40);
  r := update_pin(pin, 'Test Edit Pin 2', 'nowe menu', 'bakery_only', 'Warszawa', 'ul. Test 1', 15, 45, 'chleb 4zł', null, array['tanie','przeceny'], null);
  assert (r->>'updated')::boolean, 'pin update ' || r;
  select count(*) into n from pin_edits where pin_id = pin; assert n = 1, 'pin_edits';
end $$;

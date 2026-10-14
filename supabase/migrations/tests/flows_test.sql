-- Integration test of core flows (run against a DB with migrations applied). Fails loudly on error.
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@test.pl','{"name":"Ala"}'),
 ('00000000-0000-0000-0000-00000000000b','b@test.pl','{"name":"Bartek"}') on conflict do nothing;
set role authenticated;
-- USER A
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
do $$ declare n int; um uuid; r jsonb; begin
  select count(*) into n from user_cards where user_id = auth.uid() and status='owned';
  assert n = 5, 'starter deck should have 5 cards, got ' || n;
  perform set_preferred_specialization('detective');
  select count(*) into n from get_mission_board(); assert n >= 3, 'board empty';
  um := mission_accept((select id from mission_definitions where code='starter_hello'));
  begin perform mission_submit(um,'text','x'); assert false, 'submit before start should fail';
  exception when others then if sqlerrm not like '%invalid_transition%' then raise; end if; end;
  perform mission_start(um);
  r := mission_submit(um,'text','Pierogi ruskie');
  assert (r->>'completed')::boolean, 'not completed ' || r;
  r := mission_submit(um,'text','again');  -- double submit
  assert (r->>'already_completed')::boolean, 'double reward! ' || r;
  select count(*) into n from xp_ledger where user_id = auth.uid(); assert n = 1, 'xp ledger dup';
  select xp into n from profiles where id = auth.uid(); assert n = 40, 'xp=' || n;
  select count(*) into n from get_mission_board(); assert n >= 3, 'all-spec board';
  select count(*) into n from user_cards where user_id = auth.uid() and status='owned'; assert n = 7, 'cards after mission ' || n;
  begin perform mission_accept((select id from mission_definitions where code='starter_hello')); assert false, 'repeat limit';
  exception when others then if sqlerrm not like '%repeat_limit%' then raise; end if; end;
  -- RLS: client cannot grant itself cards / xp
  begin insert into user_cards(user_id, card_id, source_type) values (auth.uid(), (select id from card_definitions limit 1), 'hack'); assert false, 'rls cards';
  exception when insufficient_privilege then null; end;
  begin update profiles set xp = 99999 where id = auth.uid(); assert false, 'xp hack';
  exception when insufficient_privilege then null; end;
  -- PostGIS
  select count(*) into n from pins_in_bbox(52.2, 20.9, 52.3, 21.1); assert n >= 8, 'bbox ' || n;
  select count(*) into n from pins_along_route('[[21.01,52.23],[19.94,52.10],[19.456,51.77]]'::jsonb, 2000, 100); assert n >= 3, 'route ' || n;
  begin perform pins_along_route('[[1,2]]'::jsonb, 1000, 10); assert false, 'invalid path';
  exception when others then if sqlerrm not like '%invalid_path_length%' then raise; end if; end;
  perform create_pin('Moja knajpa', 52.24, 21.0, 'opis', 'polish', 'Warszawa', 2::smallint);
end $$;
-- DUEL: A invites B
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
create temp table t_duel as select duel_invite('00000000-0000-0000-0000-00000000000b') as id;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ declare d uuid := (select id from t_duel); s jsonb; begin
  perform duel_respond(d, true);
  perform duel_play(d, 'rock');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
do $$ declare d uuid := (select id from t_duel); s jsonb; n int; begin
  select count(*) into n from duel_moves where duel_id = d; assert n = 0, 'A must not see B move, saw ' || n;
  s := duel_play(d, 'rock');      -- tie
  assert (s->>'round')::int = 2 and s->>'status' = 'round1', 'tie handling ' || s;
  s := duel_play(d, 'paper');     -- A plays paper in round 2
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ declare d uuid := (select id from t_duel); s jsonb; begin
  s := duel_play(d, 'rock');      -- A wins attack
  assert s->>'status' = 'awaiting_response', 'after attack ' || s;
  s := duel_play(d, 'scissors');  -- defense round: B scissors
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
do $$ declare d uuid := (select id from t_duel); s jsonb; begin
  s := duel_play(d, 'rock');      -- A wins defense => full challenge
  assert s->>'status' = 'active_challenge', 'after defense ' || s;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ declare d uuid := (select id from t_duel); begin perform duel_submit_evidence(d, 'Zdjęcie: zostawiłem pierogi przy fontannie'); end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
do $$ declare d uuid := (select id from t_duel); s jsonb; n int; begin
  perform duel_confirm(d, true);
  s := duel_state(d);
  assert s->>'status' = 'finished' and s->>'outcome' = 'challenge_completed', 'final ' || s;
  select count(*) into n from card_usage_history where duel_id = d and action = 'played_offense'; assert n = 1, 'usage not logged';
  select wins into n from duel_leaderboard(10) where user_id = auth.uid(); assert n = 1, 'leaderboard';
end $$;
-- Second duel: B forfeits => loses one card to A
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
create temp table t_duel2 as select duel_invite('00000000-0000-0000-0000-00000000000a') as id;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
do $$ declare d uuid := (select id from t_duel2); begin perform duel_respond(d, true); perform duel_play(d, 'paper'); end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ declare d uuid := (select id from t_duel2); s jsonb; begin s := duel_play(d, 'rock'); assert s->>'status'='awaiting_response', 'd2 ' || s; perform duel_play(d,'rock'); end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
do $$ declare d uuid := (select id from t_duel2); s jsonb; begin s := duel_play(d, 'paper'); assert s->>'status'='active_challenge', 'd2 def ' || s; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ declare d uuid := (select id from t_duel2); n int; begin
  perform duel_forfeit(d);
  select count(*) into n from card_usage_history where duel_id = d and action = 'lost'; assert n = 1, 'card not lost';
end $$;
-- EVENTS: capacity
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
create temp table t_ev as select event_create('Stół testowy', 'Ramen Station', now() + interval '1 day', 2) as id;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ declare e uuid := (select id from t_ev); n int; r jsonb; begin
  perform event_join(e);
  r := event_join(e); assert (r->>'already_joined')::boolean, 'double join';
  select seats_taken into n from events where id = e; assert n = 2, 'seats ' || n;
  select count(*) into n from event_participants_list(e); assert n = 2, 'participants ' || n;
  select count(*) into n from my_conversations(); assert n >= 2, 'convs ' || n;
  insert into messages (conversation_id, body) values ((select id from conversations where kind='event' and ref_id=e), 'Cześć!');
  perform event_leave(e);
  select seats_taken into n from events where id = e; assert n = 1, 'seats after leave ' || n;
end $$;
reset role;
select 'ALL FLOW TESTS PASSED' as result;

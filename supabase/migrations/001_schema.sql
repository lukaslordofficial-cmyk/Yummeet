-- =====================================================================
-- YUMMEET — 001_schema.sql
-- Tables, indexes, column grants and Row Level Security.
-- Run order: 001_schema.sql -> 002_functions.sql -> 003_seed.sql
-- Idempotent where practical (if not exists / drop policy if exists).
-- =====================================================================
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- CONFIG / CATALOGS (content can be extended by inserting rows)
-- ---------------------------------------------------------------------
create table if not exists public.specialization_definitions (
  code text primary key,
  name text not null,
  description text not null default '',
  color text not null default '#E05F36',
  icon text not null default 'chef-hat',
  card_affinity text[] not null default '{}',
  sort int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.level_definitions (
  level int primary key,
  name text not null,
  min_xp int not null unique check (min_xp >= 0)
);

create table if not exists public.badge_definitions (
  code text primary key,
  name text not null,
  description text not null default '',
  icon text not null default 'medal',
  metric text not null,            -- missions_completed | cards_owned | duels_won | events_attended | pins_created
  threshold int not null check (threshold > 0),
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_.]{3,30}$'),
  display_name text not null default 'Yummiteer' check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  account_type text not null default 'user' check (account_type in ('user','business','admin')),
  primary_specialization text references public.specialization_definitions(code),
  xp int not null default 0 check (xp >= 0),
  level int not null default 1,
  duel_mode_enabled boolean not null default false,
  visibility jsonb not null default '{"profile":"public","stats":"public","cards":"public","badges":"public"}',
  notification_prefs jsonb not null default '{"duels":true,"events":true,"messages":true,"rewards":true,"missions":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private preferences: never readable by other users.
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  diet text[] not null default '{}',              -- vegetarian, vegan, meat, ...
  allergies text[] not null default '{}',          -- hard constraints
  cuisines text[] not null default '{}',
  spice_tolerance smallint not null default 2 check (spice_tolerance between 0 and 5),
  taste text check (taste in ('sweet','salty','both')),
  coffee boolean, alcohol boolean, experimental boolean,
  social_prefs text[] not null default '{}',      -- small_groups, large_groups, spontaneous, planned, quiet, social_events, travel, cooking, dating
  interests text[] not null default '{}',
  dating_enabled boolean not null default false,
  dating_gender text,
  dating_seeking text[] not null default '{}',
  dating_age_min smallint check (dating_age_min >= 18),
  dating_age_max smallint check (dating_age_max <= 120),
  relationship_types text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_specializations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.specialization_definitions(code),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.badge_definitions(code),
  awarded_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','message','event','mission','duel','food','pin','review')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 2 and 80),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- BUSINESS
-- ---------------------------------------------------------------------
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MAP: PINS (adapted from pinonmap `places`: lat/lng floats -> PostGIS geography)
-- ---------------------------------------------------------------------
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  creator_id uuid references public.profiles(id) on delete set null,
  business_id uuid references public.business_profiles(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 2000),
  cuisine text,
  city text,
  address text,
  price_level smallint check (price_level between 1 and 4),
  coords extensions.geography(Point, 4326) not null,
  is_official boolean not null default false,
  status text not null default 'published' check (status in ('published','hidden','removed'))
);
create index if not exists pins_geo_index on public.pins using gist (coords);
create index if not exists pins_created_idx on public.pins (created_at desc);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete cascade,
  title text not null,
  description text,
  discount_text text,
  starts_at timestamptz, ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_reviews (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  food smallint not null check (food between 1 and 5),
  atmosphere smallint not null check (atmosphere between 1 and 5),
  service smallint not null check (service between 1 and 5),
  price_value smallint not null check (price_value between 1 and 5),
  details jsonb not null default '{}',   -- taste, ingredients, freshness, look, portion, climate, decor, comfort, noise, conversation, politeness, speed, professionalism, price_quality, portion_price
  purposes text[] not null default '{}' check (purposes <@ array['date','group','meet','work','party','quiet']),
  best_dish text check (char_length(best_dish) <= 120),
  tip text check (char_length(tip) <= 280),
  body text check (char_length(body) <= 3000),
  visit_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pin_id, user_id)
);
create index if not exists reviews_pin_idx on public.restaurant_reviews (pin_id);

create table if not exists public.visited_places (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete cascade,
  method text not null check (method in ('location','mission','event')),
  created_at timestamptz not null default now(),
  primary key (user_id, pin_id)
);

-- ---------------------------------------------------------------------
-- MISSIONS & PROGRESSION
-- ---------------------------------------------------------------------
create table if not exists public.mission_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  category text not null check (category in ('restaurant','travel','cooking','food_exchange','food_rescue','volunteer','social','dating','review','specialization','card')),
  specialization_code text references public.specialization_definitions(code),
  participation text not null default 'solo' check (participation in ('solo','pair','group')),
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  start_conditions jsonb not null default '{}',
  steps jsonb not null default '[]',
  confirmation_method text not null default 'self' check (confirmation_method in ('self','code','peer','organizer','photo','location')),
  duration_hours int not null default 72 check (duration_hours > 0),
  reward_xp int not null default 0 check (reward_xp >= 0),
  repeat_reward_xp int not null default 0 check (repeat_reward_xp >= 0),
  repeat_limit int not null default 1 check (repeat_limit >= 0),   -- 0 = unlimited
  cooldown_hours int not null default 24 check (cooldown_hours >= 0),
  cancel_rules text,
  safety_rules text,
  pin_id uuid references public.pins(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Secrets (e.g. confirmation codes) are never exposed to clients (RLS on, no policies).
create table if not exists public.mission_secrets (
  mission_id uuid primary key references public.mission_definitions(id) on delete cascade,
  confirmation_code text not null
);

create table if not exists public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted','in_progress','pending_confirmation','completed','rejected','cancelled','expired')),
  attempt_no int not null default 1,
  confirmer_id uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz not null default now(),
  started_at timestamptz, submitted_at timestamptz, completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists user_missions_one_open
  on public.user_missions (user_id, mission_id) where status in ('accepted','in_progress','pending_confirmation');
create index if not exists user_missions_user_idx on public.user_missions (user_id, status);

create table if not exists public.mission_participants (
  user_mission_id uuid not null references public.user_missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'participant' check (role in ('participant','confirmer','organizer')),
  primary key (user_mission_id, user_id)
);

create table if not exists public.mission_evidence (
  id uuid primary key default gen_random_uuid(),
  user_mission_id uuid not null references public.user_missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('text','photo_url','code','location')),
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now()
);

-- Idempotency anchor: one completion row per user_mission => reward granted once.
create table if not exists public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_mission_id uuid not null unique references public.user_missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  is_first boolean not null,
  xp int not null,
  cards jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.xp_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  source_type text not null,
  source_id uuid not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

-- ---------------------------------------------------------------------
-- CARDS
-- ---------------------------------------------------------------------
create table if not exists public.card_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  lore text not null default '',
  category text not null default 'general',
  kind text not null check (kind in ('offensive','defensive','special')),
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  art_key text not null default 'placeholder',
  obtain_conditions text,
  confirmation_required text,
  effect text not null default '',
  challenge_text text,            -- offensive: challenge given to the defender
  challenge_hours int not null default 48,
  variants jsonb not null default '[]',
  usage_limits text,
  cancel_conditions text,
  specialization_code text references public.specialization_definitions(code),
  set_code text not null default 'base',
  version int not null default 1,
  status text not null default 'published' check (status in ('draft','published','retired')),
  created_at timestamptz not null default now()
);

-- Reward rules per mission (configurable, auditable).
create table if not exists public.card_rewards (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission_definitions(id) on delete cascade,
  card_id uuid references public.card_definitions(id) on delete cascade,  -- null = random card of kind/rarity
  kind text check (kind in ('offensive','defensive','special')),
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  count int not null default 1 check (count between 1 and 5),
  first_time_only boolean not null default true
);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.card_definitions(id),
  status text not null default 'owned' check (status in ('owned','lost','consumed')),
  source_type text not null,          -- starter | mission | duel
  source_id uuid,
  acquired_at timestamptz not null default now(),
  status_changed_at timestamptz
);
create index if not exists user_cards_owner_idx on public.user_cards (user_id, status);

create table if not exists public.card_usage_history (
  id bigserial primary key,
  user_card_id uuid references public.user_cards(id) on delete set null,
  card_id uuid not null references public.card_definitions(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('granted','played_offense','played_defense','lost','won','consumed')),
  duel_id uuid,
  source_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DUELS (participants & challenge live on the duel row: always exactly 2 players)
-- ---------------------------------------------------------------------
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('invite','proximity')),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('proposed','pending_acceptance','accepted','round1','awaiting_card','awaiting_response','active_challenge','awaiting_confirmation','finished','cancelled','rejected','expired')),
  phase text not null default 'attack' check (phase in ('attack','defense')),
  current_round int not null default 1,
  winner_id uuid references public.profiles(id),       -- winner of the attack phase
  attacker_id uuid references public.profiles(id),
  defender_id uuid references public.profiles(id),
  offensive_user_card_id uuid references public.user_cards(id),
  offensive_card_id uuid references public.card_definitions(id),
  defense_won boolean,
  defensive_user_card_id uuid references public.user_cards(id),
  defensive_card_id uuid references public.card_definitions(id),
  challenge_text text,
  challenge_variant text,
  challenge_deadline timestamptz,
  evidence text,
  evidence_at timestamptz,
  outcome text check (outcome in ('challenge_completed','challenge_failed','forfeited','refused_without_penalty','no_offensive_card','disputed','walkover')),
  penalty_user_card_id uuid references public.user_cards(id),
  response_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  check (challenger_id <> opponent_id)
);
create index if not exists duels_challenger_idx on public.duels (challenger_id, status);
create index if not exists duels_opponent_idx on public.duels (opponent_id, status);

-- Hidden moves: readable only by their author (so nobody can peek before resolution).
create table if not exists public.duel_moves (
  duel_id uuid not null references public.duels(id) on delete cascade,
  phase text not null check (phase in ('attack','defense')),
  round_no int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  move text not null check (move in ('rock','paper','scissors')),
  created_at timestamptz not null default now(),
  primary key (duel_id, phase, round_no, user_id)
);

create table if not exists public.duel_rounds (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  phase text not null,
  round_no int not null,
  challenger_move text,
  opponent_move text,
  winner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (duel_id, phase, round_no)
);

-- Proximity presence: current position only (no history), no client read access.
create table if not exists public.user_location_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coords extensions.geography(Point, 4326) not null,
  updated_at timestamptz not null default now(),
  suspicious_count int not null default 0
);
create index if not exists presence_geo_idx on public.user_location_presence using gist (coords);

-- ---------------------------------------------------------------------
-- EVENTS / OPEN TABLES (one model for tables, speed friending and official events)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'open_table' check (kind in ('open_table','speed_friending','official','food_exchange','volunteer','dinner')),
  organizer_id uuid references public.profiles(id) on delete set null,
  business_id uuid references public.business_profiles(id) on delete set null,
  pin_id uuid references public.pins(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 3000),
  place_name text not null,
  starts_at timestamptz not null,
  capacity int not null check (capacity between 2 and 500),
  seats_taken int not null default 0 check (seats_taken >= 0),
  category text,
  theme text,
  rules text,
  status text not null default 'open' check (status in ('open','full','cancelled','finished')),
  discount_text text,
  is_official boolean not null default false,
  attendance_method text not null default 'code' check (attendance_method in ('code','organizer','none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seats_taken <= capacity)
);
create index if not exists events_starts_idx on public.events (starts_at);

create table if not exists public.event_secrets (
  event_id uuid primary key references public.events(id) on delete cascade,
  checkin_code text not null
);

create table if not exists public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'joined' check (status in ('joined','left','attended')),
  joined_at timestamptz not null default now(),
  attended_at timestamptz,
  primary key (event_id, user_id)
);

-- ---------------------------------------------------------------------
-- CHAT
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group','event','mission','duel')),
  ref_id uuid,
  title text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);
create unique index if not exists conversations_ref_uq on public.conversations (kind, ref_id) where ref_id is not null;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS & PUSH
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  dedupe_key text not null,
  push_status text not null default 'pending' check (push_status in ('pending','sent','failed','skipped')),
  push_error text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_push_idx on public.notifications (push_status, created_at);

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  platform text,
  is_valid boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FOOD SHARING / EXCHANGE
-- ---------------------------------------------------------------------
create table if not exists public.food_offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  photo_url text,
  ingredients text,
  allergens text[] not null default '{}',
  diet text[] not null default '{}',
  prepared_at timestamptz,
  storage_conditions text,
  pickup_from timestamptz, pickup_until timestamptz,
  transport_info text,
  portions int not null default 1 check (portions between 1 and 200),
  portions_left int not null default 1 check (portions_left >= 0),
  pickup_place_public text,          -- public place only, never a home address
  recipient_type text not null default 'users' check (recipient_type in ('users','organization')),
  status text not null default 'available' check (status in ('available','reserved','handed_over','cancelled','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.food_handoffs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.food_offers(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','confirmed','received','cancelled')),
  allergens_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  unique (offer_id, recipient_id)
);

create table if not exists public.food_exchange_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  rules jsonb not null default '{}',      -- {"diet":"vegetarian","budget_max":30,"cuisine":"..."}
  max_participants int not null default 4 check (max_participants between 2 and 50),
  status text not null default 'gathering' check (status in ('gathering','rules_accepted','assigned','done','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.food_exchange_participants (
  group_id uuid not null references public.food_exchange_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rules_accepted boolean not null default false,
  allergens_declared text[] not null default '{}',
  gives_to uuid references public.profiles(id),
  status text not null default 'joined' check (status in ('joined','withdrawn','delivered','received')),
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------
-- DATING (3 levels) & TABLE GAMES
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  level smallint not null default 1 check (level between 1 and 3),
  status text not null default 'proposed' check (status in ('proposed','active','ended')),
  a_wants_level smallint not null default 1,
  b_wants_level smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.match_progress (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  level smallint not null,
  event text not null,
  by_user uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_categories (
  code text primary key,
  name text not null,
  depth smallint not null default 1 check (depth between 1 and 5),
  sort int not null default 0
);

create table if not exists public.scenario_questions (
  id uuid primary key default gen_random_uuid(),
  category_code text not null references public.question_categories(code),
  text text not null,
  depth smallint not null default 1,
  is_active boolean not null default true
);

create table if not exists public.table_games (
  code text primary key,
  name text not null,
  description text not null default '',
  rules text not null default '',
  min_players int not null default 2,
  max_players int not null default 8,
  trigger_conditions jsonb not null default '{}',
  is_active boolean not null default true
);

create table if not exists public.date_scenarios (
  id uuid primary key default gen_random_uuid(),
  level smallint not null check (level between 1 and 3),
  name text not null,
  description text not null default '',
  question_categories text[] not null default '{}',
  is_active boolean not null default true
);

-- =====================================================================
-- RLS
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'specialization_definitions','level_definitions','badge_definitions','profiles','user_preferences',
    'user_specializations','user_badges','user_blocks','reports','moderation_actions','business_profiles',
    'pins','promotions','restaurant_reviews','visited_places','mission_definitions','mission_secrets',
    'user_missions','mission_participants','mission_evidence','mission_completions','xp_ledger',
    'card_definitions','card_rewards','user_cards','card_usage_history','duels','duel_moves','duel_rounds',
    'user_location_presence','events','event_secrets','event_participants','conversations',
    'conversation_members','messages','notifications','push_tokens','food_offers','food_handoffs',
    'food_exchange_groups','food_exchange_participants','matches','match_progress','question_categories',
    'scenario_questions','table_games','date_scenarios']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Read-only catalogs for signed-in users
do $$
declare t text;
begin
  foreach t in array array['specialization_definitions','level_definitions','badge_definitions',
    'card_definitions','card_rewards','question_categories','scenario_questions','table_games','date_scenarios']
  loop
    execute format('drop policy if exists catalog_read on public.%I', t);
    execute format('create policy catalog_read on public.%I for select to authenticated using (true)', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
  end loop;
end $$;

drop policy if exists missions_read on public.mission_definitions;
create policy missions_read on public.mission_definitions for select to authenticated using (is_active);
revoke insert, update, delete on public.mission_definitions from authenticated;

-- PROFILES: readable when public (or own); only safe columns updatable by owner.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or coalesce(visibility->>'profile','public') = 'public');
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (username, display_name, avatar_url, bio, visibility, notification_prefs) on public.profiles to authenticated;

drop policy if exists prefs_own on public.user_preferences;
create policy prefs_own on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists userspec_read on public.user_specializations;
create policy userspec_read on public.user_specializations for select to authenticated using (true);
revoke insert, update, delete on public.user_specializations from authenticated;

drop policy if exists badges_read on public.user_badges;
create policy badges_read on public.user_badges for select to authenticated using (true);
revoke insert, update, delete on public.user_badges from authenticated;

drop policy if exists blocks_own on public.user_blocks;
create policy blocks_own on public.user_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports for select to authenticated using (reporter_id = auth.uid());
revoke update, delete on public.reports from authenticated;

-- BUSINESS: owner manages own records only.
drop policy if exists business_read on public.business_profiles;
create policy business_read on public.business_profiles for select to authenticated using (true);
drop policy if exists business_own on public.business_profiles;
create policy business_own on public.business_profiles for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, delete on public.business_profiles from authenticated;
revoke update on public.business_profiles from authenticated;
grant update (name, description) on public.business_profiles to authenticated;

drop policy if exists promotions_read on public.promotions;
create policy promotions_read on public.promotions for select to authenticated using (status = 'active' or exists (select 1 from public.business_profiles b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists promotions_own on public.promotions;
create policy promotions_own on public.promotions for all to authenticated
  using (exists (select 1 from public.business_profiles b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.business_profiles b where b.id = business_id and b.owner_id = auth.uid()));

-- PINS
drop policy if exists pins_read on public.pins;
create policy pins_read on public.pins for select to authenticated using (status = 'published' or creator_id = auth.uid());
drop policy if exists pins_insert on public.pins;
create policy pins_insert on public.pins for insert to authenticated with check (creator_id = auth.uid() and is_official = false and business_id is null);
drop policy if exists pins_update on public.pins;
create policy pins_update on public.pins for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
revoke update on public.pins from authenticated;
grant update (title, description, cuisine, city, address, price_level) on public.pins to authenticated;

-- REVIEWS: visit_verified cannot be set by client (column grants).
drop policy if exists reviews_read on public.restaurant_reviews;
create policy reviews_read on public.restaurant_reviews for select to authenticated using (true);
drop policy if exists reviews_insert on public.restaurant_reviews;
create policy reviews_insert on public.restaurant_reviews for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reviews_update on public.restaurant_reviews;
create policy reviews_update on public.restaurant_reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reviews_delete on public.restaurant_reviews;
create policy reviews_delete on public.restaurant_reviews for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.restaurant_reviews from authenticated;
grant insert (pin_id, user_id, food, atmosphere, service, price_value, details, purposes, best_dish, tip, body) on public.restaurant_reviews to authenticated;
grant update (food, atmosphere, service, price_value, details, purposes, best_dish, tip, body) on public.restaurant_reviews to authenticated;

drop policy if exists visited_own on public.visited_places;
create policy visited_own on public.visited_places for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.visited_places from authenticated;

-- MISSIONS: rows written only by SECURITY DEFINER functions.
drop policy if exists um_read on public.user_missions;
create policy um_read on public.user_missions for select to authenticated using (user_id = auth.uid() or confirmer_id = auth.uid());
revoke insert, update, delete on public.user_missions from authenticated;
drop policy if exists mp_read on public.mission_participants;
create policy mp_read on public.mission_participants for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.mission_participants from authenticated;
drop policy if exists me_read on public.mission_evidence;
create policy me_read on public.mission_evidence for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.user_missions um where um.id = user_mission_id and um.confirmer_id = auth.uid()));
revoke insert, update, delete on public.mission_evidence from authenticated;
drop policy if exists mc_read on public.mission_completions;
create policy mc_read on public.mission_completions for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.mission_completions from authenticated;
drop policy if exists xp_read on public.xp_ledger;
create policy xp_read on public.xp_ledger for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.xp_ledger from authenticated;

-- CARDS: owner reads; others read only if their cards visibility is public.
drop policy if exists uc_read on public.user_cards;
create policy uc_read on public.user_cards for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = user_id and coalesce(p.visibility->>'cards','public') = 'public'));
revoke insert, update, delete on public.user_cards from authenticated;
drop policy if exists cuh_read on public.card_usage_history;
create policy cuh_read on public.card_usage_history for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.card_usage_history from authenticated;

-- DUELS: participants only.
drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to authenticated using (auth.uid() in (challenger_id, opponent_id));
revoke insert, update, delete on public.duels from authenticated;
drop policy if exists moves_read_own on public.duel_moves;
create policy moves_read_own on public.duel_moves for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.duel_moves from authenticated;
drop policy if exists rounds_read on public.duel_rounds;
create policy rounds_read on public.duel_rounds for select to authenticated using (
  exists (select 1 from public.duels d where d.id = duel_id and auth.uid() in (d.challenger_id, d.opponent_id)));
revoke insert, update, delete on public.duel_rounds from authenticated;
-- presence: no policies at all => no direct client access
revoke all on public.user_location_presence from authenticated;

-- EVENTS
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (true);
drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events for update to authenticated using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
revoke insert, update, delete on public.events from authenticated;
grant update (title, description, place_name, starts_at, theme, rules, discount_text) on public.events to authenticated;
revoke all on public.event_secrets from authenticated;
revoke insert, update, delete on public.event_participants from authenticated;

-- NOTIFICATIONS
drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
drop policy if exists push_own on public.push_tokens;
create policy push_own on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- FOOD
drop policy if exists food_read on public.food_offers;
create policy food_read on public.food_offers for select to authenticated using (status in ('available','reserved') or owner_id = auth.uid());
drop policy if exists food_own on public.food_offers;
create policy food_own on public.food_offers for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists handoff_read on public.food_handoffs;
create policy handoff_read on public.food_handoffs for select to authenticated using (
  recipient_id = auth.uid() or exists (select 1 from public.food_offers o where o.id = offer_id and o.owner_id = auth.uid()));
revoke insert, update, delete on public.food_handoffs from authenticated;
drop policy if exists feg_read on public.food_exchange_groups;
create policy feg_read on public.food_exchange_groups for select to authenticated using (true);
revoke insert, update, delete on public.food_exchange_groups from authenticated;
revoke insert, update, delete on public.food_exchange_participants from authenticated;

-- DATING
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using (auth.uid() in (user_a, user_b));
revoke insert, update, delete on public.matches from authenticated;
drop policy if exists mprog_read on public.match_progress;
create policy mprog_read on public.match_progress for select to authenticated using (
  exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
revoke insert, update, delete on public.match_progress from authenticated;
revoke all on public.moderation_actions from authenticated;

-- Realtime (events list, chat messages, duels state). Guarded so re-runs don't fail.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.events'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.duels'; exception when duplicate_object then null; end;
  end if;
end $$;

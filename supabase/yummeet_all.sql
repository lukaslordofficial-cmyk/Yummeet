-- YUMMEET: all migrations in one file (paste into Supabase SQL Editor and Run)
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
-- =====================================================================
-- YUMMEET — 002_functions.sql
-- Server-side domain logic. Every privileged write goes through these
-- SECURITY DEFINER functions with a pinned search_path. Internal helpers
-- (prefixed with _) are NOT executable by clients.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------
create or replace function public._uid() returns uuid
language plpgsql stable set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return v;
end $$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.is_conversation_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conv and user_id = auth.uid());
$$;

create or replace function public.is_event_member(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_participants where event_id = p_event and user_id = auth.uid() and status <> 'left');
$$;

create or replace function public.is_exchange_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.food_exchange_participants where group_id = p_group and user_id = auth.uid());
$$;

-- Policies that need the helpers above (avoid recursive RLS)
drop policy if exists ep_read on public.event_participants;
create policy ep_read on public.event_participants for select to authenticated using (
  user_id = auth.uid() or public.is_event_member(event_id)
  or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
drop policy if exists fep_read on public.food_exchange_participants;
create policy fep_read on public.food_exchange_participants for select to authenticated using (
  user_id = auth.uid() or public.is_exchange_member(group_id));

drop policy if exists conv_read on public.conversations;
create policy conv_read on public.conversations for select to authenticated using (public.is_conversation_member(id));
revoke insert, update, delete on public.conversations from authenticated;
drop policy if exists cm_read on public.conversation_members;
create policy cm_read on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists cm_update_own on public.conversation_members;
create policy cm_update_own on public.conversation_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
drop policy if exists msg_read on public.messages;
create policy msg_read on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
revoke update, delete on public.messages from authenticated;

-- Anti-spam for chat: max 20 messages per minute per user; bumps last_message_at.
create or replace function public._trg_messages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited';
  end if;
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists trg_messages on public.messages;
create trigger trg_messages before insert on public.messages for each row execute function public._trg_messages();

-- Notifications (respects prefs, dedupe, rate limit 40/h). Push is sent later by the server dispatcher.
create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb, p_dedupe text)
returns void language plpgsql security definer set search_path = public as $$
declare v_pref text; v_enabled boolean;
begin
  v_pref := case when p_kind like 'duel%' then 'duels' when p_kind like 'event%' then 'events'
                 when p_kind like 'message%' then 'messages' when p_kind like 'mission%' then 'missions' else 'rewards' end;
  select coalesce((notification_prefs->>v_pref)::boolean, true) into v_enabled from public.profiles where id = p_user;
  if (select count(*) from public.notifications where user_id = p_user and created_at > now() - interval '1 hour') >= 40 then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, data, dedupe_key, push_status)
  values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'), p_dedupe, case when coalesce(v_enabled, true) then 'pending' else 'skipped' end)
  on conflict (user_id, dedupe_key) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- Progression: XP ledger (idempotent), levels, badges, cards
-- ---------------------------------------------------------------------
create or replace function public._award_xp(p_user uuid, p_amount int, p_source_type text, p_source_id uuid, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_rows int; v_xp int; v_level int; v_old int;
begin
  if p_amount <= 0 then return 0; end if;
  insert into public.xp_ledger (user_id, amount, source_type, source_id, note)
  values (p_user, p_amount, p_source_type, p_source_id, p_note)
  on conflict (user_id, source_type, source_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return 0; end if;   -- already awarded
  select level into v_old from public.profiles where id = p_user for update;
  update public.profiles set xp = xp + p_amount, updated_at = now() where id = p_user returning xp into v_xp;
  select coalesce(max(level), 1) into v_level from public.level_definitions where min_xp <= v_xp;
  update public.profiles set level = v_level where id = p_user;
  if v_level > v_old then
    perform public._notify(p_user, 'reward_level', 'Nowy poziom!', 'Osiągnięto poziom ' || v_level, jsonb_build_object('level', v_level), 'level:' || v_level);
  end if;
  return p_amount;
end $$;

create or replace function public._grant_card(p_user uuid, p_card uuid, p_kind text, p_rarity text, p_source_type text, p_source_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_card uuid := p_card; v_uc uuid;
begin
  if v_card is null then
    select id into v_card from public.card_definitions
     where status = 'published' and (p_kind is null or kind = p_kind) and rarity = coalesce(p_rarity, 'common')
     order by random() limit 1;
    if v_card is null then
      select id into v_card from public.card_definitions where status = 'published' and (p_kind is null or kind = p_kind) order by random() limit 1;
    end if;
  end if;
  if v_card is null then return null; end if;
  insert into public.user_cards (user_id, card_id, source_type, source_id) values (p_user, v_card, p_source_type, p_source_id) returning id into v_uc;
  insert into public.card_usage_history (user_card_id, card_id, user_id, action, source_id) values (v_uc, v_card, p_user, 'granted', p_source_id);
  return v_uc;
end $$;

create or replace function public._metric(p_user uuid, p_metric text) returns int
language sql stable security definer set search_path = public as $$
  select case p_metric
    when 'missions_completed' then (select count(*) from public.mission_completions where user_id = p_user)
    when 'cards_owned' then (select count(*) from public.user_cards where user_id = p_user and status = 'owned')
    when 'duels_won' then (select count(*) from public.duels where winner_id = p_user and status = 'finished')
    when 'events_attended' then (select count(*) from public.event_participants where user_id = p_user and status = 'attended')
    when 'pins_created' then (select count(*) from public.pins where creator_id = p_user)
    else 0 end::int;
$$;

create or replace function public._evaluate_badges(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  for b in select * from public.badge_definitions where is_active
           and code not in (select code from public.user_badges where user_id = p_user) loop
    if public._metric(p_user, b.metric) >= b.threshold then
      insert into public.user_badges (user_id, code) values (p_user, b.code) on conflict do nothing;
      perform public._notify(p_user, 'reward_badge', 'Nowa odznaka: ' || b.name, b.description, jsonb_build_object('badge', b.code), 'badge:' || b.code);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- New user bootstrap: profile, private prefs, starter deck (3 offensive + 2 defensive)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare i int;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Yummiteer'), 60),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  for i in 1..3 loop perform public._grant_card(new.id, null, 'offensive', 'common', 'starter', null); end loop;
  for i in 1..2 loop perform public._grant_card(new.id, null, 'defensive', 'common', 'starter', null); end loop;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Specializations
-- ---------------------------------------------------------------------
create or replace function public.choose_specialization(p_primary text, p_interests text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.specialization_definitions where code = p_primary and is_active) then
    raise exception 'invalid_specialization';
  end if;
  if exists (select 1 from unnest(coalesce(p_interests,'{}')) x where x not in (select code from public.specialization_definitions where is_active)) then
    raise exception 'invalid_interest';
  end if;
  delete from public.user_specializations where user_id = v;
  insert into public.user_specializations (user_id, code, is_primary) values (v, p_primary, true);
  insert into public.user_specializations (user_id, code, is_primary)
    select v, x, false from unnest(coalesce(p_interests,'{}')) x where x <> p_primary on conflict do nothing;
  update public.profiles set primary_specialization = p_primary, updated_at = now() where id = v;
end $$;

-- ---------------------------------------------------------------------
-- MAP / PINS (PostGIS). SECURITY INVOKER: RLS on pins applies.
-- ---------------------------------------------------------------------
create or replace view public.restaurant_rating_summaries with (security_invoker = true) as
select pin_id,
       count(*)::int as review_count,
       round(avg(food)::numeric, 2) as food,
       round(avg(atmosphere)::numeric, 2) as atmosphere,
       round(avg(service)::numeric, 2) as service,
       round(avg(price_value)::numeric, 2) as price_value,
       round(avg((food + atmosphere + service + price_value) / 4.0)::numeric, 2) as yummeet_score,
       count(*) filter (where 'date' = any(purposes))::int as date_votes,
       count(*) filter (where 'group' = any(purposes))::int as group_votes,
       count(*) filter (where 'meet' = any(purposes))::int as meet_votes,
       count(*) filter (where 'work' = any(purposes))::int as work_votes,
       count(*) filter (where 'party' = any(purposes))::int as party_votes,
       count(*) filter (where 'quiet' = any(purposes))::int as quiet_votes,
       count(*) filter (where visit_verified)::int as verified_count
from public.restaurant_reviews group by pin_id;
grant select on public.restaurant_rating_summaries to authenticated;

drop function if exists public.pins_in_bbox(double precision, double precision, double precision, double precision, text, integer);
drop function if exists public.pins_in_bbox(float8, float8, float8, float8, text, int);
create or replace function public.pins_in_bbox(p_south float8, p_west float8, p_north float8, p_east float8, p_cuisine text default null, p_limit int default 200)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean, score numeric, review_count int, cover_url text)
language plpgsql stable security invoker set search_path = public, extensions as $$
begin
  if p_south < -90 or p_north > 90 or p_south >= p_north or p_west < -180 or p_east > 180 or p_west >= p_east then
    raise exception 'invalid_bbox';
  end if;
  return query
  select p.id, p.title, st_y(p.coords::geometry), st_x(p.coords::geometry), p.cuisine, p.is_official, s.yummeet_score, coalesce(s.review_count, 0), p.cover_url
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published'
    and p.coords && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
    and (p_cuisine is null or p.cuisine = p_cuisine)
  order by s.yummeet_score desc nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 300);
end $$;

-- p_path: GeoJSON-style jsonb array of [lng, lat] (2..2000 points). Returns minimal fields, ordered along the route.
create or replace function public.pins_along_route(p_path jsonb, p_buffer_m int default 1000, p_limit int default 100)
returns table (id uuid, title text, lat float8, lng float8, cuisine text, is_official boolean, score numeric, review_count int, distance_m float8, along float8)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_line geometry; n int;
begin
  if jsonb_typeof(p_path) <> 'array' then raise exception 'invalid_path'; end if;
  n := jsonb_array_length(p_path);
  if n < 2 or n > 2000 then raise exception 'invalid_path_length'; end if;
  if p_buffer_m < 50 or p_buffer_m > 10000 then raise exception 'invalid_buffer'; end if;
  select st_setsrid(st_makeline(array_agg(st_makepoint((e->>0)::float8, (e->>1)::float8) order by o)), 4326)
    into v_line from jsonb_array_elements(p_path) with ordinality as t(e, o);
  if v_line is null or not st_isvalid(v_line) or st_npoints(v_line) < 2 then raise exception 'invalid_geometry'; end if;
  if st_xmin(v_line) < -180 or st_xmax(v_line) > 180 or st_ymin(v_line) < -90 or st_ymax(v_line) > 90 then raise exception 'invalid_coordinates'; end if;
  return query
  select p.id, p.title, st_y(p.coords::geometry), st_x(p.coords::geometry), p.cuisine, p.is_official, s.yummeet_score, coalesce(s.review_count, 0),
         st_distance(p.coords, v_line::geography), st_linelocatepoint(v_line, p.coords::geometry)
  from public.pins p left join public.restaurant_rating_summaries s on s.pin_id = p.id
  where p.status = 'published' and st_dwithin(p.coords, v_line::geography, p_buffer_m)
  order by st_linelocatepoint(v_line, p.coords::geometry)
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;

create or replace function public.create_pin(p_title text, p_lat float8, p_lng float8, p_description text default null, p_cuisine text default null, p_city text default null, p_price_level smallint default null)
returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare v uuid := public._uid(); v_id uuid;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if (select count(*) from public.pins where creator_id = v and created_at > now() - interval '1 day') >= 30 then raise exception 'rate_limited'; end if;
  insert into public.pins (creator_id, title, description, cuisine, city, price_level, coords)
  values (v, trim(p_title), p_description, p_cuisine, p_city, p_price_level, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.pin_details(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'cuisine', p.cuisine, 'city', p.city, 'address', p.address,
    'price_level', p.price_level, 'is_official', p.is_official, 'creator_id', p.creator_id, 'created_at', p.created_at,
    'lat', st_y(p.coords::geometry), 'lng', st_x(p.coords::geometry),
    'summary', (select to_jsonb(s) from public.restaurant_rating_summaries s where s.pin_id = p.id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'author', pr.display_name, 'food', r.food, 'atmosphere', r.atmosphere,
          'service', r.service, 'price_value', r.price_value, 'purposes', r.purposes, 'best_dish', r.best_dish, 'tip', r.tip, 'body', r.body,
          'visit_verified', r.visit_verified, 'created_at', r.created_at) order by r.created_at desc)
        from (select * from public.restaurant_reviews where pin_id = p.id order by created_at desc limit 20) r
        left join public.profiles pr on pr.id = r.user_id), '[]'::jsonb),
    'visited', exists (select 1 from public.visited_places v where v.pin_id = p.id and v.user_id = auth.uid()))
  from public.pins p where p.id = p_id;
$$;

-- Verified visit: device position must be within 150 m of the pin.
create or replace function public.mark_visited(p_pin uuid, p_lat float8, p_lng float8) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); v_ok boolean;
begin
  select st_dwithin(coords, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 150) into v_ok from public.pins where id = p_pin and status = 'published';
  if v_ok is null then raise exception 'pin_not_found'; end if;
  if not v_ok then raise exception 'too_far_from_place'; end if;
  insert into public.visited_places (user_id, pin_id, method) values (v, p_pin, 'location') on conflict do nothing;
  update public.restaurant_reviews set visit_verified = true where pin_id = p_pin and user_id = v;
  perform public._award_xp(v, 10, 'visit', p_pin, 'Zweryfikowana wizyta');
  return true;
end $$;

-- ---------------------------------------------------------------------
-- MISSIONS
-- Visibility: all missions of your primary specialization + generic ones,
-- and a stable pseudo-random 25% of other specializations' missions.
-- ---------------------------------------------------------------------
create or replace function public._mission_visible(p_user uuid, p_mission uuid, p_spec text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_spec is null
      or p_spec = (select primary_specialization from public.profiles where id = p_user)
      or abs(hashtext(p_user::text || p_mission::text)) % 100 < 25;
$$;

create or replace function public.get_mission_board()
returns table (mission_id uuid, code text, name text, description text, category text, specialization_code text, participation text,
               difficulty smallint, confirmation_method text, duration_hours int, reward_xp int, steps jsonb, safety_rules text,
               is_primary boolean, user_mission_id uuid, user_status text, expires_at timestamptz, completions int, card_reward_count int)
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_primary text;
begin
  update public.user_missions set status = 'expired'
   where user_id = v and status in ('accepted','in_progress') and user_missions.expires_at < now();
  select primary_specialization into v_primary from public.profiles where id = v;
  return query
  select m.id, m.code, m.name, m.description, m.category, m.specialization_code, m.participation, m.difficulty, m.confirmation_method,
         m.duration_hours, m.reward_xp, m.steps, m.safety_rules, (m.specialization_code = v_primary),
         um.id, coalesce(um.status, 'available'), um.expires_at,
         (select count(*)::int from public.mission_completions c where c.user_id = v and c.mission_id = m.id),
         (select coalesce(sum(cr.count), 0)::int from public.card_rewards cr where cr.mission_id = m.id)
  from public.mission_definitions m
  left join lateral (select * from public.user_missions x where x.user_id = v and x.mission_id = m.id order by x.created_at desc limit 1) um on true
  where m.is_active and public._mission_visible(v, m.id, m.specialization_code)
  order by (m.specialization_code = v_primary) desc nulls last, m.difficulty, m.name;
end $$;

create or replace function public.mission_accept(p_mission uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); m record; v_done int; v_last timestamptz; v_id uuid;
begin
  select * into m from public.mission_definitions where id = p_mission and is_active;
  if m.id is null or not public._mission_visible(v, m.id, m.specialization_code) then raise exception 'mission_not_available'; end if;
  select count(*), max(created_at) into v_done, v_last from public.mission_completions where user_id = v and mission_id = p_mission;
  if m.repeat_limit > 0 and v_done >= m.repeat_limit then raise exception 'repeat_limit_reached'; end if;
  if v_last is not null and v_last > now() - make_interval(hours => m.cooldown_hours) then raise exception 'cooldown_active'; end if;
  if (select count(*) from public.user_missions where user_id = v and created_at > now() - interval '1 day') >= 20 then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.user_missions where user_id = v and mission_id = p_mission and status in ('accepted','in_progress','pending_confirmation')) then
    raise exception 'mission_already_open';
  end if;
  insert into public.user_missions (user_id, mission_id, status, attempt_no, expires_at)
  values (v, p_mission, 'accepted', v_done + 1, now() + make_interval(hours => m.duration_hours)) returning id into v_id;
  insert into public.mission_participants (user_mission_id, user_id, role) values (v_id, v, 'participant');
  return v_id;
end $$;

create or replace function public.mission_start(p_um uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  update public.user_missions set status = 'in_progress', started_at = now()
   where id = p_um and user_id = v and status = 'accepted' and expires_at > now();
  if not found then raise exception 'invalid_transition'; end if;
end $$;

create or replace function public.mission_cancel(p_um uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  update public.user_missions set status = 'cancelled' where id = p_um and user_id = v and status in ('accepted','in_progress','pending_confirmation');
  if not found then raise exception 'invalid_transition'; end if;
end $$;

-- Internal: completes and rewards exactly once (row lock + unique completion row + unique xp ledger).
create or replace function public._complete_user_mission(p_um uuid, p_confirmer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare um record; m record; v_first boolean; v_xp int; v_cards jsonb := '[]'; r record; i int; v_uc uuid; v_cid uuid;
begin
  select * into um from public.user_missions where id = p_um for update;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status not in ('in_progress','pending_confirmation') then raise exception 'invalid_transition'; end if;
  select * into m from public.mission_definitions where id = um.mission_id;
  v_first := not exists (select 1 from public.mission_completions where user_id = um.user_id and mission_id = um.mission_id);
  v_xp := case when v_first then m.reward_xp else m.repeat_reward_xp end;
  for r in select * from public.card_rewards where mission_id = m.id and (v_first or not first_time_only) loop
    for i in 1..r.count loop
      v_uc := public._grant_card(um.user_id, r.card_id, r.kind, r.rarity, 'mission', um.id);
      if v_uc is not null then
        select card_id into v_cid from public.user_cards where id = v_uc;
        v_cards := v_cards || jsonb_build_object('user_card_id', v_uc, 'card_id', v_cid);
      end if;
    end loop;
  end loop;
  insert into public.mission_completions (user_mission_id, user_id, mission_id, is_first, xp, cards)
  values (um.id, um.user_id, um.mission_id, v_first, v_xp, v_cards);
  update public.user_missions set status = 'completed', completed_at = now(), confirmer_id = coalesce(p_confirmer, confirmer_id) where id = um.id;
  perform public._award_xp(um.user_id, v_xp, 'mission', um.id, m.name);
  perform public._evaluate_badges(um.user_id);
  perform public._notify(um.user_id, 'reward_mission', 'Misja ukończona: ' || m.name, '+' || v_xp || ' XP, kart: ' || jsonb_array_length(v_cards),
                         jsonb_build_object('user_mission_id', um.id), 'mission_done:' || um.id);
  return jsonb_build_object('completed', true, 'xp', v_xp, 'cards', v_cards, 'first', v_first);
end $$;

-- Submit proof. 'self' and valid 'code'/'location' complete immediately;
-- 'peer'/'organizer'/'photo' need confirmation by the nominated other user.
create or replace function public.mission_submit(p_um uuid, p_kind text, p_content text, p_confirmer uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); um record; m record; v_code text; v_lat float8; v_lng float8;
begin
  select * into um from public.user_missions where id = p_um and user_id = v for update;
  if um.id is null then raise exception 'not_found'; end if;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
  if um.expires_at < now() then
    update public.user_missions set status = 'expired' where id = p_um;
    return jsonb_build_object('expired', true);
  end if;
  select * into m from public.mission_definitions where id = um.mission_id;
  if p_content is null or char_length(p_content) > 2000 then raise exception 'invalid_evidence'; end if;
  insert into public.mission_evidence (user_mission_id, user_id, kind, content) values (p_um, v, p_kind, p_content);

  if m.confirmation_method = 'self' then
    return public._complete_user_mission(p_um, null);
  elsif m.confirmation_method = 'code' then
    select confirmation_code into v_code from public.mission_secrets where mission_id = m.id;
    if v_code is null or upper(trim(p_content)) <> upper(v_code) then raise exception 'invalid_code'; end if;
    return public._complete_user_mission(p_um, null);
  elsif m.confirmation_method = 'location' then
    v_lat := split_part(p_content, ',', 1)::float8; v_lng := split_part(p_content, ',', 2)::float8;
    if m.pin_id is null or not exists (select 1 from public.pins where id = m.pin_id and st_dwithin(coords, st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography, 200)) then
      raise exception 'too_far_from_place';
    end if;
    return public._complete_user_mission(p_um, null);
  else
    if p_confirmer is null or p_confirmer = v then raise exception 'confirmer_required'; end if;
    if public.is_blocked(v, p_confirmer) then raise exception 'blocked'; end if;
    update public.user_missions set status = 'pending_confirmation', submitted_at = now(), confirmer_id = p_confirmer where id = p_um;
    insert into public.mission_participants (user_mission_id, user_id, role) values (p_um, p_confirmer, 'confirmer') on conflict do nothing;
    perform public._notify(p_confirmer, 'mission_confirm', 'Prośba o potwierdzenie misji', m.name, jsonb_build_object('user_mission_id', p_um), 'mission_confirm:' || p_um);
    return jsonb_build_object('pending_confirmation', true);
  end if;
end $$;

-- Only the nominated confirmer (never the owner) can confirm or reject.
create or replace function public.mission_confirm(p_um uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); um record;
begin
  select * into um from public.user_missions where id = p_um for update;
  if um.id is null or um.confirmer_id is distinct from v or um.user_id = v then raise exception 'not_allowed'; end if;
  if um.status = 'completed' then return jsonb_build_object('already_completed', true); end if;
  if um.status <> 'pending_confirmation' then raise exception 'invalid_transition'; end if;
  if p_approve then return public._complete_user_mission(p_um, v); end if;
  update public.user_missions set status = 'rejected' where id = p_um;
  return jsonb_build_object('rejected', true);
end $$;

-- ---------------------------------------------------------------------
-- DUELS
-- ---------------------------------------------------------------------
create or replace function public._rps_winner(a text, b text) returns int
language sql immutable as $$
  select case when a = b then 0
              when (a = 'rock' and b = 'scissors') or (a = 'scissors' and b = 'paper') or (a = 'paper' and b = 'rock') then 1
              else 2 end;
$$;

create or replace function public._duel_transfer_card(p_duel uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d record; v_uc record; v_new uuid;
begin
  select * into d from public.duels where id = p_duel;
  select * into v_uc from public.user_cards where user_id = d.defender_id and status = 'owned' order by random() limit 1 for update;
  if v_uc.id is null then return null; end if;
  update public.user_cards set status = 'lost', status_changed_at = now() where id = v_uc.id;
  insert into public.card_usage_history (user_card_id, card_id, user_id, action, duel_id) values (v_uc.id, v_uc.card_id, d.defender_id, 'lost', p_duel);
  insert into public.user_cards (user_id, card_id, source_type, source_id) values (d.attacker_id, v_uc.card_id, 'duel', p_duel) returning id into v_new;
  insert into public.card_usage_history (user_card_id, card_id, user_id, action, duel_id) values (v_new, v_uc.card_id, d.attacker_id, 'won', p_duel);
  update public.duels set penalty_user_card_id = v_uc.id where id = p_duel;
  perform public._notify(d.defender_id, 'duel_card_lost', 'Utracono kartę w pojedynku', null, jsonb_build_object('duel_id', p_duel), 'duel_lost:' || p_duel);
  perform public._notify(d.attacker_id, 'duel_card_won', 'Zdobyto kartę w pojedynku', null, jsonb_build_object('duel_id', p_duel), 'duel_won:' || p_duel);
  return v_uc.id;
end $$;

create or replace function public._duel_finish(p_duel uuid, p_outcome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.duels set status = 'finished', outcome = p_outcome, finished_at = now(), updated_at = now() where id = p_duel;
end $$;

-- Starts the challenge (attacker's offensive card already set).
create or replace function public._duel_start_challenge(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record; v_hours int;
begin
  select * into d from public.duels where id = p_duel;
  select challenge_hours into v_hours from public.card_definitions where id = d.offensive_card_id;
  update public.duels set status = 'active_challenge', challenge_deadline = now() + make_interval(hours => coalesce(v_hours, 48)),
         response_deadline = null, updated_at = now() where id = p_duel;
  perform public._notify(d.defender_id, 'duel_challenge', 'Masz wyzwanie do wykonania!', d.challenge_text, jsonb_build_object('duel_id', p_duel), 'duel_challenge:' || p_duel);
end $$;

create or replace function public._duel_resolve_round(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record; mc text; mo text; w int; v_winner uuid; v_card record; v_has_def boolean;
begin
  select * into d from public.duels where id = p_duel for update;
  select move into mc from public.duel_moves where duel_id = p_duel and phase = d.phase and round_no = d.current_round and user_id = d.challenger_id;
  select move into mo from public.duel_moves where duel_id = p_duel and phase = d.phase and round_no = d.current_round and user_id = d.opponent_id;
  if mc is null or mo is null then return; end if;
  w := public._rps_winner(mc, mo);
  v_winner := case w when 1 then d.challenger_id when 2 then d.opponent_id else null end;
  insert into public.duel_rounds (duel_id, phase, round_no, challenger_move, opponent_move, winner_id)
  values (p_duel, d.phase, d.current_round, mc, mo, v_winner) on conflict do nothing;
  if v_winner is null then   -- tie: play again
    update public.duels set current_round = current_round + 1, response_deadline = now() + interval '30 minutes', updated_at = now() where id = p_duel;
    return;
  end if;
  perform public._duel_after_round(p_duel, v_winner);
end $$;

-- Applies the result of a decided RPS round (also used for walkovers).
create or replace function public._duel_after_round(p_duel uuid, p_winner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record; v_card record; v_loser uuid; v_has_def boolean;
begin
  select * into d from public.duels where id = p_duel;
  if d.phase = 'attack' then
    v_loser := case when p_winner = d.challenger_id then d.opponent_id else d.challenger_id end;
    select uc.id, uc.card_id, cd.challenge_text, cd.name into v_card
      from public.user_cards uc join public.card_definitions cd on cd.id = uc.card_id
     where uc.user_id = p_winner and uc.status = 'owned' and cd.kind = 'offensive' order by random() limit 1;
    update public.duels set winner_id = p_winner, attacker_id = p_winner, defender_id = v_loser, updated_at = now() where id = p_duel;
    if v_card.id is null then
      perform public._duel_finish(p_duel, 'no_offensive_card');
      return;
    end if;
    insert into public.card_usage_history (user_card_id, card_id, user_id, action, duel_id) values (v_card.id, v_card.card_id, p_winner, 'played_offense', p_duel);
    update public.duels set offensive_user_card_id = v_card.id, offensive_card_id = v_card.card_id,
           challenge_text = coalesce(v_card.challenge_text, v_card.name), phase = 'defense', current_round = 1,
           status = 'awaiting_response', response_deadline = now() + interval '30 minutes' where id = p_duel;
    perform public._notify(v_loser, 'duel_defense', 'Zagrano przeciwko Tobie kartę: ' || v_card.name, 'Zagraj o prawo do obrony!', jsonb_build_object('duel_id', p_duel), 'duel_def:' || p_duel);
  else
    if p_winner = d.defender_id then
      select exists (select 1 from public.user_cards uc join public.card_definitions cd on cd.id = uc.card_id
                      where uc.user_id = d.defender_id and uc.status = 'owned' and cd.kind = 'defensive') into v_has_def;
      update public.duels set defense_won = true, updated_at = now() where id = p_duel;
      if v_has_def then
        update public.duels set status = 'awaiting_card', response_deadline = now() + interval '30 minutes' where id = p_duel;
        return;
      end if;
    else
      update public.duels set defense_won = false where id = p_duel;
    end if;
    perform public._duel_start_challenge(p_duel);
  end if;
end $$;

create or replace function public.duel_invite(p_opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_name text;
begin
  if p_opponent = v then raise exception 'cannot_duel_self'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent) then raise exception 'user_not_found'; end if;
  if public.is_blocked(v, p_opponent) then raise exception 'blocked'; end if;
  if exists (select 1 from public.duels where status not in ('finished','cancelled','rejected','expired')
             and ((challenger_id = v and opponent_id = p_opponent) or (challenger_id = p_opponent and opponent_id = v))) then
    raise exception 'duel_already_open';
  end if;
  if (select count(*) from public.duels where challenger_id = v and created_at > now() - interval '1 day') >= 15 then raise exception 'rate_limited'; end if;
  insert into public.duels (mode, challenger_id, opponent_id, status, response_deadline)
  values ('invite', v, p_opponent, 'pending_acceptance', now() + interval '24 hours') returning id into v_id;
  select display_name into v_name from public.profiles where id = v;
  perform public._notify(p_opponent, 'duel_invite', v_name || ' wyzywa Cię na pojedynek!', 'Możesz przyjąć lub odmówić.', jsonb_build_object('duel_id', v_id), 'duel_invite:' || v_id);
  return v_id;
end $$;

create or replace function public.duel_respond(p_duel uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record; v_conv uuid;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or d.opponent_id <> v then raise exception 'not_allowed'; end if;
  if d.status <> 'pending_acceptance' then raise exception 'invalid_transition'; end if;
  if d.response_deadline < now() then
    update public.duels set status = 'expired', updated_at = now() where id = p_duel; return;
  end if;
  if not p_accept then
    update public.duels set status = 'rejected', updated_at = now(), finished_at = now() where id = p_duel; return;
  end if;
  update public.duels set status = 'round1', response_deadline = now() + interval '30 minutes', updated_at = now() where id = p_duel;
  insert into public.conversations (kind, ref_id, title, created_by) values ('duel', p_duel, 'Pojedynek', v)
    on conflict (kind, ref_id) where ref_id is not null do nothing returning id into v_conv;
  if v_conv is not null then
    insert into public.conversation_members (conversation_id, user_id) values (v_conv, d.challenger_id), (v_conv, d.opponent_id) on conflict do nothing;
  end if;
  perform public._notify(d.challenger_id, 'duel_accepted', 'Pojedynek przyjęty!', 'Czas na kamień-papier-nożyce.', jsonb_build_object('duel_id', p_duel), 'duel_acc:' || p_duel);
end $$;

-- Cancel is allowed before any round is decided, but proximity duels are mandatory (they expire on timeout instead).
create or replace function public.duel_cancel(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or v not in (d.challenger_id, d.opponent_id) then raise exception 'not_allowed'; end if;
  if d.status = 'pending_acceptance' or (d.status = 'round1' and d.mode = 'invite') then
    update public.duels set status = 'cancelled', updated_at = now(), finished_at = now() where id = p_duel;
  else
    raise exception 'invalid_transition';
  end if;
end $$;

create or replace function public.duel_play(p_duel uuid, p_move text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record;
begin
  if p_move not in ('rock','paper','scissors') then raise exception 'invalid_move'; end if;
  perform public.duel_tick(p_duel);
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or v not in (d.challenger_id, d.opponent_id) then raise exception 'not_allowed'; end if;
  if d.status not in ('round1','awaiting_response') then raise exception 'invalid_transition'; end if;
  insert into public.duel_moves (duel_id, phase, round_no, user_id, move) values (p_duel, d.phase, d.current_round, v, p_move)
    on conflict do nothing;
  if not found then raise exception 'move_already_played'; end if;
  perform public._duel_resolve_round(p_duel);
  select * into d from public.duels where id = p_duel;
  return jsonb_build_object('status', d.status, 'phase', d.phase, 'round', d.current_round);
end $$;

-- Defender (after winning the defense round) plays a defensive card, or passes (null).
create or replace function public.duel_play_defense(p_duel uuid, p_user_card uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record; c record;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or d.defender_id <> v then raise exception 'not_allowed'; end if;
  if d.status <> 'awaiting_card' then raise exception 'invalid_transition'; end if;
  if p_user_card is not null then
    select uc.id, uc.card_id, cd.code, cd.name, cd.effect into c from public.user_cards uc join public.card_definitions cd on cd.id = uc.card_id
     where uc.id = p_user_card and uc.user_id = v and uc.status = 'owned' and cd.kind = 'defensive';
    if c.id is null then raise exception 'invalid_card'; end if;
    insert into public.card_usage_history (user_card_id, card_id, user_id, action, duel_id) values (c.id, c.card_id, v, 'played_defense', p_duel);
    update public.duels set defensive_user_card_id = c.id, defensive_card_id = c.card_id, challenge_variant = c.name || ': ' || c.effect, updated_at = now() where id = p_duel;
    if c.code = 'odmowa_bez_kary' then
      perform public._duel_finish(p_duel, 'refused_without_penalty');
      return;
    end if;
  end if;
  perform public._duel_start_challenge(p_duel);
end $$;

create or replace function public.duel_submit_evidence(p_duel uuid, p_evidence text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record;
begin
  perform public.duel_tick(p_duel);
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or d.defender_id <> v then raise exception 'not_allowed'; end if;
  if d.status <> 'active_challenge' then raise exception 'invalid_transition'; end if;
  if p_evidence is null or char_length(trim(p_evidence)) < 3 or char_length(p_evidence) > 2000 then raise exception 'invalid_evidence'; end if;
  update public.duels set status = 'awaiting_confirmation', evidence = p_evidence, evidence_at = now(), updated_at = now() where id = p_duel;
  perform public._notify(d.attacker_id, 'duel_evidence', 'Przeciwnik zgłosił wykonanie wyzwania', 'Potwierdź odbiór.', jsonb_build_object('duel_id', p_duel), 'duel_ev:' || p_duel);
end $$;

-- Attacker confirms. A rejection does not transfer cards automatically: it opens a dispute for moderation.
create or replace function public.duel_confirm(p_duel uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or d.attacker_id <> v then raise exception 'not_allowed'; end if;
  if d.status <> 'awaiting_confirmation' then raise exception 'invalid_transition'; end if;
  if p_accept then
    perform public._duel_finish(p_duel, 'challenge_completed');
    perform public._award_xp(d.defender_id, 30, 'duel_challenge', p_duel, 'Wykonane wyzwanie z pojedynku');
  else
    perform public._duel_finish(p_duel, 'disputed');
    insert into public.reports (reporter_id, target_type, target_id, reason, details) values (v, 'duel', p_duel, 'duel_dispute', d.evidence);
  end if;
  perform public._award_xp(d.attacker_id, 15, 'duel_win', p_duel, 'Wygrany pojedynek');
  perform public._evaluate_badges(d.attacker_id);
end $$;

-- Defender declines the challenge: the only allowed penalty is losing one random card.
create or replace function public.duel_forfeit(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null or d.defender_id <> v then raise exception 'not_allowed'; end if;
  if d.status <> 'active_challenge' then raise exception 'invalid_transition'; end if;
  perform public._duel_transfer_card(p_duel);
  perform public._duel_finish(p_duel, 'forfeited');
end $$;

-- Timeout handling (lazy, callable by participants; can also run from a cron job).
create or replace function public.duel_tick(p_duel uuid) returns text
language plpgsql security definer set search_path = public as $$
declare d record; v_only uuid; v_cnt int;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.id is null then raise exception 'not_found'; end if;
  if auth.uid() is not null and auth.uid() not in (d.challenger_id, d.opponent_id) then raise exception 'not_allowed'; end if;
  if d.status = 'pending_acceptance' and d.response_deadline < now() then
    update public.duels set status = 'expired', updated_at = now() where id = p_duel;
  elsif d.status in ('round1','awaiting_response') and d.response_deadline < now() then
    select count(*), max(user_id::text)::uuid into v_cnt, v_only from public.duel_moves where duel_id = p_duel and phase = d.phase and round_no = d.current_round;
    if v_cnt = 1 then
      insert into public.duel_rounds (duel_id, phase, round_no, winner_id) values (p_duel, d.phase, d.current_round, v_only) on conflict do nothing;
      perform public._duel_after_round(p_duel, v_only);
    elsif d.phase = 'attack' then
      update public.duels set status = 'expired', updated_at = now() where id = p_duel;
    else
      -- defender did not play the defense round: attacker wins it by walkover
      perform public._duel_after_round(p_duel, d.attacker_id);
    end if;
  elsif d.status = 'awaiting_card' and d.response_deadline < now() then
    perform public._duel_start_challenge(p_duel);
  elsif d.status = 'active_challenge' and d.challenge_deadline < now() then
    perform public._duel_transfer_card(p_duel);
    perform public._duel_finish(p_duel, 'challenge_failed');
  elsif d.status = 'awaiting_confirmation' and d.evidence_at < now() - interval '48 hours' then
    perform public._duel_finish(p_duel, 'challenge_completed');   -- attacker did not review in time
  end if;
  select status into d.status from public.duels where id = p_duel;
  return d.status;
end $$;

create or replace function public.duel_state(p_duel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); d record;
begin
  perform public.duel_tick(p_duel);
  select * into d from public.duels where id = p_duel;
  if d.id is null or v not in (d.challenger_id, d.opponent_id) then raise exception 'not_allowed'; end if;
  return to_jsonb(d) || jsonb_build_object(
    'challenger_name', (select display_name from public.profiles where id = d.challenger_id),
    'opponent_name', (select display_name from public.profiles where id = d.opponent_id),
    'my_move_played', exists (select 1 from public.duel_moves where duel_id = p_duel and phase = d.phase and round_no = d.current_round and user_id = v),
    'offensive_card', (select to_jsonb(c) from public.card_definitions c where c.id = d.offensive_card_id),
    'defensive_card', (select to_jsonb(c) from public.card_definitions c where c.id = d.defensive_card_id),
    'rounds', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.duel_rounds r where r.duel_id = p_duel), '[]'::jsonb),
    'conversation_id', (select id from public.conversations where kind = 'duel' and ref_id = p_duel));
end $$;

create or replace function public.duel_leaderboard(p_limit int default 50)
returns table (user_id uuid, display_name text, wins int, losses int, cards_won int, cards_lost int)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name,
    (select count(*)::int from public.duels d where d.winner_id = p.id),
    (select count(*)::int from public.duels d where d.winner_id is not null and d.winner_id <> p.id and p.id in (d.challenger_id, d.opponent_id)),
    (select count(*)::int from public.card_usage_history h where h.user_id = p.id and h.action = 'won'),
    (select count(*)::int from public.card_usage_history h where h.user_id = p.id and h.action = 'lost')
  from public.profiles p
  where coalesce(p.visibility->>'stats','public') = 'public' or p.id = auth.uid()
  order by 3 desc, 5 desc limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------
-- PROXIMITY DUELS (opt-in "duel mode", foreground only, no history kept)
-- ---------------------------------------------------------------------
create or replace function public.set_duel_mode(p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  update public.profiles set duel_mode_enabled = p_enabled, updated_at = now() where id = v;
  if not p_enabled then delete from public.user_location_presence where user_id = v; end if;
end $$;

-- Returns only ids of newly created duels; never coordinates, distances or counts of nearby users.
create or replace function public.presence_ping(p_lat float8, p_lng float8) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._uid(); prev record; v_pt geography; v_speed float8; o record; v_id uuid; v_created uuid[] := '{}';
begin
  if not (select duel_mode_enabled from public.profiles where id = v) then raise exception 'duel_mode_disabled'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  select * into prev from public.user_location_presence where user_id = v;
  if prev.user_id is not null then
    if prev.updated_at > now() - interval '20 seconds' then return jsonb_build_object('throttled', true, 'duels', '[]'::jsonb); end if;
    v_speed := st_distance(prev.coords, v_pt) / greatest(extract(epoch from now() - prev.updated_at), 1);
    if v_speed > 70 then   -- > 250 km/h: likely spoofed
      update public.user_location_presence set suspicious_count = suspicious_count + 1, updated_at = now() where user_id = v;
      return jsonb_build_object('suspicious', true, 'duels', '[]'::jsonb);
    end if;
  end if;
  insert into public.user_location_presence (user_id, coords, updated_at) values (v, v_pt, now())
    on conflict (user_id) do update set coords = excluded.coords, updated_at = now();
  delete from public.user_location_presence where updated_at < now() - interval '10 minutes';
  if coalesce(prev.suspicious_count, 0) >= 5 then return jsonb_build_object('duels', '[]'::jsonb); end if;
  for o in
    select lp.user_id from public.user_location_presence lp join public.profiles p on p.id = lp.user_id
     where lp.user_id <> v and p.duel_mode_enabled and lp.updated_at > now() - interval '2 minutes' and lp.suspicious_count < 5
       and st_dwithin(lp.coords, v_pt, 100)
       and not public.is_blocked(v, lp.user_id)
       and not exists (select 1 from public.duels d where d.mode = 'proximity' and d.created_at > now() - interval '12 hours'
                        and ((d.challenger_id = v and d.opponent_id = lp.user_id) or (d.challenger_id = lp.user_id and d.opponent_id = v)))
       and not exists (select 1 from public.duels d where d.status not in ('finished','cancelled','rejected','expired')
                        and ((d.challenger_id = v and d.opponent_id = lp.user_id) or (d.challenger_id = lp.user_id and d.opponent_id = v)))
     limit 1
  loop
    insert into public.duels (mode, challenger_id, opponent_id, status, response_deadline)
    values ('proximity', v, o.user_id, 'round1', now() + interval '15 minutes') returning id into v_id;
    v_created := v_created || v_id;
    perform public._notify(v, 'duel_proximity', 'Yummiteer w pobliżu — pojedynek!', 'Wchodzisz w tryb pojedynku.', jsonb_build_object('duel_id', v_id), 'duel_prox:' || v_id);
    perform public._notify(o.user_id, 'duel_proximity', 'Yummiteer w pobliżu — pojedynek!', 'Wchodzisz w tryb pojedynku.', jsonb_build_object('duel_id', v_id), 'duel_prox:' || v_id);
  end loop;
  return jsonb_build_object('duels', to_jsonb(v_created));
end $$;

-- ---------------------------------------------------------------------
-- EVENTS / OPEN TABLES
-- ---------------------------------------------------------------------
create or replace function public.event_create(p_title text, p_place_name text, p_starts_at timestamptz, p_capacity int,
  p_kind text default 'open_table', p_description text default null, p_theme text default null, p_rules text default null,
  p_pin uuid default null, p_discount text default null, p_business uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_id uuid; v_conv uuid; v_official boolean := false;
begin
  if p_starts_at < now() then raise exception 'starts_in_past'; end if;
  if p_kind not in ('open_table','speed_friending','official','food_exchange','volunteer','dinner') then raise exception 'invalid_kind'; end if;
  if p_business is not null then
    if not exists (select 1 from public.business_profiles where id = p_business and owner_id = v) then raise exception 'not_business_owner'; end if;
    v_official := true;
  elsif p_kind = 'official' then raise exception 'official_requires_business';
  end if;
  if (select count(*) from public.events where organizer_id = v and created_at > now() - interval '1 day') >= 10 then raise exception 'rate_limited'; end if;
  insert into public.events (kind, organizer_id, business_id, pin_id, title, description, place_name, starts_at, capacity, theme, rules, discount_text, is_official, seats_taken)
  values (p_kind, v, p_business, p_pin, trim(p_title), p_description, p_place_name, p_starts_at, p_capacity, p_theme, p_rules,
          case when v_official then p_discount else null end, v_official, 1)
  returning id into v_id;
  insert into public.event_participants (event_id, user_id) values (v_id, v);
  insert into public.event_secrets (event_id, checkin_code) values (v_id, upper(substr(md5(random()::text), 1, 6)));
  insert into public.conversations (kind, ref_id, title, created_by) values ('event', v_id, trim(p_title), v) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v);
  return v_id;
end $$;

-- Concurrency-safe: the event row is locked while seats are counted.
create or replace function public.event_join(p_event uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); e record; v_prev text; v_conv uuid;
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null then raise exception 'not_found'; end if;
  select status into v_prev from public.event_participants where event_id = p_event and user_id = v;
  if v_prev in ('joined','attended') then return jsonb_build_object('already_joined', true); end if;
  if e.status = 'full' or e.seats_taken >= e.capacity then raise exception 'event_full'; end if;
  if e.status <> 'open' or e.starts_at < now() then raise exception 'event_closed'; end if;
  if e.organizer_id is not null and public.is_blocked(v, e.organizer_id) then raise exception 'blocked'; end if;
  if e.seats_taken >= e.capacity then raise exception 'event_full'; end if;
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

create or replace function public.event_leave(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); e record;
begin
  select * into e from public.events where id = p_event for update;
  if e.organizer_id = v then raise exception 'organizer_cannot_leave'; end if;
  update public.event_participants set status = 'left' where event_id = p_event and user_id = v and status = 'joined';
  if not found then raise exception 'not_joined'; end if;
  update public.events set seats_taken = greatest(seats_taken - 1, 0), status = case when status = 'full' then 'open' else status end, updated_at = now() where id = p_event;
  delete from public.conversation_members where user_id = v and conversation_id = (select id from public.conversations where kind = 'event' and ref_id = p_event);
end $$;

create or replace function public.event_checkin_code(p_event uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  if not exists (select 1 from public.events where id = p_event and organizer_id = v) then raise exception 'not_allowed'; end if;
  return (select checkin_code from public.event_secrets where event_id = p_event);
end $$;

create or replace function public.event_checkin(p_event uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); e record;
begin
  select * into e from public.events where id = p_event;
  if e.starts_at > now() + interval '2 hours' then raise exception 'too_early'; end if;
  if not exists (select 1 from public.event_participants where event_id = p_event and user_id = v and status in ('joined','attended')) then raise exception 'not_joined'; end if;
  if upper(trim(p_code)) <> (select checkin_code from public.event_secrets where event_id = p_event) then raise exception 'invalid_code'; end if;
  update public.event_participants set status = 'attended', attended_at = coalesce(attended_at, now()) where event_id = p_event and user_id = v;
  perform public._award_xp(v, 25, 'event_attendance', p_event, e.title);
  perform public._evaluate_badges(v);
  return jsonb_build_object('attended', true);
end $$;

create or replace function public.event_participants_list(p_event uuid)
returns table (user_id uuid, display_name text, primary_specialization text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_event_member(p_event) or exists (select 1 from public.events where id = p_event and organizer_id = auth.uid())) then
    return;   -- non-participants see only the seats counter
  end if;
  return query select ep.user_id, case when coalesce(p.visibility->>'profile','public') = 'public' then p.display_name else 'Yummiteer' end,
                      p.primary_specialization, ep.status
               from public.event_participants ep join public.profiles p on p.id = ep.user_id
               where ep.event_id = p_event and ep.status <> 'left';
end $$;

-- ---------------------------------------------------------------------
-- CHAT
-- ---------------------------------------------------------------------
create or replace function public.chat_open_direct(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); v_conv uuid;
begin
  if p_other = v then raise exception 'invalid_user'; end if;
  if public.is_blocked(v, p_other) then raise exception 'blocked'; end if;
  select c.id into v_conv from public.conversations c
   where c.kind = 'direct' and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = v)
     and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = p_other) limit 1;
  if v_conv is not null then return v_conv; end if;
  insert into public.conversations (kind, created_by) values ('direct', v) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v), (v_conv, p_other);
  return v_conv;
end $$;

create or replace function public.my_conversations()
returns table (id uuid, kind text, title text, last_message_at timestamptz, last_body text, other_name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.title, c.last_message_at,
         (select body from public.messages m where m.conversation_id = c.id order by created_at desc limit 1),
         (select p.display_name from public.conversation_members cm join public.profiles p on p.id = cm.user_id
           where cm.conversation_id = c.id and cm.user_id <> auth.uid() limit 1)
  from public.conversations c join public.conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid()
  order by coalesce(c.last_message_at, c.created_at) desc limit 100;
$$;

-- ---------------------------------------------------------------------
-- FOOD EXCHANGE "All Random": derangement assignment after everyone accepted rules
-- ---------------------------------------------------------------------
create or replace function public.food_exchange_draw(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); ids uuid[]; n int; i int;
begin
  if not exists (select 1 from public.food_exchange_groups where id = p_group and organizer_id = v and status in ('gathering','rules_accepted')) then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.food_exchange_participants where group_id = p_group and status = 'joined' and not rules_accepted) then raise exception 'rules_not_accepted'; end if;
  select array_agg(user_id order by random()) into ids from public.food_exchange_participants where group_id = p_group and status = 'joined';
  n := coalesce(array_length(ids, 1), 0);
  if n < 2 then raise exception 'not_enough_participants'; end if;
  for i in 1..n loop
    update public.food_exchange_participants set gives_to = ids[(i % n) + 1] where group_id = p_group and user_id = ids[i];
  end loop;
  update public.food_exchange_groups set status = 'assigned' where id = p_group;
end $$;

-- ---------------------------------------------------------------------
-- DATING: level transitions require mutual consent; level 3 never implies a private place.
-- ---------------------------------------------------------------------
create or replace function public.match_request_level(p_match uuid, p_level smallint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid(); m record;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or v not in (m.user_a, m.user_b) then raise exception 'not_allowed'; end if;
  if m.status = 'ended' then raise exception 'match_ended'; end if;
  if p_level <> m.level + 1 and not (m.status = 'proposed' and p_level = 1) then raise exception 'invalid_level'; end if;
  if v = m.user_a then update public.matches set a_wants_level = p_level, updated_at = now() where id = p_match;
  else update public.matches set b_wants_level = p_level, updated_at = now() where id = p_match; end if;
  insert into public.match_progress (match_id, level, event, by_user) values (p_match, p_level, 'consent', v);
  select * into m from public.matches where id = p_match;
  if m.a_wants_level >= p_level and m.b_wants_level >= p_level then
    update public.matches set level = p_level, status = 'active', updated_at = now() where id = p_match;
    insert into public.match_progress (match_id, level, event, by_user) values (p_match, p_level, 'level_started', null);
    return jsonb_build_object('level', p_level, 'started', true);
  end if;
  return jsonb_build_object('level', m.level, 'waiting_for_other', true);
end $$;

create or replace function public.match_end(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  update public.matches set status = 'ended', updated_at = now() where id = p_match and v in (user_a, user_b);
  if not found then raise exception 'not_allowed'; end if;
  insert into public.match_progress (match_id, level, event, by_user) select id, level, 'ended', v from public.matches where id = p_match;
end $$;

-- ---------------------------------------------------------------------
-- PROFILE / STATS / ACCOUNT
-- ---------------------------------------------------------------------
create or replace function public.profile_stats(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._uid(); vis text;
begin
  select coalesce(visibility->>'stats','public') into vis from public.profiles where id = p_user;
  if p_user <> v and (vis is null or vis <> 'public' or public.is_blocked(v, p_user)) then return null; end if;
  return jsonb_build_object(
    'missions_completed', public._metric(p_user, 'missions_completed'),
    'visited_places', (select count(*) from public.visited_places where user_id = p_user),
    'events_attended', public._metric(p_user, 'events_attended'),
    'meals_exchanged', (select count(*) from public.food_handoffs where recipient_id = p_user and status = 'received'),
    'cards_owned', public._metric(p_user, 'cards_owned'),
    'duels_won', (select count(*) from public.duels where winner_id = p_user),
    'duels_lost', (select count(*) from public.duels where winner_id is not null and winner_id <> p_user and p_user in (challenger_id, opponent_id)),
    'cards_won', (select count(*) from public.card_usage_history where user_id = p_user and action = 'won'),
    'cards_lost', (select count(*) from public.card_usage_history where user_id = p_user and action = 'lost'),
    'pins_created', public._metric(p_user, 'pins_created'),
    'travel_km', 0);   -- verified travel distance not tracked yet (no unverified declarations)
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._uid();
begin
  delete from auth.users where id = v;   -- cascades to profiles and all user-owned data
end $$;

-- ---------------------------------------------------------------------
-- EXECUTE PERMISSIONS: lock internal helpers, expose public RPCs to signed-in users only
-- ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
             and p.proname in ('_uid','is_blocked','is_conversation_member','is_event_member','is_exchange_member','_trg_messages','_notify','_award_xp','_grant_card',
               '_metric','_evaluate_badges','handle_new_user','choose_specialization','pins_in_bbox','pins_along_route','create_pin','pin_details','mark_visited',
               '_mission_visible','get_mission_board','mission_accept','mission_start','mission_cancel','_complete_user_mission','mission_submit','mission_confirm',
               '_rps_winner','_duel_transfer_card','_duel_finish','_duel_start_challenge','_duel_resolve_round','_duel_after_round','duel_invite','duel_respond',
               'duel_cancel','duel_play','duel_play_defense','duel_submit_evidence','duel_confirm','duel_forfeit','duel_tick','duel_state','duel_leaderboard',
               'set_duel_mode','presence_ping','event_create','event_join','event_leave','event_checkin_code','event_checkin','event_participants_list',
               'chat_open_direct','my_conversations','food_exchange_draw','match_request_level','match_end','profile_stats','delete_my_account')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if left(f.proname, 1) = '_' or f.proname = 'handle_new_user' then
      execute format('revoke all on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
-- _uid is used inside SECURITY INVOKER functions too, so signed-in users need it (it only reads auth.uid()).
grant execute on function public._uid() to authenticated;
-- =====================================================================
-- YUMMEET — 003_seed.sql  (demo content; safe to re-run)
-- Content is data, not code: add specializations, missions, cards by inserting rows.
-- =====================================================================
insert into public.specialization_definitions (code, name, description, color, icon, card_affinity, sort) values
 ('critic',   'Krytyk Gastronomiczny', 'Odkrywa restauracje, testuje dania i pomaga społeczności znaleźć najlepsze miejsca.', '#2C2520', 'silverware-fork-knife', '{explorer,taster,strategy}', 1),
 ('chef',     'Mistrz Kuchni', 'Gotuje, eksperymentuje i dzieli się jedzeniem.', '#A27E5D', 'chef-hat', '{culinary,tasting}', 2),
 ('rescuer',  'Ratownik Żywności', 'Ogranicza marnowanie żywności i pomaga potrzebującym.', '#38A342', 'leaf', '{solidarity,logistics}', 3),
 ('connector','Łącznik Stołu', 'Organizuje spotkania i poznaje nowych ludzi.', '#F4A261', 'account-group', '{hospitality,integration}', 4),
 ('romantic', 'Romantyk Kulinarnej Przygody', 'Wykorzystuje jedzenie do poznawania potencjalnych partnerów.', '#A0153E', 'heart', '{tasting,courage,creativity}', 5),
 ('explorer', 'Odkrywca Kulinarnego Świata', 'Podróżuje, planuje trasy i odkrywa nowe kuchnie.', '#E05F36', 'compass', '{travel,exploration,collector}', 6)
on conflict (code) do update set name = excluded.name, description = excluded.description, color = excluded.color, icon = excluded.icon;

insert into public.level_definitions (level, name, min_xp) values
 (1, 'Nowicjusz', 0), (2, 'Smakosz', 100), (3, 'Odkrywca', 300), (4, 'Łącznik', 700), (5, 'Mistrz Stołu', 1500)
on conflict (level) do update set name = excluded.name, min_xp = excluded.min_xp;

insert into public.badge_definitions (code, name, description, icon, metric, threshold) values
 ('first_mission', 'Pierwsza misja', 'Ukończ pierwszą misję', 'flag-checkered', 'missions_completed', 1),
 ('mission_5', 'Poszukiwacz przygód', 'Ukończ 5 misji', 'sword', 'missions_completed', 5),
 ('collector_10', 'Kolekcjoner', 'Posiadaj 10 kart', 'cards', 'cards_owned', 10),
 ('duelist', 'Pojedynkowicz', 'Wygraj pierwszy pojedynek', 'sword-cross', 'duels_won', 1),
 ('table_guest', 'Gość przy stole', 'Potwierdź obecność na wydarzeniu', 'table-chair', 'events_attended', 1),
 ('pin_master', 'Kartograf smaku', 'Dodaj 3 piny', 'map-marker-star', 'pins_created', 3)
on conflict (code) do nothing;

-- CARDS (placeholder art: art_key -> generated illustration in the app)
insert into public.card_definitions (code, name, lore, category, kind, rarity, art_key, effect, challenge_text, challenge_hours, specialization_code) values
 ('szef_kuchni_wzywa', 'Szef Kuchni Wzywa', 'Głos z kuchni niesie się po mieście…', 'culinary', 'offensive', 'rare', 'chef', 'Wyzwanie kulinarne.', 'Przygotuj potrawę i zostaw ją dla przeciwnika w umówionym, publicznym miejscu.', 72, 'chef'),
 ('tajemnicza_degustacja', 'Tajemnicza Degustacja', 'Mała próbka, wielka tajemnica.', 'tasting', 'offensive', 'common', 'mystery', 'Wyzwanie degustacyjne.', 'Przygotuj małą próbkę potrawy do odbioru w uzgodnionym, bezpiecznym miejscu.', 48, 'chef'),
 ('mistrz_wymiany', 'Mistrz Wymiany', 'Danie za danie, uśmiech za uśmiech.', 'exchange', 'offensive', 'common', 'exchange', 'Wymiana posiłków.', 'Zaproponuj dobrowolną wymianę posiłków z przeciwnikiem.', 72, null),
 ('kulinarna_ekspedycja', 'Kulinarna Ekspedycja', 'Mapa prowadzi tam, gdzie pachnie.', 'travel', 'offensive', 'common', 'expedition', 'Odwiedzenie lokalu.', 'Odwiedź lokal wskazany przez przeciwnika i podziel się wrażeniami.', 72, 'explorer'),
 ('otwarty_stol', 'Otwarty Stół', 'Krzesło zawsze się znajdzie.', 'social', 'offensive', 'common', 'table', 'Spotkanie grupowe.', 'Dołącz do dowolnego otwartego stołu w ciągu 7 dni.', 168, 'connector'),
 ('ratownik_smaku', 'Ratownik Smaku', 'Żaden kęs nie zostanie w tyle.', 'solidarity', 'offensive', 'common', 'rescue', 'Uratuj posiłek.', 'Uratuj pełnowartościowy posiłek przed zmarnowaniem (np. jadłodzielnia).', 72, 'rescuer'),
 ('recenzent_z_misja', 'Recenzent z Misją', 'Słowo krytyka waży więcej niż złoto.', 'review', 'offensive', 'common', 'review', 'Recenzja lokalu.', 'Opublikuj uzasadnioną recenzję lokalu w Yummeet.', 48, 'critic'),
 ('pojedynek_smakow', 'Pojedynek Smaków', 'Dwie wersje, jeden zwycięzca.', 'culinary', 'offensive', 'epic', 'versus', 'Podwójne gotowanie.', 'Przygotuj dwie wersje potrawy i zorganizuj wspólną degustację w publicznym miejscu.', 96, 'chef'),
 ('podroz_za_smakiem', 'Podróż za Smakiem', 'Kompas wskazuje na głód.', 'travel', 'offensive', 'common', 'travel', 'Nowe miejsce.', 'Odkryj nowe miejsce kulinarne i dodaj pin z opisem.', 72, 'explorer'),
 ('goscinny_gospodarz', 'Gościnny Gospodarz', 'Drzwi otwarte, stół nakryty.', 'hospitality', 'offensive', 'rare', 'host', 'Organizacja spotkania.', 'Zorganizuj otwarte spotkanie przy jedzeniu w lokalu.', 168, 'connector'),
 ('mala_probka', 'Mała Próbka', 'Czasem mniej znaczy więcej.', 'defense', 'defensive', 'common', 'sample', 'Zamień rozbudowane gotowanie na małą degustację albo wręczenie cukierka.', null, 48, null),
 ('zmiana_menu', 'Zmiana Menu', 'Karta dań się zmienia.', 'defense', 'defensive', 'common', 'menu', 'Zastąp wyzwanie inną, dowolnie wybraną aktywnością kulinarną.', null, 48, null),
 ('tryb_wegetarianski', 'Tryb Wegetariański', 'Zielono mi.', 'defense', 'defensive', 'common', 'veggie', 'Wariant wegetariański (jeśli obie strony akceptują).', null, 48, null),
 ('lagodniejszy_przepis', 'Łagodniejszy Przepis', 'Szczypta mniej ognia.', 'defense', 'defensive', 'common', 'mild', 'Obniżenie trudności wyzwania.', null, 48, null),
 ('przeniesienie_spotkania', 'Przeniesienie Spotkania', 'Zegar tyka inaczej.', 'defense', 'defensive', 'common', 'calendar', 'Uzgodnienie innego terminu.', null, 48, null),
 ('degustacja_bez_gotowania', 'Degustacja Bez Gotowania', 'Gotowe też smakuje.', 'defense', 'defensive', 'common', 'ready', 'Zamiana gotowania na degustację gotowego produktu.', null, 48, null),
 ('bezpieczna_lokalizacja', 'Bezpieczna Lokalizacja', 'Spotkajmy się na rynku.', 'defense', 'defensive', 'rare', 'shield', 'Przeniesienie spotkania do miejsca publicznego.', null, 48, null),
 ('wspolny_wariant', 'Wspólny Wariant', 'Razem raźniej.', 'defense', 'defensive', 'common', 'together', 'Zamiana wyzwania indywidualnego na wspólną aktywność.', null, 48, null),
 ('odmowa_bez_kary', 'Odmowa bez Kary', 'Twoje granice, Twoje zasady.', 'defense', 'defensive', 'epic', 'stop', 'Rezygnacja z wyzwania bez utraty karty i bez konsekwencji.', null, 48, null),
 ('podwojna_nagroda', 'Podwójna Nagroda', 'Fortuna sprzyja smakoszom.', 'bonus', 'special', 'legendary', 'star', 'Placeholder: podwaja XP za następną misję (mechanika w przygotowaniu).', null, 48, null)
on conflict (code) do update set name = excluded.name, effect = excluded.effect, challenge_text = excluded.challenge_text;

-- MISSIONS (demo)
insert into public.mission_definitions (code, name, description, category, specialization_code, participation, difficulty, confirmation_method, duration_hours, reward_xp, repeat_reward_xp, repeat_limit, cooldown_hours, steps, safety_rules) values
 ('starter_hello', 'Pierwszy kęs', 'Przedstaw się społeczności: napisz, jakie danie najlepiej Cię opisuje.', 'social', null, 'solo', 1, 'self', 24, 40, 0, 1, 0, '["Pomyśl o ulubionym daniu","Opisz je w 1-2 zdaniach","Wyślij"]', null),
 ('critic_three_pins', 'Trzy ulubione miejsca', 'Dodaj trzy piny z recenzjami swoich ulubionych restauracji.', 'review', 'critic', 'solo', 2, 'self', 168, 80, 20, 3, 24, '["Dodaj 3 piny","Oceń każde miejsce","Opisz najlepsze danie"]', 'Recenzuj uczciwie – bez obraźliwych treści.'),
 ('critic_best_dish', 'Najlepsze danie w mieście', 'Poleć najlepsze danie, jakie zjadłeś w swoim mieście.', 'restaurant', 'critic', 'solo', 1, 'self', 72, 50, 10, 0, 24, '["Wybierz danie","Opisz dlaczego"]', null),
 ('rescuer_foodshare', 'Jadłodzielnia', 'Oddaj pełnowartościowy posiłek do jadłodzielni.', 'food_rescue', 'rescuer', 'solo', 2, 'code', 72, 100, 30, 0, 24, '["Przygotuj zapakowany posiłek z opisem alergenów","Zanieś do jadłodzielni","Wpisz kod z jadłodzielni"]', 'Opisz alergeny i datę przygotowania. Nie oddawaj jedzenia po terminie.'),
 ('chef_signature', 'Popisowe danie', 'Ugotuj popisowe danie i podziel się nim z inną osobą, która dobrowolnie przyjęła zaproszenie.', 'cooking', 'chef', 'pair', 3, 'peer', 120, 120, 30, 0, 48, '["Ugotuj danie","Podaj skład i alergeny","Przekaż w publicznym miejscu","Poproś odbiorcę o potwierdzenie"]', 'Odbiorca zawsze może odmówić. Spotkanie tylko w miejscu publicznym.'),
 ('connector_open_table', 'Trzy nowe twarze', 'Dołącz do otwartego stołu i poznaj trzy nowe osoby.', 'social', 'connector', 'group', 2, 'peer', 168, 90, 20, 0, 48, '["Dołącz do stołu","Porozmawiaj z 3 osobami","Poproś organizatora o potwierdzenie"]', 'Możesz wyjść w każdej chwili.'),
 ('explorer_three_recommended', 'Szlakiem poleceń', 'Odwiedź trzy restauracje polecone przez innych Yummiteerów.', 'travel', 'explorer', 'solo', 2, 'self', 336, 100, 20, 0, 72, '["Wybierz 3 polecane lokale","Odwiedź je","Oznacz wizyty na mapie"]', null),
 ('romantic_tasting', 'Wspólna degustacja', 'Zaproś osobę, która wyraziła zainteresowanie, na degustację w lokalu.', 'dating', 'romantic', 'pair', 3, 'peer', 168, 120, 30, 0, 72, '["Zaproponuj lokal publiczny","Uzgodnij termin","Poproś o potwierdzenie spotkania"]', 'Pierwsze spotkanie tylko w miejscu publicznym. Brak zgody = brak misji.')
on conflict (code) do update set name = excluded.name, description = excluded.description, steps = excluded.steps;

insert into public.mission_secrets (mission_id, confirmation_code)
select id, 'YUMMI1' from public.mission_definitions where code = 'rescuer_foodshare'
on conflict (mission_id) do nothing;

delete from public.card_rewards where mission_id in (select id from public.mission_definitions where code in
  ('starter_hello','critic_three_pins','critic_best_dish','rescuer_foodshare','chef_signature','connector_open_table','explorer_three_recommended','romantic_tasting'));
insert into public.card_rewards (mission_id, kind, rarity, count, first_time_only)
select id, 'offensive', 'common', 1, true from public.mission_definitions where code = 'starter_hello'
union all select id, 'defensive', 'common', 1, true from public.mission_definitions where code = 'starter_hello'
union all select id, 'offensive', 'common', 1, true from public.mission_definitions where code in ('critic_three_pins','critic_best_dish','explorer_three_recommended')
union all select id, 'offensive', 'rare', 1, true from public.mission_definitions where code in ('chef_signature','connector_open_table')
union all select id, 'defensive', 'rare', 1, true from public.mission_definitions where code = 'rescuer_foodshare'
union all select id, 'offensive', 'epic', 1, true from public.mission_definitions where code = 'romantic_tasting';
insert into public.card_rewards (mission_id, card_id, kind, rarity, count, first_time_only)
select m.id, c.id, null, 'epic', 1, true from public.mission_definitions m, public.card_definitions c where m.code = 'chef_signature' and c.code = 'odmowa_bez_kary';

-- DEMO PINS (Warszawa)
insert into public.pins (title, description, cuisine, city, price_level, coords)
select title, description, cuisine, city, price_level, coords::extensions.geography from (values
 ('Bar Mleczny Pod Barbakanem', 'Klasyka PRL: pierogi i naleśniki.', 'polish', 'Warszawa', 1::smallint, 'SRID=4326;POINT(21.0105 52.2502)'),
 ('Pierogarnia na Bednarskiej', 'Ręcznie lepione pierogi.', 'polish', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0135 52.2455)'),
 ('Ramen Station', 'Bulion gotowany 12 godzin.', 'japanese', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0180 52.2297)'),
 ('Trattoria Nonna', 'Domowe makarony i tiramisu.', 'italian', 'Warszawa', 3::smallint, 'SRID=4326;POINT(21.0059 52.2319)'),
 ('Vege Miasto', 'Roślinne bowle i burgery.', 'vegan', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0003 52.2390)'),
 ('Hala Koszyki', 'Food hall z kilkunastoma kuchniami.', 'international', 'Warszawa', 3::smallint, 'SRID=4326;POINT(21.0130 52.2223)'),
 ('Taqueria Mexicana', 'Tacos al pastor i salsy.', 'mexican', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0230 52.2340)'),
 ('Kebab u Ahmeda', 'Najlepszy kebab na Pradze.', 'turkish', 'Warszawa', 1::smallint, 'SRID=4326;POINT(21.0340 52.2520)'),
 ('Zajazd pod Łodzią', 'Przystanek na trasie A2.', 'polish', 'Łowicz', 2::smallint, 'SRID=4326;POINT(19.9400 52.1060)'),
 ('Manufaktura Food', 'Kuchnie świata w Łodzi.', 'international', 'Łódź', 2::smallint, 'SRID=4326;POINT(19.4560 51.7790)'),
 ('Pizzeria Napoli Łódź', 'Neapolitańska pizza z pieca opalanego drewnem.', 'italian', 'Łódź', 2::smallint, 'SRID=4326;POINT(19.4570 51.7700)'),
 ('Kawiarnia Ogród', 'Kawa speciality i ciasta.', 'cafe', 'Warszawa', 2::smallint, 'SRID=4326;POINT(21.0200 52.2400)')
) as v(title, description, cuisine, city, price_level, coords)
where not exists (select 1 from public.pins p where p.title = v.title);

-- OFFICIAL DEMO EVENT (system organizer)
insert into public.events (kind, title, description, place_name, starts_at, capacity, seats_taken, theme, rules, discount_text, is_official, pin_id)
select 'official', 'Wieczór pierogów z szefem kuchni', 'Degustacja 6 rodzajów pierogów i rozmowa z szefem kuchni.', 'Pierogarnia na Bednarskiej',
       now() + interval '7 days', 12, 0, 'Kuchnia polska', 'Miejsce publiczne. Obecność potwierdzana kodem.', '-20% dla Yummiteerów', true,
       (select id from public.pins where title = 'Pierogarnia na Bednarskiej' limit 1)
where not exists (select 1 from public.events where title = 'Wieczór pierogów z szefem kuchni');
insert into public.event_secrets (event_id, checkin_code)
select id, 'PIEROG' from public.events where title = 'Wieczór pierogów z szefem kuchni' on conflict do nothing;
insert into public.conversations (kind, ref_id, title)
select 'event', id, title from public.events where title = 'Wieczór pierogów z szefem kuchni'
on conflict (kind, ref_id) where ref_id is not null do nothing;

-- TABLE GAMES & QUESTION BANK (placeholders; real content to be added later)
insert into public.question_categories (code, name, depth, sort) values
 ('warmup','Na rozgrzewkę',1,1),('humor','Humor',1,2),('food','Jedzenie',1,3),('travel','Podróże',2,4),('childhood','Dzieciństwo',2,5),
 ('relations','Relacje',3,6),('character','Charakter',3,7),('ambitions','Ambicje',3,8),('lifestyle','Styl życia',2,9),
 ('worldview','Światopogląd',4,10),('dreams','Marzenia',4,11),('surprise','Pytania niespodziewane',2,12)
on conflict (code) do nothing;
insert into public.scenario_questions (category_code, text, depth)
select code, '[Placeholder] Pytanie z kategorii: ' || name, depth from public.question_categories c
where not exists (select 1 from public.scenario_questions q where q.category_code = c.code);
insert into public.table_games (code, name, description, rules, min_players, max_players) values
 ('two_truths','Dwie prawdy i kłamstwo','Każdy mówi trzy zdania o sobie — reszta zgaduje, które jest kłamstwem.','Kolejka zgodnie z ruchem wskazówek zegara.',3,10),
 ('guess_prefs','Zgadnij preferencje','Zgadujcie nawzajem ulubione smaki.','Punkt za trafienie.',2,8),
 ('this_or_that','To czy to?','Wybór pomiędzy dwiema opcjami.','Bez długiego zastanawiania się!',2,10),
 ('story60','Historia w 60 sekund','Opowiedz historię związaną z jedzeniem w minutę.','Stoper w telefonie.',2,10),
 ('dream_restaurant','Idealna restauracja','Wspólnie wymyślcie idealną restaurację.','Każdy dokłada jeden element.',2,8),
 ('tasting_challenge','Wyzwanie degustacyjne','Zgadnij składnik z zamkniętymi oczami.','Tylko za zgodą i bez alergenów uczestników.',2,6)
on conflict (code) do nothing;
insert into public.date_scenarios (level, name, description, question_categories)
select * from (values
 (1::smallint,'Pierwsza kolacja','Spotkanie w restauracji, pytania na rozgrzewkę.', array['warmup','food','humor']),
 (2::smallint,'Piknik z wymianą','Wymiana przygotowanych posiłków w parku.', array['travel','childhood','lifestyle']),
 (3::smallint,'Wspólne gotowanie','Wspólne przygotowanie potrawy (np. warsztaty kulinarne lub dom – tylko za obopólną zgodą).', array['dreams','ambitions','relations'])
) v(level, name, description, cats)
where not exists (select 1 from public.date_scenarios);

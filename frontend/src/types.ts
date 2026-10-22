export type Rarity = "common" | "rare" | "epic" | "legendary";
export type CardKind = "offensive" | "defensive" | "special";

export interface Profile {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  account_type: "user" | "business" | "admin";
  primary_specialization: string | null;
  preferred_specialization?: string | null;
  xp: number;
  level: number;
  duel_mode_enabled: boolean;
  visibility: Record<string, string>;
  notification_prefs: Record<string, boolean>;
  signature_dish?: string | null;
  favorite_cuisine?: string | null;
  culinary_skill_level?: number | null;
  diet_style?: string | null;
  spice_tolerance_label?: string | null;
  superpowers?: string[];
  collab_forms?: string[];
  cooking_paid_enabled?: boolean | null;
  cooking_legal_consents?: Record<string, boolean | string>;
}

export interface Specialization { code: string; name: string; description: string; color: string; icon: string; sort: number }
export interface LevelDef { level: number; name: string; min_xp: number }

export interface PinMarker {
  id: string; title: string; lat: number; lng: number; cuisine: string | null; is_official: boolean;
  score: number | null; review_count: number; distance_m?: number; along?: number; cover_url?: string | null;
  price_min?: number | null; price_max?: number | null;
}

export interface CardDef {
  id: string; code: string; name: string; lore: string; category: string; kind: CardKind; rarity: Rarity; art_key: string;
  effect: string; challenge_text: string | null; challenge_hours: number; specialization_code: string | null; version: number;
}
export interface UserCard { id: string; status: string; acquired_at: string; source_type: string; card: CardDef }

export type MissionStatus = "available" | "accepted" | "in_progress" | "pending_confirmation" | "completed" | "rejected" | "cancelled" | "expired";
export interface BoardMission {
  mission_id: string; code: string; name: string; description: string; category: string; specialization_code: string | null;
  participation: string; difficulty: number;
  confirmation_method: "self" | "code" | "peer" | "organizer" | "photo" | "location" | "peer_pool" | "event_checkin" | "food_offer" | "food_tip" | "pin_peer" | "system";
  duration_hours: number; reward_xp: number; steps: string[]; safety_rules: string | null; is_primary: boolean | null;
  user_mission_id: string | null; user_status: MissionStatus; expires_at: string | null; completions: number; card_reward_count: number;
}

export type DuelStatus = "proposed" | "pending_acceptance" | "accepted" | "round1" | "awaiting_card" | "awaiting_response" | "active_challenge" | "awaiting_confirmation" | "finished" | "cancelled" | "rejected" | "expired";
export type Move = "rock" | "paper" | "scissors";

export interface EventRow {
  id: string; kind: string; title: string; description: string | null; place_name: string; starts_at: string; capacity: number;
  seats_taken: number; theme: string | null; rules: string | null; status: string; discount_text: string | null; is_official: boolean;
  organizer_id: string | null; pin_id: string | null; place_lat?: number | null; place_lng?: number | null;
  category_key?: string | null; subcategory_key?: string | null; template_key?: string | null;
  duration_min?: number | null; budget_per_person?: number | null;
}

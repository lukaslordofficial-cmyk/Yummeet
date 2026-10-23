// Data-access layer: every Supabase call used by screens lives here (UI never builds queries itself).
import { must, rpc } from "./api";
import { MAX_ROUTE_BUFFER_M } from "./geo";
import type { AttractionCategory } from "./attractionsCatalog";
import type { TravelRouteRow } from "./routeTypes";
import { supabase } from "./supabase";
import type { BoardMission, CardDef, EventRow, LevelDef, PinMarker, Profile, Specialization, UserCard } from "@/src/types";

const uid = async () => (await supabase.auth.getSession()).data.session?.user.id as string;

// ---------- catalogs (cached in memory: they change rarely) ----------
let specCache: Specialization[] | null = null;
let levelCache: LevelDef[] | null = null;
export async function getSpecializations(): Promise<Specialization[]> {
  if (!specCache) specCache = await must(supabase.from("specialization_definitions").select("code,name,description,color,icon,sort").eq("is_active", true).order("sort"));
  return specCache;
}
export async function getLevels(): Promise<LevelDef[]> {
  if (!levelCache) levelCache = await must(supabase.from("level_definitions").select("*").order("min_xp"));
  return levelCache;
}
export const chooseSpecialization = (primary: string, interests: string[] = []) =>
  rpc("choose_specialization", { p_primary: primary, p_interests: interests });
export const setPreferredSpecialization = (code: string | null) =>
  rpc("set_preferred_specialization", { p_code: code });
export async function myInterests(): Promise<string[]> {
  const rows = await must(supabase.from("user_specializations").select("code,is_primary").eq("user_id", await uid()));
  return (rows as { code: string; is_primary: boolean }[]).filter((r) => !r.is_primary).map((r) => r.code);
}
export type SpecHub = {
  preferred: string | null;
  main: string | null;
  main_label: string;
  specializations: Array<{
    code: string; name: string; description: string; color: string; icon: string; sort: number;
    pd: number; level: number; missions_completed: number;
    skills: Array<{ code: string; name: string; description: string; unlock_level: number; status: "locked" | "available" | "unlocked" }>;
  }>;
};
export const getSpecializationHub = () => rpc<SpecHub>("get_specialization_hub");
export function invalidateSpecCache() { specCache = null; }

// ---------- pins / map ----------
const bboxCache = new Map<string, PinMarker[]>();
export async function pinsInBBox(
  b: { south: number; west: number; north: number; east: number },
  cuisine: string | null,
  price?: { min?: number | null; max?: number | null } | null,
  zoom = 13,
): Promise<PinMarker[]> {
  // Mały zapas wokół ekranu. Duży zapas + limit ucinał lokale, które widać w kadrze.
  const pad = zoom >= 13 ? 0.004 : 0.012;
  const r = (n: number) => Math.round(n * 200) / 200;
  const pMin = price?.min ?? null;
  const pMax = price?.max ?? null;
  const limit = zoom >= 12 ? 1500 : 400;
  const key = [r(b.south), r(b.west), r(b.north), r(b.east), cuisine, pMin, pMax, limit].join("|");
  const hit = bboxCache.get(key);
  if (hit) return hit;
  const args: Record<string, unknown> = {
    p_south: r(b.south) - pad,
    p_west: r(b.west) - pad,
    p_north: r(b.north) + pad,
    p_east: r(b.east) + pad,
    p_cuisine: cuisine,
    p_limit: limit,
  };
  if (pMin != null || pMax != null) {
    args.p_price_min = pMin;
    args.p_price_max = pMax;
  }
  let data: PinMarker[];
  try {
    data = await rpc<PinMarker[]>("pins_in_bbox", args);
  } catch {
    // stara sygnatura bez cen — filtr po stronie klienta niedostępny bez price_min w markerze
    const { p_price_min: _a, p_price_max: _b, ...legacy } = args;
    data = await rpc<PinMarker[]>("pins_in_bbox", legacy);
  }
  if (bboxCache.size > 50) bboxCache.clear();
  bboxCache.set(key, data);
  return data;
}
export const invalidatePins = () => bboxCache.clear();
export async function pinsAlongRoute(
  path: [number, number][],
  bufferM: number,
  cuisine?: string | null,
  near?: { lat: number; lng: number } | null,
): Promise<PinMarker[]> {
  const args: Record<string, unknown> = {
    p_path: path,
    p_buffer_m: Math.min(MAX_ROUTE_BUFFER_M, Math.max(50, Math.round(bufferM) || 1000)),
    p_limit: 80,
    p_cuisine: cuisine ?? null,
  };
  if (near) {
    args.p_near_lat = near.lat;
    args.p_near_lng = near.lng;
  }
  try {
    return await rpc<PinMarker[]>("pins_along_route", args);
  } catch {
    const { p_near_lat: _a, p_near_lng: _b, ...legacy } = args;
    const all = await rpc<PinMarker[]>("pins_along_route", legacy);
    return cuisine ? all.filter((p) => p.cuisine === cuisine) : all;
  }
}
export const pinDetails = (id: string) => rpc<any>("pin_details", { p_id: id });
export type NearbyPin = { id: string; title: string; lat: number; lng: number; cuisine: string | null; city: string | null; address: string | null };

export async function findNearbyPin(lat: number, lng: number, radiusM = 40): Promise<NearbyPin | null> {
  try {
    const rows = await rpc<NearbyPin[]>("find_nearby_pin", { p_lat: lat, p_lng: lng, p_radius_m: radiusM });
    return Array.isArray(rows) ? rows[0] ?? null : (rows as unknown as NearbyPin) ?? null;
  } catch {
    return null;
  }
}

export const createPin = (a: {
  title: string; lat: number; lng: number; description?: string; cuisine?: string | null; city?: string;
  price?: number | null; coverUrl?: string | null; address?: string | null;
  priceMin?: number | null; priceMax?: number | null; website?: string | null;
}) =>
  rpc<string>("create_pin", {
    p_title: a.title, p_lat: a.lat, p_lng: a.lng, p_description: a.description || null, p_cuisine: a.cuisine || null,
    p_city: a.city || null, p_price_level: a.price ?? null, p_cover_url: a.coverUrl || null, p_address: a.address || null,
    p_price_min: a.priceMin ?? null, p_price_max: a.priceMax ?? null, p_website: a.website || null,
  });
export const updatePin = (a: {
  pinId: string; title?: string | null; description?: string | null; cuisine?: string | null;
  city?: string | null; address?: string | null; priceMin?: number | null; priceMax?: number | null;
  menuText?: string | null; menuPhotoUrl?: string | null; menuPdfUrl?: string | null;
  tags?: string[] | null; coverUrl?: string | null; website?: string | null;
  phone?: string | null;
  orderWoltUrl?: string | null; orderPyszneUrl?: string | null;
  orderGlovoUrl?: string | null; orderUberUrl?: string | null;
}) =>
  rpc<any>("update_pin", {
    p_pin: a.pinId,
    p_title: a.title ?? null,
    p_description: a.description ?? null,
    p_cuisine: a.cuisine ?? null,
    p_city: a.city ?? null,
    p_address: a.address ?? null,
    p_price_min: a.priceMin ?? null,
    p_price_max: a.priceMax ?? null,
    p_menu_text: a.menuText ?? null,
    p_menu_photo_url: a.menuPhotoUrl ?? null,
    p_tags: a.tags ?? null,
    p_cover_url: a.coverUrl ?? null,
    p_menu_pdf_url: a.menuPdfUrl ?? null,
    p_website: a.website ?? null,
    p_phone: a.phone ?? null,
    p_order_wolt_url: a.orderWoltUrl ?? null,
    p_order_pyszne_url: a.orderPyszneUrl ?? null,
    p_order_glovo_url: a.orderGlovoUrl ?? null,
    p_order_uber_url: a.orderUberUrl ?? null,
  });
export const deletePin = (pinId: string) => rpc("delete_pin", { p_pin: pinId });
export const markVisited = (pin: string, lat: number, lng: number) => rpc("mark_visited", { p_pin: pin, p_lat: lat, p_lng: lng });
export async function saveReview(pinId: string, r: { food: number; atmosphere: number; service: number; price_value: number; purposes: string[]; best_dish?: string; tip?: string; body?: string }) {
  const me = await uid();
  const existing = await must(supabase.from("restaurant_reviews").select("id").eq("pin_id", pinId).eq("user_id", me).maybeSingle());
  if (existing) return must(supabase.from("restaurant_reviews").update(r).eq("id", (existing as any).id));
  return must(supabase.from("restaurant_reviews").insert({ ...r, pin_id: pinId, user_id: me }));
}

// ---------- missions ----------
export const missionBoard = () => rpc<BoardMission[]>("get_mission_board");
export const missionAccept = (id: string) => rpc<string>("mission_accept", { p_mission: id });
export const missionStart = (um: string) => rpc("mission_start", { p_um: um });
export const missionCancel = (um: string) => rpc("mission_cancel", { p_um: um });
export const missionSubmit = (um: string, kind: string, content: string, confirmer?: string | null) =>
  rpc<any>("mission_submit", { p_um: um, p_kind: kind, p_content: content, p_confirmer: confirmer ?? null });
export const missionConfirm = (um: string, approve: boolean) => rpc<any>("mission_confirm", { p_um: um, p_approve: approve });
export const missionCommunityReview = (um: string, approve: boolean) =>
  rpc<any>("mission_community_review", { p_um: um, p_approve: approve });
export type MissionReviewInboxRow = {
  user_mission_id: string; mission_name: string; mission_code: string; owner_name: string;
  submitted_at: string | null; review_deadline: string | null; evidence: string | null;
  approvals?: number; approvals_needed?: number; linked_pin_id?: string | null;
};
export const missionReviewInbox = (limit = 30) =>
  rpc<MissionReviewInboxRow[]>("mission_review_inbox", { p_limit: limit });
export async function confirmRequests() {
  return must(supabase.from("user_missions").select("id,status,submitted_at,user_id,mission:mission_definitions(name),owner:profiles!user_missions_user_id_fkey(display_name)")
    .eq("confirmer_id", await uid()).eq("status", "pending_confirmation"));
}
export async function missionHistory() {
  return must(supabase.from("mission_completions").select("id,xp,is_first,cards,created_at,mission:mission_definitions(name)").eq("user_id", await uid()).order("created_at", { ascending: false }).limit(50));
}

// ---------- cards ----------
export async function myCards(): Promise<UserCard[]> {
  return must(supabase.from("user_cards").select("id,status,acquired_at,source_type,card:card_definitions(*)").eq("user_id", await uid()).eq("status", "owned").order("acquired_at", { ascending: false })) as unknown as Promise<UserCard[]>;
}
export const cardCatalog = () => must(supabase.from("card_definitions").select("*").eq("status", "published").order("kind").order("rarity")) as Promise<CardDef[]>;
export async function cardHistory() {
  return must(supabase.from("card_usage_history").select("id,action,created_at,duel_id,card:card_definitions(name,kind,rarity)").eq("user_id", await uid()).order("created_at", { ascending: false }).limit(50));
}

// ---------- duels ----------
export async function myDuels() {
  const me = await uid();
  return must(supabase.from("duels").select("id,mode,status,outcome,created_at,challenger_id,opponent_id,winner_id,challenger:profiles!duels_challenger_id_fkey(display_name),opponent:profiles!duels_opponent_id_fkey(display_name)")
    .or(`challenger_id.eq.${me},opponent_id.eq.${me}`).order("updated_at", { ascending: false }).limit(50));
}
export const duelState = (id: string) => rpc<any>("duel_state", { p_duel: id });
export const duelInvite = (opponent: string) => rpc<string>("duel_invite", { p_opponent: opponent });
export const duelRespond = (id: string, accept: boolean) => rpc("duel_respond", { p_duel: id, p_accept: accept });
export const duelCancel = (id: string) => rpc("duel_cancel", { p_duel: id });
export const duelPlay = (id: string, move: string) => rpc<any>("duel_play", { p_duel: id, p_move: move });
export const duelPlayDefense = (id: string, userCard: string | null) => rpc("duel_play_defense", { p_duel: id, p_user_card: userCard });
export const duelSubmitEvidence = (id: string, text: string) => rpc("duel_submit_evidence", { p_duel: id, p_evidence: text });
export const duelConfirm = (id: string, accept: boolean) => rpc("duel_confirm", { p_duel: id, p_accept: accept });
export const duelForfeit = (id: string) => rpc("duel_forfeit", { p_duel: id });
/** Ranking tylko w promieniu 20 km od podanej lokalizacji. */
export const duelLeaderboard = (lat: number, lng: number, limit = 20) =>
  rpc<any[]>("duel_leaderboard", { p_lat: lat, p_lng: lng, p_limit: limit });
export const setDuelMode = (on: boolean) => rpc("set_duel_mode", { p_enabled: on });
export const presencePing = (lat: number, lng: number) =>
  rpc<{ duels?: string[]; conversations?: string[] }>("presence_ping", { p_lat: lat, p_lng: lng });
export const touchLocation = (lat: number, lng: number) => rpc("touch_location", { p_lat: lat, p_lng: lng });

// ---------- people ----------
export async function searchPeople(q: string): Promise<Pick<Profile, "id" | "display_name" | "primary_specialization" | "level">[]> {
  const me = await uid();
  let query = supabase.from("profiles").select("id,display_name,primary_specialization,level").neq("id", me).limit(30);
  if (q.trim()) query = query.ilike("display_name", `%${q.trim()}%`);
  return must(query) as any;
}
export const getProfile = (id: string) => must(supabase.from("profiles").select("*").eq("id", id).maybeSingle()) as Promise<Profile | null>;
export const profileStats = (id: string) => rpc<Record<string, number> | null>("profile_stats", { p_user: id });
export async function myBadges() {
  const [defs, mine] = await Promise.all([
    must(supabase.from("badge_definitions").select("*").eq("is_active", true)),
    must(supabase.from("user_badges").select("code,awarded_at").eq("user_id", await uid())),
  ]);
  const awarded = new Map((mine as { code: string; awarded_at: string }[]).map((b) => [b.code, b.awarded_at]));
  return (defs as any[]).map((d) => ({
    ...d,
    owned: awarded.has(d.code),
    awarded_at: awarded.get(d.code) ?? null,
  }));
}
export async function blockUser(id: string) { return must(supabase.from("user_blocks").insert({ blocker_id: await uid(), blocked_id: id })); }
export async function unblockUser(id: string) { return must(supabase.from("user_blocks").delete().eq("blocker_id", await uid()).eq("blocked_id", id)); }
export async function myBlocks() {
  return must(supabase.from("user_blocks").select("blocked_id,blocked:profiles!user_blocks_blocked_id_fkey(display_name)").eq("blocker_id", await uid()));
}
export async function report(targetType: string, targetId: string, reason: string, details?: string) {
  return must(supabase.from("reports").insert({ reporter_id: await uid(), target_type: targetType, target_id: targetId, reason, details: details || null }));
}
export async function updateMyProfile(patch: Partial<Profile>) {
  return must(supabase.from("profiles").update(patch).eq("id", await uid()));
}
export async function myPreferences() { return must(supabase.from("user_preferences").select("*").eq("user_id", await uid()).maybeSingle()); }
export async function updatePreferences(patch: Record<string, unknown>) {
  return must(supabase.from("user_preferences").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", await uid()));
}
export const deleteMyAccount = () => rpc("delete_my_account");

// ---------- events / tables ----------
const EVENT_LIST_COLS = "id,kind,title,description,place_name,place_lat,place_lng,starts_at,capacity,seats_taken,theme,rules,status,discount_text,is_official,organizer_id,pin_id,category_key,subcategory_key,template_key";
export async function listEvents(category: string | null, origin?: { lat: number; lng: number } | null): Promise<EventRow[]> {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const run = (cols: string, withCategory: boolean) => {
    let q = supabase.from("events").select(cols).in("status", ["open", "full"]).gte("starts_at", since).order("starts_at").limit(200);
    if (origin) {
      const dLat = 50 / 111;
      const dLng = 50 / (111 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
      q = q.gte("place_lat", origin.lat - dLat).lte("place_lat", origin.lat + dLat).gte("place_lng", origin.lng - dLng).lte("place_lng", origin.lng + dLng);
    }
    if (withCategory && category) q = q.eq("category_key", category);
    return must(q) as Promise<EventRow[]>;
  };
  try {
    return await run(EVENT_LIST_COLS, true);
  } catch (e) {
    if (category) throw e;
    return await run("id,kind,title,description,place_name,place_lat,place_lng,starts_at,capacity,seats_taken,theme,rules,status,discount_text,is_official,organizer_id,pin_id", false);
  }
}
export const getEvent = (id: string) => must(supabase.from("events").select("*").eq("id", id).maybeSingle()) as Promise<EventRow | null>;
export async function myEventStatus(id: string) {
  const r = await must(supabase.from("event_participants").select("status").eq("event_id", id).eq("user_id", await uid()).maybeSingle());
  return (r as any)?.status as string | undefined;
}
export const eventParticipants = (id: string) => rpc<any[]>("event_participants_list", { p_event: id });
export const eventCreate = (a: {
  title: string; place: string; startsAt: string; capacity: number; kind: string;
  description?: string; theme?: string; rules?: string; placeLat?: number | null; placeLng?: number | null; pinId?: string | null;
}) =>
  rpc<string>("event_create", {
    p_title: a.title, p_place_name: a.place, p_starts_at: a.startsAt, p_capacity: a.capacity, p_kind: a.kind,
    p_description: a.description || null, p_theme: a.theme || null, p_rules: a.rules || null,
    p_place_lat: a.placeLat ?? null, p_place_lng: a.placeLng ?? null, p_pin: a.pinId ?? null,
  });
export async function eventJoin(id: string) {
  try {
    return await rpc<any>("event_join", { p_event: id });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (raw.includes("event_closed")) throw new Error("booking_closed");
    throw error;
  }
}
export const eventLeave = (id: string) => rpc("event_leave", { p_event: id });
export const eventCheckin = (id: string, code: string, lat: number, lng: number) =>
  rpc("event_checkin", { p_event: id, p_code: code, p_lat: lat, p_lng: lng });
export const eventRevealCheckinCode = (id: string, lat: number, lng: number) =>
  rpc<{ code: string; notified: boolean }>("event_reveal_checkin_code", { p_event: id, p_lat: lat, p_lng: lng });
export const eventClaimCode = (code: string, eventId?: string) =>
  rpc<{ event_id: string; kind: "visited" | "organized" }>("event_claim_code", { p_code: code, p_event: eventId ?? null });
export const travelAddKm = (km: number) => rpc<number>("travel_add_km", { p_km: km });

export const travelRouteFinish = (a: {
  title: string; placeA: string; placeB: string;
  aLat: number; aLng: number; bLat: number; bLng: number;
  mode: string; distanceM: number; kmTracked: number; startedAt: string; pinIds: string[];
}) =>
  rpc<string>("travel_route_finish", {
    p_title: a.title, p_place_a: a.placeA, p_place_b: a.placeB,
    p_a_lat: a.aLat, p_a_lng: a.aLng, p_b_lat: a.bLat, p_b_lng: a.bLng,
    p_mode: a.mode, p_distance_m: a.distanceM, p_km_tracked: a.kmTracked,
    p_started_at: a.startedAt, p_pin_ids: a.pinIds,
  });

export async function myTravelRoutes(): Promise<TravelRouteRow[]> {
  try {
    return (await must(
      supabase.from("travel_routes").select("id,title,place_a,place_b,mode,distance_m,km_tracked,started_at,ended_at,reviewed")
        .order("ended_at", { ascending: false }).limit(30),
    )) as TravelRouteRow[];
  } catch {
    return [];
  }
}

export type { AttractionCategory } from "./attractionsCatalog";
export async function attractionSuggestions(category?: import("./attractionsCatalog").AttractionCategory) {
  const { fallbackAttractions, FALLBACK_ATTRACTIONS } = await import("./attractionsCatalog");
  if (category === "challenges") return [];
  return category ? fallbackAttractions(category) : FALLBACK_ATTRACTIONS;
}
export async function eventAttractions(eventId: string) {
  return must(supabase.from("event_attractions").select("*").eq("event_id", eventId).order("created_at"));
}
export async function addEventAttraction(eventId: string, category: AttractionCategory, title: string, body = "") {
  return must(supabase.from("event_attractions").insert({
    event_id: eventId, category, title: title.trim(), body: body.trim(), created_by: await uid(),
  }));
}
export async function removeEventAttraction(id: string) {
  return must(supabase.from("event_attractions").delete().eq("id", id));
}
export type OrganizerReview = {
  id: string; event_id: string; event_title?: string | null; reviewer_id: string; author?: string | null;
  hospitality: number; organization: number; atmosphere: number; communication: number;
  tip?: string | null; body?: string | null; created_at: string;
};
export type OrganizerRating = {
  organizer_id: string;
  summary: {
    review_count: number; hospitality: number; organization: number; atmosphere: number; communication: number; yummeet_score: number;
  } | null;
  reviews: OrganizerReview[];
};
export const organizerRating = (userId: string) => rpc<OrganizerRating>("organizer_rating", { p_user: userId });
export const saveOrganizerReview = (a: {
  eventId: string; hospitality: number; organization: number; atmosphere: number; communication: number; tip?: string; body?: string;
}) =>
  rpc<string>("save_organizer_review", {
    p_event: a.eventId,
    p_hospitality: a.hospitality,
    p_organization: a.organization,
    p_atmosphere: a.atmosphere,
    p_communication: a.communication,
    p_tip: a.tip || null,
    p_body: a.body || null,
  });

export async function eventConversationId(id: string) {
  const r = await must(supabase.from("conversations").select("id").eq("kind", "event").eq("ref_id", id).maybeSingle());
  return (r as any)?.id as string | undefined;
}

// ---------- Jedzenie ----------
export type FoodOfferKind = "giveaway" | "exchange" | "signature" | "order";
/** Popisowe: wynagrodzenie albo składniki + podział porcji. */
export type FoodDealMode = "paid" | "ingredients_split";
export type FoodOffer = {
  id: string; owner_id: string; title: string; description: string | null; photo_url: string | null;
  allergens: string[]; portions: number; portions_left: number; pickup_place_public: string | null;
  city?: string | null; street?: string | null; place_detail?: string | null;
  status: string; offer_kind: FoodOfferKind; created_at: string; place_lat?: number | null; place_lng?: number | null;
  owner?: { display_name: string } | null; owner_name?: string | null;
  storage_conditions?: string | null; prepared_at?: string | null;
  deal_mode?: FoodDealMode | null;
};
export const FOOD_DEAL_MODES: { key: FoodDealMode; label: string; hint: string }[] = [
  { key: "paid", label: "Za wynagrodzenie", hint: "Ugotuję danie w zamian za uzgodnione wynagrodzenie (ustalenia poza apką)." },
  { key: "ingredients_split", label: "Składniki + podział porcji", hint: "Opłacenie kosztów składników i podzielenie porcji na pół." },
];
export function foodDealLabel(mode?: string | null): string | null {
  if (!mode) return null;
  return FOOD_DEAL_MODES.find((m) => m.key === mode)?.label ?? mode;
}
export async function listFoodOffersNearby(kind: FoodOfferKind, lat: number, lng: number): Promise<FoodOffer[]> {
  const rows = await rpc<any[]>("list_food_nearby", { p_kind: kind, p_lat: lat, p_lng: lng, p_limit: 50 });
  return (rows ?? []).map((r) => ({
    ...r,
    offer_kind: r.offer_kind as FoodOfferKind,
    owner: { display_name: r.owner_name ?? "Yummiter" },
  }));
}
export async function createFoodOffer(a: {
  kind: FoodOfferKind; title: string; description?: string; photoUrl?: string | null;
  allergens: string[]; portions?: number; city: string; street: string; placeDetail?: string;
  lat: number; lng: number; preparedAt?: string | null; storage?: string | null;
  dealMode?: FoodDealMode | null;
}) {
  return rpc<string>("publish_food_offer", {
    p_kind: a.kind,
    p_title: a.title.trim(),
    p_description: a.description?.trim() || null,
    p_photo_url: a.photoUrl ?? null,
    p_allergens: a.allergens,
    p_portions: a.portions ?? 1,
    p_city: a.city.trim(),
    p_street: a.street.trim(),
    p_place_detail: a.placeDetail?.trim() || null,
    p_lat: a.lat,
    p_lng: a.lng,
    p_storage: a.storage ?? null,
    p_prepared_at: a.preparedAt ?? null,
    p_deal_mode: a.dealMode ?? null,
  });
}
export async function foodOfferDetails(id: string): Promise<FoodOffer | null> {
  const r = await rpc<any>("food_offer_details", { p_id: id });
  if (!r) return null;
  return { ...r, owner: { display_name: r.owner_name ?? "Yummiter" } };
}
export type CookingTipKind = "recipe" | "lifehack";
export type CookingTip = {
  id: string; author_id: string; title: string; body: string; photo_url: string | null; created_at: string;
  tip_kind?: CookingTipKind | null;
  author?: { display_name: string } | null; author_name?: string | null;
};
export const TIP_KINDS: { key: CookingTipKind; label: string; hint: string }[] = [
  { key: "recipe", label: "Przepisy", hint: "Pełny przepis na danie — składniki i kroki." },
  { key: "lifehack", label: "Life Hacki", hint: "Szybka sztuczka kuchenna, trik albo life hack." },
];
export async function listCookingTipsNearby(lat: number, lng: number, kind?: CookingTipKind | null): Promise<CookingTip[]> {
  const rows = await rpc<any[]>("list_tips_nearby", {
    p_lat: lat, p_lng: lng, p_limit: 50, p_kind: kind ?? null,
  });
  return (rows ?? []).map((r) => ({
    ...r,
    tip_kind: (r.tip_kind as CookingTipKind) ?? "recipe",
    author: { display_name: r.author_name ?? "Yummiter" },
  }));
}
export async function createCookingTip(
  title: string, body: string, photoUrl: string | null, lat: number, lng: number, kind: CookingTipKind = "recipe",
) {
  return rpc<string>("publish_cooking_tip", {
    p_title: title.trim(),
    p_body: body.trim(),
    p_photo_url: photoUrl,
    p_lat: lat,
    p_lng: lng,
    p_kind: kind,
  });
}

// ---------- Dziennik spotkań / zdjęcia stołów ----------
export type MeetingJournalEntry = {
  id: string; title: string; description: string | null; theme: string | null; rules: string | null;
  kind: string; place_name: string; starts_at: string; status: string; my_status: string | null;
  capacity: number; seats_taken: number;
  attractions: Array<{ id: string; category: string; title: string; body: string }>;
  photos: Array<{ id: string; photo_url: string; created_at: string }>;
  story?: Array<{ id: string; body: string; author_id: string; author: string; created_at: string }>;
  question_draws?: Array<{ name: string; question: string; round: number }>;
  truths?: Array<{
    name: string;
    lines?: Array<{ text: string; truth: boolean }>;
    truths?: Array<string | null>;
    lie?: string;
    score?: number;
  }>;
  truths_ranking?: Array<{ name: string; score: number }>;
  find_yes?: Array<{ prompt: string; names: string[] }>;
  find_answers?: Array<{ prompt: string; name: string; yes: boolean }>;
  find_scores?: Array<{ name: string; score: number }>;
  stories?: Array<{ title: string; lines: Array<{ author: string; author_id?: string; body: string }> }>;
};
export const myMeetingJournal = () => rpc<MeetingJournalEntry[]>("my_meeting_journal", { p_limit: 50 });
export const addEventPhoto = (eventId: string, photoUrl: string) =>
  rpc<string>("add_event_photo", { p_event: eventId, p_photo_url: photoUrl });
export async function listEventPhotos(eventId: string) {
  return must(
    supabase.from("event_photos").select("id,photo_url,uploader_id,created_at").eq("event_id", eventId).order("created_at", { ascending: false }),
  ) as Promise<Array<{ id: string; photo_url: string; uploader_id: string; created_at: string }>>;
}

// ---------- chat ----------
export const myConversations = () => rpc<any[]>("my_conversations");
export const leaveConversation = (id: string) => rpc<void>("conversation_leave", { p_conv: id });
export const openDirect = (other: string) => rpc<string>("chat_open_direct", { p_other: other });
export const listMessages = (conv: string) =>
  must(supabase.from("messages").select("id,body,sender_id,created_at").eq("conversation_id", conv).order("created_at", { ascending: false }).limit(50)) as Promise<any[]>;
export async function sendMessage(conv: string, body: string) {
  return must(supabase.from("messages").insert({ conversation_id: conv, body, sender_id: await uid() }));
}

// ---------- notifications ----------
export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
export async function listMyNotifications(limit = 50): Promise<AppNotification[]> {
  return must(
    supabase
      .from("notifications")
      .select("id,kind,title,body,data,read_at,created_at")
      .eq("user_id", await uid())
      .order("created_at", { ascending: false })
      .limit(limit),
  ) as Promise<AppNotification[]>;
}
export async function unreadNotificationsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", await uid())
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
export async function markNotificationRead(id: string) {
  return must(
    supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", await uid()),
  );
}
export async function markAllNotificationsRead() {
  return must(
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", await uid())
      .is("read_at", null),
  );
}

// ---------- games ----------
export const tableGames = () => must(supabase.from("table_games").select("*").eq("is_active", true));
export const questionCategories = () => must(supabase.from("question_categories").select("*").order("sort"));
export const questions = (cat: string) => must(supabase.from("scenario_questions").select("id,text").eq("category_code", cat).eq("is_active", true));

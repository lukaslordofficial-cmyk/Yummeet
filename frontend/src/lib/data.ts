// Data-access layer: every Supabase call used by screens lives here (UI never builds queries itself).
import { must, rpc } from "./api";
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
export const chooseSpecialization = (primary: string, interests: string[]) => rpc("choose_specialization", { p_primary: primary, p_interests: interests });
export async function myInterests(): Promise<string[]> {
  const rows = await must(supabase.from("user_specializations").select("code,is_primary").eq("user_id", await uid()));
  return (rows as { code: string; is_primary: boolean }[]).filter((r) => !r.is_primary).map((r) => r.code);
}

// ---------- pins / map ----------
const bboxCache = new Map<string, PinMarker[]>();
export async function pinsInBBox(b: { south: number; west: number; north: number; east: number }, cuisine: string | null): Promise<PinMarker[]> {
  const r = (n: number) => Math.round(n * 50) / 50; // ~2 km grid => cache hits on small pans
  const key = [r(b.south), r(b.west), r(b.north), r(b.east), cuisine].join("|");
  const hit = bboxCache.get(key);
  if (hit) return hit;
  const data = await rpc<PinMarker[]>("pins_in_bbox", { p_south: r(b.south) - 0.02, p_west: r(b.west) - 0.02, p_north: r(b.north) + 0.02, p_east: r(b.east) + 0.02, p_cuisine: cuisine, p_limit: 200 });
  if (bboxCache.size > 50) bboxCache.clear();
  bboxCache.set(key, data);
  return data;
}
export const invalidatePins = () => bboxCache.clear();
export async function pinsAlongRoute(path: [number, number][], bufferM: number, cuisine?: string | null): Promise<PinMarker[]> {
  try {
    return await rpc<PinMarker[]>("pins_along_route", {
      p_path: path, p_buffer_m: bufferM, p_limit: 100, p_cuisine: cuisine ?? null,
    });
  } catch {
    const all = await rpc<PinMarker[]>("pins_along_route", { p_path: path, p_buffer_m: bufferM, p_limit: 100 });
    return cuisine ? all.filter((p) => p.cuisine === cuisine) : all;
  }
}
export const pinDetails = (id: string) => rpc<any>("pin_details", { p_id: id });
export const createPin = (a: {
  title: string; lat: number; lng: number; description?: string; cuisine?: string | null; city?: string; price?: number | null; coverUrl?: string | null;
}) =>
  rpc<string>("create_pin", {
    p_title: a.title, p_lat: a.lat, p_lng: a.lng, p_description: a.description || null, p_cuisine: a.cuisine || null,
    p_city: a.city || null, p_price_level: a.price ?? null, p_cover_url: a.coverUrl || null,
  });
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
export const duelLeaderboard = () => rpc<any[]>("duel_leaderboard", { p_limit: 20 });
export const setDuelMode = (on: boolean) => rpc("set_duel_mode", { p_enabled: on });
export const presencePing = (lat: number, lng: number) => rpc<{ duels?: string[] }>("presence_ping", { p_lat: lat, p_lng: lng });

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
    must(supabase.from("user_badges").select("code").eq("user_id", await uid())),
  ]);
  const owned = new Set((mine as any[]).map((b) => b.code));
  return (defs as any[]).map((d) => ({ ...d, owned: owned.has(d.code) }));
}
export async function blockUser(id: string) { return must(supabase.from("user_blocks").insert({ blocker_id: await uid(), blocked_id: id })); }
export async function unblockUser(id: string) { return must(supabase.from("user_blocks").delete().eq("blocker_id", await uid()).eq("blocked_id", id)); }
export async function myBlocks() {
  return must(supabase.from("user_blocks").select("blocked_id,blocked:profiles!user_blocks_blocked_id_fkey(display_name)").eq("blocker_id", await uid()));
}
export async function report(targetType: string, targetId: string, reason: string, details?: string) {
  return must(supabase.from("reports").insert({ reporter_id: await uid(), target_type: targetType, target_id: targetId, reason, details: details || null }));
}
export async function updateMyProfile(patch: Partial<Pick<Profile, "display_name" | "bio" | "visibility" | "notification_prefs">>) {
  return must(supabase.from("profiles").update(patch).eq("id", await uid()));
}
export async function myPreferences() { return must(supabase.from("user_preferences").select("*").eq("user_id", await uid()).maybeSingle()); }
export async function updatePreferences(patch: Record<string, unknown>) {
  return must(supabase.from("user_preferences").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", await uid()));
}
export const deleteMyAccount = () => rpc("delete_my_account");

// ---------- events / tables ----------
export async function listEvents(kind: string | null): Promise<EventRow[]> {
  let q = supabase.from("events").select("id,kind,title,description,place_name,starts_at,capacity,seats_taken,theme,rules,status,discount_text,is_official,organizer_id,pin_id")
    .in("status", ["open", "full"]).gte("starts_at", new Date(Date.now() - 3 * 3600e3).toISOString()).order("starts_at").limit(50);
  if (kind === "official") q = q.eq("is_official", true);
  else if (kind) q = q.eq("kind", kind);
  return must(q) as Promise<EventRow[]>;
}
export const getEvent = (id: string) => must(supabase.from("events").select("*").eq("id", id).maybeSingle()) as Promise<EventRow | null>;
export async function myEventStatus(id: string) {
  const r = await must(supabase.from("event_participants").select("status").eq("event_id", id).eq("user_id", await uid()).maybeSingle());
  return (r as any)?.status as string | undefined;
}
export const eventParticipants = (id: string) => rpc<any[]>("event_participants_list", { p_event: id });
export const eventCreate = (a: { title: string; place: string; startsAt: string; capacity: number; kind: string; description?: string; theme?: string; rules?: string }) =>
  rpc<string>("event_create", { p_title: a.title, p_place_name: a.place, p_starts_at: a.startsAt, p_capacity: a.capacity, p_kind: a.kind, p_description: a.description || null, p_theme: a.theme || null, p_rules: a.rules || null });
export const eventJoin = (id: string) => rpc<any>("event_join", { p_event: id });
export const eventLeave = (id: string) => rpc("event_leave", { p_event: id });
export const eventCheckin = (id: string, code: string) => rpc("event_checkin", { p_event: id, p_code: code });
export const eventCheckinCode = (id: string) => rpc<string>("event_checkin_code", { p_event: id });
export async function eventConversationId(id: string) {
  const r = await must(supabase.from("conversations").select("id").eq("kind", "event").eq("ref_id", id).maybeSingle());
  return (r as any)?.id as string | undefined;
}

// ---------- chat ----------
export const myConversations = () => rpc<any[]>("my_conversations");
export const openDirect = (other: string) => rpc<string>("chat_open_direct", { p_other: other });
export const listMessages = (conv: string) =>
  must(supabase.from("messages").select("id,body,sender_id,created_at").eq("conversation_id", conv).order("created_at", { ascending: false }).limit(50)) as Promise<any[]>;
export async function sendMessage(conv: string, body: string) {
  return must(supabase.from("messages").insert({ conversation_id: conv, body, sender_id: await uid() }));
}

// ---------- games ----------
export const tableGames = () => must(supabase.from("table_games").select("*").eq("is_active", true));
export const questionCategories = () => must(supabase.from("question_categories").select("*").order("sort"));
export const questions = (cat: string) => must(supabase.from("scenario_questions").select("id,text").eq("category_code", cat).eq("is_active", true));

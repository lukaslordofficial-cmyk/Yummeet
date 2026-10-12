// Pure domain helpers (no imports) — mirrored by server-side SQL; unit-tested in /app/tests/frontend.
// The server is the source of truth; these only drive UI labels and which buttons to show.

export type RpsMove = "rock" | "paper" | "scissors";

/** 0 = tie, 1 = a wins, 2 = b wins (same as public._rps_winner). */
export function rpsWinner(a: RpsMove, b: RpsMove): 0 | 1 | 2 {
  if (a === b) return 0;
  const beats: Record<RpsMove, RpsMove> = { rock: "scissors", scissors: "paper", paper: "rock" };
  return beats[a] === b ? 1 : 2;
}

export const MISSION_STATUS_LABEL: Record<string, string> = {
  available: "Dostępna", accepted: "Przyjęta", in_progress: "W trakcie", pending_confirmation: "Czeka na potwierdzenie",
  completed: "Ukończona", rejected: "Odrzucona", cancelled: "Anulowana", expired: "Wygasła",
};

/** Next allowed client actions for a mission status (server re-validates every transition). */
export function missionActions(status: string, completions: number, repeatable: boolean): ("accept" | "start" | "submit" | "cancel")[] {
  switch (status) {
    case "available": return ["accept"];
    case "accepted": return ["start", "cancel"];
    case "in_progress": return ["submit", "cancel"];
    case "pending_confirmation": return ["cancel"];
    case "completed": case "rejected": case "cancelled": case "expired":
      return repeatable || completions === 0 ? ["accept"] : [];
    default: return [];
  }
}

export const DUEL_STATUS_LABEL: Record<string, string> = {
  proposed: "Zaproponowany", pending_acceptance: "Czeka na akceptację", accepted: "Zaakceptowany", round1: "Runda ataku",
  awaiting_card: "Wybór karty obronnej", awaiting_response: "Runda obrony", active_challenge: "Aktywne wyzwanie",
  awaiting_confirmation: "Czeka na potwierdzenie", finished: "Zakończony", cancelled: "Anulowany", rejected: "Odrzucony", expired: "Wygasły",
};

export const DUEL_OUTCOME_LABEL: Record<string, string> = {
  challenge_completed: "Wyzwanie wykonane", challenge_failed: "Wyzwanie niewykonane — karta przechodzi na atakującego",
  forfeited: "Rezygnacja — karta przechodzi na atakującego", refused_without_penalty: "Odmowa bez kary",
  no_offensive_card: "Zwycięzca nie miał karty ofensywnej", disputed: "Spór — przekazano do moderacji", walkover: "Walkower",
};

export const OPEN_DUEL_STATUSES = ["pending_acceptance", "accepted", "round1", "awaiting_card", "awaiting_response", "active_challenge", "awaiting_confirmation"];

/** XP progress within current level, 0..1. levels sorted by min_xp asc. */
export function levelProgress(xp: number, levels: { level: number; name: string; min_xp: number }[]) {
  const sorted = [...levels].sort((a, b) => a.min_xp - b.min_xp);
  let current = sorted[0] ?? { level: 1, name: "Nowicjusz", min_xp: 0 };
  for (const l of sorted) if (xp >= l.min_xp) current = l;
  const next = sorted.find((l) => l.min_xp > xp) ?? null;
  const progress = next ? (xp - current.min_xp) / (next.min_xp - current.min_xp) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)) };
}

/** Approximate bbox for a Leaflet view (used to query only what's on screen). */
export function viewToBBox(lat: number, lng: number, zoom: number) {
  const dLng = (360 / Math.pow(2, zoom)) * 1.2;
  const dLat = dLng * 0.9;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  return { south: clamp(lat - dLat, -89.9, 89), north: clamp(lat + dLat, -89, 89.9), west: clamp(lng - dLng, -179.9, 179), east: clamp(lng + dLng, -179, 179.9) };
}

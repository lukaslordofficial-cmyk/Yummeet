import { supabase } from "./supabase";

const MESSAGES: Record<string, string> = {
  not_authenticated: "Zaloguj się ponownie.",
  invalid_transition: "Ta akcja nie jest teraz dostępna.",
  rate_limited: "Zwolnij trochę — spróbuj za chwilę.",
  event_full: "Brak wolnych miejsc.",
  event_closed: "Zapisy są zamknięte.",
  blocked: "Nie możesz wejść w interakcję z tą osobą.",
  mission_already_open: "Ta misja jest już w toku.",
  mission_not_available: "Misja niedostępna.",
  repeat_limit_reached: "Osiągnięto limit powtórzeń tej misji.",
  cooldown_active: "Misję możesz powtórzyć później.",
  invalid_code: "Nieprawidłowy kod.",
  confirmer_required: "Wybierz osobę, która potwierdzi wykonanie.",
  duel_already_open: "Masz już otwarty pojedynek z tą osobą.",
  move_already_played: "Ruch już zagrany — czekamy na przeciwnika.",
  too_far_from_place: "Jesteś za daleko od miejsca wydarzenia (wymagane GPS w lokalu).",
  duel_mode_disabled: "Tryb pojedynków jest wyłączony.",
  cannot_duel_self: "Nie możesz wyzwać samego siebie.",
  invalid_evidence: "Dodaj opis dowodu (min. 3 znaki).",
  starts_in_past: "Termin musi być w przyszłości.",
  organizer_cannot_leave: "Organizator nie może opuścić własnego stołu.",
  organizer_cannot_checkin: "Organizator nie wpisuje kodu — pokaż go gościom na miejscu.",
  invalid_specialization: "Nieznana specjalizacja.",
  not_allowed: "Brak uprawnień.",
  too_early: "Kod / check-in dostępne dopiero w dniu i o godzinie wydarzenia.",
  event_closed: "Okno obecności minęło (max 4 h od startu) albo dzień się skończył.",
  not_joined: "Najpierw dołącz do wydarzenia.",
  no_venue_coords: "Brak współrzędnych miejsca — przy tworzeniu stołu wskaż lokalizację.",
  location_required: "Włącz GPS, żeby potwierdzić obecność.",
  use_reveal_with_gps: "Kod pojawi się po wykryciu GPS na miejscu w dniu wydarzenia.",
};

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as any).message) : String(e);
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (key) return MESSAGES[key];
  if (raw.includes("schema cache") || raw.includes("does not exist")) return "Baza danych nie jest jeszcze skonfigurowana (uruchom migracje).";
  if (/invalid api key/i.test(raw)) {
    return "Nieprawidłowy klucz Supabase. W frontend/.env wstaw URL i anon key z tego samego projektu (Settings → API).";
  }
  if (/pin_already_exists/i.test(raw)) {
    const parts = raw.split(":");
    const name = parts.length >= 3 ? parts.slice(2).join(":").trim() : "ta restauracja";
    return `Nie możesz dodać tego pinu — „${name}” jest już na mapie (współrzędne zajęte). Możesz dodać ocenę przy istniejącym lokalu.`;
  }
  return raw || "Coś poszło nie tak.";
}

export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

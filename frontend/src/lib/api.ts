import { supabase } from "./supabase";

const MESSAGES: Record<string, string> = {
  not_authenticated: "Zaloguj się ponownie.",
  invalid_transition: "Ta akcja nie jest teraz dostępna.",
  rate_limited: "Zwolnij trochę — spróbuj za chwilę.",
  event_full: "Brak wolnych miejsc.",
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
  too_early: "Kod QR jest dostępny od 4 godzin przed startem do 4 godzin po starcie.",
  event_closed: "Okno kodu minęło (4 godziny po starcie).",
  find_incomplete: "Zaznacz tak albo nie przy każdym zdaniu, zanim zapiszesz.",
  truth_incomplete: "Wpisz trzy zdania i oznacz, które jest kłamstwem.",
  play_not_live: "Ta zabawa jeszcze nie jest uruchomiona.",
  no_questions_left: "Nie ma już nowych pytań w puli.",
  not_joined: "Najpierw dołącz do wydarzenia.",
  not_member: "Tego czatu nie ma już na Twojej liście.",
  no_venue_coords: "Brak współrzędnych miejsca — przy tworzeniu stołu wskaż lokalizację.",
  not_your_turn: "Teraz kolej innej osoby. Poczekaj na swoją turę.",
  invalid_line: "Wpisz zdanie (1–1200 znaków).",
  story_closed: "Organizator zakończył tę historię.",
  duplicate_line: "To zdanie jest już ostatnim fragmentem historii.",
  story_members_only: "Dołącz do spotkania, żeby dopisywać historię.",
  location_required: "Włącz GPS, żeby potwierdzić obecność / zobaczyć ranking w okolicy.",
  proximity_only: "Pojedynki tylko w pobliżu — włącz tryb pojedynków w ustawieniach.",
  use_reveal_with_gps: "Kod QR pojawi się od 4 godzin przed startem, gdy GPS widzi Cię przy miejscu spotkania.",
  photo_quota_exceeded: "Brak wolnych slotów na zdjęcia (max 3 aktywne). Poczekaj 48 h po zakończeniu oferty/misji.",
  photo_slots_full: "Masz już 3 aktywne zdjęcia (dania / misje). Po zakończeniu oferty lub misji slot zwolni się po 48 h.",
  cannot_review_self: "Nie możesz ocenić własnego spotkania.",
  no_organizer: "To spotkanie nie ma organizatora.",
  invalid_rating: "Oceń wszystkie kategorie gwiazdkami.",
  deal_mode_required: "Wybierz formę współpracy: wynagrodzenie albo składniki + podział porcji.",
  pin_cover_locked: "To miejsce ma już zdjęcie lokalu — nie można dodać kolejnego.",
  pin_menu_photo_locked: "To miejsce ma już zdjęcie menu — nie można dodać kolejnego.",
  pin_menu_pdf_locked: "To miejsce ma już PDF menu — nie można dodać kolejnego.",
  allergens_required: "Zaznacz alergeny albo „Brak alergenów”.",
  invalid_title: "Podaj tytuł (min. 2 znaki).",
  invalid_body: "Opis triku musi mieć min. 10 znaków.",
  invalid_portions: "Podaj liczbę porcji (1–200).",
  invalid_kind: "Nieprawidłowy typ oferty.",
  pin_not_found: "Tego pinu już nie ma na mapie.",
  website_too_long: "Adres strony jest za długi.",
  phone_too_long: "Numer telefonu jest za długi.",
  order_url_too_long: "Link do dostawcy jest za długi.",
  need_score: "Zaznacz choć jedną cechę dania.",
  too_many_dishes: "Na jednym spotkaniu zmieści się 12 dań.",
  invalid_duration: "Czas spotkania: od 15 minut do 12 godzin.",
  invalid_budget: "Budżet na osobę jest poza zakresem.",
  invalid_photo: "Wybierz zdjęcie jeszcze raz.",
};

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as any).message) : String(e);
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (key) return MESSAGES[key];
  if (raw.includes("event_truth")) {
    return "Prawda czy kłamstwo na kilku telefonach wymaga migracji 048 i 053 w SQL Editorze Supabase.";
  }
  if (raw.includes("event_find_submit") || raw.includes("event_claim_code") || raw.includes("event_presence") || raw.includes("event_find_answers")) {
    return "Dwie tury zabawy i licznik spotkań wymagają migracji 047_find_rounds_presence.sql w SQL Editorze Supabase.";
  }
  if (raw.includes("event_play") || raw.includes("event_find_save") || raw.includes("event_find_picks")) {
    return "Panel zabaw wymaga migracji 046_play_qr_window.sql w SQL Editorze Supabase.";
  }
  if (raw.includes("add_event_photo") || raw.includes("event_photos")) {
    return "Zdjęcia spotkania zapisują się na stałe po migracji 054_play_journal_photos.sql w SQL Editorze Supabase.";
  }
  if (raw.includes("event_story")) {
    return "Wspólna historia wymaga migracji 043_meeting_plan_story.sql i 054_play_journal_photos.sql w SQL Editorze Supabase.";
  }
  if (raw.includes("event_set_meeting") || raw.includes("event_add_dish") || raw.includes("dish_ratings") || raw.includes("pin_dish_summary") || raw.includes("event_dish_board")) {
    return "Oceny dań wymagają migracji 040_meeting_categories_dishes.sql w SQL Editorze Supabase.";
  }
  if (raw.includes("schema cache") || raw.includes("does not exist") || raw.includes("public.events")) {
    return "Baza niegotowa: w SQL Editor uruchom migracje z docs/SETUP.md (w tym 012_repair_specs_duels.sql, potem 011).";
  }
  if (raw === "timeout" || /network request failed|failed to fetch|error fetch|fetch failed|typeerror: fetch|aborted|network error/i.test(raw)) {
    return "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
  }
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
  const call = supabase.rpc(fn, args);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), 20000);
  });
  const { data, error } = await Promise.race([call, timeout]);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), 20000);
  });
  const { data, error } = await Promise.race([Promise.resolve(p), timeout]);
  if (error) throw new Error(error.message);
  return data as T;
}

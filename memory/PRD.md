# Yummeet — PRD

## Original problem statement
Kompleksowa specyfikacja „YUMMEET” (aplikacja społecznościowo-gastronomiczna z grywalizacją): mapa pinów i Gastro-Trasa (z kodu pinonmap),
specjalizacje Yummiteerów, misje ze stanami walidowanymi po stronie serwera, karty kolekcjonerskie (ofensywne/defensywne/specjalne),
pojedynki KPN (zaproszenie + bliskość 100 m), otwarte stoły i wydarzenia restauratorów, czaty, profil jako karta postaci, XP/poziomy/odznaki,
bezpieczeństwo, RLS, prywatność lokalizacji, niskie koszty. Stack: Expo + TypeScript + Supabase (PostgreSQL/PostGIS).

## User choices
- Backend: Supabase użytkownika (URL + anon; service_role tylko w backend/.env)
- Logowanie: e-mail+hasło (Supabase) oraz Google (Emergent → magic link Supabase)
- Księga kart: własna (fochaway do dołączenia później)
- Trasy: jak w pinonmap (OSRM + Nominatim)

## Architecture
Expo Router (5 zakładek) → supabase-js (anon) → RPC/RLS w Postgres (SECURITY DEFINER, pinned search_path). FastAPI: /api/auth/google, dispatcher push.
Migracje: /app/supabase/migrations (001 schema, 002 functions, 003 seed), yummeet_all.sql. Docs: /app/docs/SETUP.md, PINONMAP_ADOPTION.md.

## Implemented (2026-06)
- Auth (email + Google), profile bootstrap + starter deck (3 off + 2 def)
- Map (Leaflet z pinonmap, OSM tiles), bbox RPC z cache/debounce, filtry kuchni, dodawanie pinów, szczegóły lokalu, wielowymiarowe recenzje, Yummeet Score, zweryfikowane wizyty (150 m)
- Gastro-Trasa: OSRM + PostGIS pins_along_route
- Specjalizacje (główna + zainteresowania; 25% misji innych klas), tablica misji, stany, potwierdzenia self/code/peer/location, idempotentne nagrody XP+karty, odznaki, poziomy
- Księga kart, katalog, historia kart
- Pojedynki: zaproszenie/akceptacja/odmowa, KPN z remisami, karta ofensywna losowa, runda obrony, karta defensywna, wyzwanie z terminem, dowód, potwierdzenie/spór, rezygnacja (utrata karty), timeouty, ranking; tryb bliskości (opt-in, foreground, 100 m, anty-spoofing)
- Stoły/wydarzenia (oficjalne wyróżnione), limit miejsc (row lock), kody obecności, Realtime, czaty (direct/event/duel) z Realtime i anty-spamem
- Ustawienia: prywatność, powiadomienia, dieta/alergie, tryb randkowy, blokady, usuwanie konta; gry przy stole i bank pytań (placeholdery)
- Schemat+RPC: wymiana potraw (losowanie), randki 3 poziomy, business/promotions, notifications/push_tokens
- Testy: SQL flows (lokalnie), smoke na Supabase, testy domenowe TS, testing agent iteracja 1 (zaliczone; naprawiono kafelki mapy)

## Backlog
- P0: rejestracja push tokenów (wymaga buildu), upload zdjęć dowodów (Object Storage)
- P1: UI wymiany potraw, wolontariatu, matchmakingu; panel restauratora; prawdziwe grafiki kart (fochaway)
- P2: sezony kart, ulepszenia, poziomy mistrzostwa, statystyki B2B, płatności

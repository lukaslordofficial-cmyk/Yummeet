# Yummeet — konfiguracja, migracje, uruchomienie

## Architektura
```
frontend/ (Expo SDK 57, expo-router, TypeScript)
  app/(tabs)/        3 zakładki MVP: index=Odkrywaj, tables=Spotkanie, route=Gastro-Trasa (czat i profil — pływające ikony; Jedzenie i Misje schowane)
  app/*              ekrany stosu: pin/[id], pin/new, route (Gastro-Trasa), mission/[id], duel/[id], duel/new,
                     cards (Księga kart), specializations, event/[id], event/new, chat/[id], settings, games, user/[id], login
  src/lib/           supabase.ts (klient), api.ts (rpc + mapowanie błędów), data.ts (warstwa dostępu do danych),
                     geo.ts + routing.ts + mapTiles.ts (z pinonmap), cuisines.ts
  src/domain/        rules.ts – czysta logika (KPN, stany misji/pojedynków, poziomy) – testowana jednostkowo
  src/components/    ui.tsx, GameCard, RpsPicker, EventCard, Icon, map/* (z pinonmap)
  src/hooks/         useDuelPresence (pojedynki z bliskości – tylko foreground)
backend/server.py    FastAPI: /api/auth/google (Emergent Google -> sesja Supabase) + dispatcher push (Expo Push API)
supabase/migrations  001_schema.sql, 002_functions.sql, 003_seed.sql   (yummeet_all.sql = wszystkie trzy)
supabase/tests       local_shim.sql (emulacja auth/ról), flows_test.sql (testy integracyjne przepływów)
tests/frontend       domain.test.ts
```
Cała logika nagród/XP/kart/pojedynków/rezerwacji działa po stronie bazy (funkcje `SECURITY DEFINER` z `set search_path`),
klient ma tylko klucz `anon` i nie może pisać do tabel nagród (RLS + odebrane uprawnienia).

## Zmienne środowiskowe
Wszystkie klucze muszą pochodzić z **tego samego** projektu Supabase (Settings → API).
- `frontend/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BACKEND_URL`
- `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (**tylko serwer, nigdy w aplikacji**)

Auth (e-mail/hasło oraz Google OAuth) działa bezpośrednio przez Supabase Auth w aplikacji — bez Emergent.

## Migracje (kolejność obowiązkowa)
W SQL Editor uruchamiaj **po kolei**, nie od razu `006`:

1. `supabase/yummeet_all.sql` — schemat + funkcje + seed (tworzy m.in. `public.events`). Idempotentny.
2. `supabase/migrations/004_pin_photos_and_route_cuisine.sql`
3. `supabase/migrations/005_pin_duplicate_guard.sql`
4. `supabase/migrations/006_checkin_attractions_travel.sql` — check-in GPS, atrakcje, `travel_km`
5. `supabase/migrations/007_fix_pins_bbox_return.sql` — `cover_url` w mapie pinów
6. `supabase/migrations/008_travel_routes.sql` — historia Gastro-Tras + knajpy z recenzją
7. `supabase/migrations/009_pin_price_range.sql` — zakres cen dań (price_min / price_max)
8. `supabase/migrations/010_pin_edit_specs_missions.sql` — (opcjonalnie; jeśli pada, pomiń)
9. **`supabase/migrations/012_repair_specs_duels.sql`** — NAPRAWA (idempotentna): specjalizacje + PD/skille + edycja pinów + pojedynki proximity / ranking 20 km. Uruchom **cały plik** z gita (wersja po poprawce `GROUP BY` przy remapowaniu klas). Jeśli wcześniej padło na `ON CONFLICT … second time` — po prostu odpal 012 jeszcze raz.
10. `supabase/migrations/011_mission_catalog_v2.sql` — katalog misji (pełne opisy; po udanym 012)
11. `supabase/migrations/013_mission_full_texts_no_deadline.sql` — pełne teksty misji + brak deadlinu (expires_at = null)
12. **`supabase/migrations/014_fix_expires_food_tab.sql`** — naprawa `expires_at is ambiguous` + Jedzenie (offer_kind, cooking_tips). Uruchom, jeśli misje nie ładują się w apce.
13. **`supabase/migrations/015_food_nearby_photos.sql`** — Jedzenie 20 km (lista + powiadomienia), GPS cache, limit zdjęć, miasto/ulica/miejsce.
14. **`supabase/migrations/016_photo_limits_journal_cleanup.sql`** — 1× zdjęcie lokalu + 1× menu/PDF na pin; Dziennik Spotkań (cron na końcu pliku może paść — OK).
15. **`supabase/migrations/017_photo_slots_48h.sql`** — **3 sloty** zdjęć; usuwanie ze Storage **48 h** po końcu oferty/misji.
16. **`supabase/migrations/018_fix_photo_slots_cleanup.sql`** — (opcjonalne) stare łatki; jeśli padało — pomiń.
17. **`supabase/migrations/019_photo_slots_bootstrap.sql`** — **uruchom ten plik** (kompletny): tworzy `photo_slots`, cleanup 48 h, hooki publikacji. Działa nawet gdy 017/018 nie przeszły.
18. **`supabase/migrations/020_signature_deal_mode.sql`** — Popisowe: tryb współpracy (`paid` / `ingredients_split`) + szczegóły oferty.
19. **`supabase/migrations/021_organizer_reviews.sql`** — oceny organizatorów spotkań (gwiazdki + opinie).
20. **`supabase/migrations/021_message_notify.sql`** — powiadomienie przy nowej wiadomości na czacie. (osobny plik obok `021_organizer_reviews` — uruchom oba)
21. **`supabase/migrations/022_tips_kinds_duel_chat.sql`** — Inspiracje: Przepisy / Life Hacki; czat przy złapaniu na pojedynek (proximity).
22. **`supabase/migrations/023_mission_book_cards.sql`** — Karty do księgi 1:1 z misjami (Smaczne Odkrycia + Gospodarz Stołu); nagroda po ukończeniu misji.
23. **`supabase/migrations/024_mission_verify_secure.sql`** — Zabezpieczenie ukończenia misji: `verify_kind`, peer review 24 h (+5 PD Detektyw), auto-zaliczenie stołów (uczestnik + check-in) i ogłoszeń/przepisów w Jedzeniu. **Wymagane**, żeby nie dało się zaliczyć misji wpisaniem dowolnego tekstu.
24. **`supabase/migrations/025_mission_peer2_pin_author.sql`** — Peer review: max 5 osób, **1 akceptacja**; auto-powiązanie pinu z misją; autor pinu; min. 20 znaków.
25. **`supabase/migrations/026_repair_pin_update_journal.sql`** — **NAPRAWA** gdy edycja pinu / dziennik spotkań / 025 pada na `menu_pdf_url`. Dodaje brakujące kolumny, `update_pin`, `pin_details`, `my_meeting_journal`. Uruchom **przed ponownym 025**, jeśli 025 się wywaliło.
26. **`supabase/migrations/027_peer1_price_filter.sql`** — 1 akceptacja społeczności; DROP+recreate `mission_review_inbox`; filtr cen w `pins_in_bbox`.
27. **`supabase/migrations/028_fix_edit_pin_price_always.sql`** — naprawa `update_pin` / cen / inbox (gdy 024 padło).
28. **`supabase/migrations/029_fix_pin_updated_xp_cards.sql`** — FIX edycji pinu (`pins.updated_at`), połowa XP misji, powiadomienie przy karcie.
29. **`supabase/migrations/030_mission_auto_complete.sql`** — **Auto-misje**: wykonanie akcji (pin / oferta / tip / stół+check-in) zalicza misję i daje kartę **bez** klikania „Przyjmij”. Piny idą najpierw do peer review (1× OK).
30. **`supabase/migrations/031_fix_create_pin_overload.sql`** — **NAPRAWA** gdy dodawanie pinu pada na `PGRST203` / „Could not choose the best candidate function” (stare przeciążenia `create_pin`).
31. **`supabase/migrations/032_warsaw_pins_website_delete.sql`** — strona www przy pinie, `delete_pin`, próbka 27 lokali z Warszawy (bez cen; menu zostaje na stronie).
32. **`supabase/migrations/033_krakow_pins.sql`** — 27 lokali z Krakowa (różne kuchnie) oraz zdjęcie wklejonego URL-a z opisu pinów. Przycisk menu czyta kolumnę `website`.
33. **`supabase/migrations/034_pin_website_backfill.sql`** — `pin_details` zawsze zwraca `website`; uzupełnia brakujący URL z opisu.
34. **`supabase/migrations/035_capitals_pins.sql`** — ~330 lokali ze stroną www w pozostałych stolicach województw (bez Warszawy i Krakowa).
35. **`supabase/migrations/036_pin_order_phone_delivery.sql`** — telefon + linki Wolt/Pyszne/Glovo/Uber Eats przy pinie; warunkowe przyciski „Zamów”.
36. **`supabase/migrations/037_pins_bbox_higher_limit.sql`** — mapa ładuje do 1000 pinów w kadrze (wcześniej ucinała przy 300).
37. **`supabase/migrations/038_poland_osm_website_pins_001.sql`** … **`_061.sql`** — 10 310 lokali gastronomicznych z całej Polski, które w OpenStreetMap mają stronę www (21 października 2026). Uruchom **wszystkie** pliki `038_` po kolei. Plik pomija lokal, jeśli w promieniu 40 m jest już opublikowany pin. Nie dodaje linków Uber Eats, Glovo, Pyszne, Wolt ani Bolt Food.
38. **`supabase/migrations/039_map_frame_and_route_order.sql`** — kadr do 1500 pinów; Gastro-Trasa sortuje lokale w pasie od najbliższego wobec GPS.

### Szybka naprawa edycji pinu
1. **`029_fix_pin_updated_xp_cards.sql`**
2. Odśwież apkę

### Auto-zaliczanie misji
Uruchom **`030_mission_auto_complete.sql`** (wymaga wcześniej działającego peer review z 025/027).

Powiadomienia na trasie (dźwięk) + śledzenie w tle: włącz przełącznik na aktywnej trasie.
Pełne tło (apka zamknięta) wymaga buildu z uprawnieniem „Always” lokalizacji; w Expo Go działa foreground + lokalne powiadomienia.

Jeśli zobaczysz `relation "public.events" does not exist` — **nie uruchomiłeś kroku 1**.  
Jeśli `cannot change return type` przy `pins_in_bbox`:
1. Uruchom **tylko** `000_fix_pins_bbox_drop.sql` (DROP funkcji).
2. Potem `006`, potem `007`.
3. **Nie uruchamiaj ponownie całego `yummeet_all.sql`**, jeśli baza już działa — to właśnie powoduje konflikt typu zwracanego.

Potem: Authentication → Providers → Email → wyłącz „Confirm email” (testy).  
Opcjonalnie Google OAuth + Redirect URLs Expo.

### Gastro-Trasa
Punkt A/B: GPS, podpowiedzi adresów (Nominatim) przy pisaniu, trasa OSRM, piny w buforze trasy (PostGIS), filtr kuchni.

## Testy
```
# testy domenowe (TS)
node --test tests/frontend/domain.test.ts
# testy integracyjne SQL na lokalnym Postgres+PostGIS (emulacja Supabase)
createdb ytest && for f in supabase/tests/local_shim.sql supabase/yummeet_all.sql supabase/tests/flows_test.sql; do psql -d ytest -v ON_ERROR_STOP=1 -f $f; done
```
`flows_test.sql` sprawdza: talię startową, przejścia misji, odporność na podwójne naliczenie nagrody, limity powtórzeń,
RLS (brak możliwości dopisania kart/XP), PostGIS (bbox, trasa, walidacja geometrii), pełny pojedynek (remis, atak, obrona,
wyzwanie, dowód, potwierdzenie), rezygnację z utratą karty, ranking, limit miejsc stołu, czaty.

## Stany
- Misja: available → accepted → in_progress → (pending_confirmation) → completed | rejected | cancelled | expired
- Pojedynek: pending_acceptance → round1 (atak, remis = kolejne rozdanie) → awaiting_response (runda obrony)
  → awaiting_card (obrońca wygrał i ma karty) → active_challenge → awaiting_confirmation → finished;
  także cancelled / rejected / expired. Timeouty (`duel_tick`): brak ruchu 30 min = walkower/wygaśnięcie,
  brak dowodu do terminu = utrata losowej karty, brak przeglądu przez atakującego 48 h = auto-akceptacja,
  odrzucenie dowodu = spór do moderacji (bez automatycznej kary).
- Pojedynek z bliskości: tylko przy włączonym trybie, ping co 30 s w foreground, promień 100 m, brak historii pozycji,
  limit 1 pojedynek/para/12 h, odrzucanie skoków > 250 km/h i mock-location (Android).

## Co jest atrapą / do zrobienia
- Grafiki kart: placeholder (jedno zdjęcie); `art_key` gotowy na podmianę.
- Powiadomienia push: tabela `notifications` + dispatcher działają; rejestracja tokenu w aplikacji wymaga buildu
  (Expo Go nie obsługuje zdalnych push na Androidzie).
- Wymiana potraw/wolontariat/randki: schemat + RPC (`food_exchange_draw`, `match_request_level`, `match_end`), bez pełnego UI.
- Panel restauratora: tabele `business_profiles`, `promotions`, oficjalne wydarzenia (`event_create` z `p_business`) – bez UI.
- Kilometry podróży: 0 do czasu wdrożenia zweryfikowanej metody pomiaru.
- Zdjęcia jako dowody: obecnie opis/link; upload do Object Storage w kolejnym etapie.

## Koszty (zweryfikowane założenia)
OSRM `routing.openstreetmap.de` i Nominatim – darmowe, z polityką fair-use (Nominatim max ~1 req/s; zapytania tylko
po akcji użytkownika). Kafelki: OpenStreetMap (fair-use, wymagana atrybucja; dla ruchu produkcyjnego potrzebny płatny/własny serwer).
Mapa pobiera tylko id/tytuł/współrzędne (max 200, debounce 700 ms, cache siatki ~2 km). Realtime: jeden kanał na
aktywny ekran (lista stołów, pojedynczy stół, czat), zamykany przy wyjściu.

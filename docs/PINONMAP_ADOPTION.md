# Audyt pinonmap → Yummeet

## Struktura pinonmap (Expo SDK 54, React Navigation, Supabase)
- `frontend/src/components/map/` – mapa Leaflet w WebView (native) / iframe (web), komunikacja postMessage
- `frontend/src/lib/routing.ts` – trasy OSRM (FOSSGIS, bez klucza, dzielenie długich tras na fragmenty) + geokodowanie Nominatim
- `frontend/src/lib/geo.ts` – haversine, odległość punktu od polilinii, bbox, upraszczanie polilinii
- `frontend/src/screens/RoutePlannerScreen.tsx` – wyszukiwanie miejsc przy trasie **po stronie klienta** (`distanceToPolyline`)
- `supabase/schema.sql` – tabela `places` (lat/lng jako float, bez PostGIS), XP/misje/eventy (`pom_*`)

## Co przejęto
| pinonmap | Yummeet | Zmiany |
|---|---|---|
| `components/map/leafletHtml.ts`, `AppMapView.*` | `frontend/src/components/map/` | kolory Yummeet, memo źródła WebView, dostawca kafelków w `src/lib/mapTiles.ts` |
| `lib/routing.ts` | `frontend/src/lib/routing.ts` | bez zmian (OSRM + Nominatim) |
| `lib/geo.ts` | `frontend/src/lib/geo.ts` | bez zmian (simplify/format używane w Gastro-Trasie) |
| `lib/supabase.ts` | `frontend/src/lib/supabase.ts` | storage przez `@/src/utils/storage`, auto-refresh tylko w foreground |
| koncepcja XP z ledgerem/triggerem ochronnym | `xp_ledger` + `_award_xp` | unikalność (user, źródło), progi w `level_definitions` |

## Co napisano od nowa i dlaczego
- **Wyszukiwanie przy trasie** przeniesione z klienta do PostGIS (`pins_along_route`: `ST_DWithin` na `geography` + indeks GiST,
  walidacja geometrii, limit wyników, sortowanie `ST_LineLocatePoint`). Klient nie musi pobierać wszystkich lokali.
- **`places` → `pins`** z `geography(Point,4326)`; brak drugiej tabeli pinów.
- Nawigacja: expo-router (szablon projektu) zamiast React Navigation; ekrany pinonmap nie były kompatybilne 1:1.
- Pominięto: `boards`, `likes`, `follows`, `shares`, `import_runs`, premium – niepotrzebne w MVP Yummeet.
- Licencja: brak pliku LICENSE w archiwum – kod pochodzi z Twojego własnego projektu, Leaflet (BSD-2), dane OSM (ODbL – wymagana atrybucja w wersji produkcyjnej).

// Routing + geocoding provider abstraction.
// Default: OSRM (FOSSGIS servers, free, no API key) + Nominatim geocoding (OpenStreetMap).
import type { LatLng } from "./geo";

export type TravelMode = "car" | "bike" | "foot";

export interface RouteResult {
  geometry: LatLng[];
  distanceM: number;
  durationS: number;
}

export interface GeocodeResult {
  title: string;
  lat: number;
  lng: number;
  /** Structured bits when available */
  country?: string;
  city?: string;
  street?: string;
  /** Primary short name for prefix sort (city / street / POI) */
  sortKey?: string;
}

export interface RoutingProvider {
  id: string;
  name: string;
  route(points: LatLng[], mode: TravelMode): Promise<RouteResult>;
}

const OSRM_BASE: Record<TravelMode, string> = {
  car: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  bike: "https://routing.openstreetmap.de/routed-bike/route/v1/driving",
  foot: "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
};
const OSRM_FALLBACK = "https://router.project-osrm.org/route/v1/driving";

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Yummeet/1.0 (github.com/lukaslordofficial-cmyk/Yummeet)",
};

/** Format: [nazwa POI —] kraj — miasto — ulica */
export function formatAddressLabel(address: Record<string, string> | undefined, fallback: string, name?: string): string {
  const a = address || {};
  const country = a.country || "";
  const city = a.city || a.town || a.village || a.municipality || a.city_district || a.county || "";
  const street = [a.road, a.house_number].filter(Boolean).join(" ") || a.pedestrian || a.suburb || a.neighbourhood || "";
  const rest = [country, city, street].filter(Boolean);
  const poi = (name || "").trim();
  if (poi && poi !== city && poi !== street && !rest.includes(poi)) {
    return rest.length ? `${poi} — ${rest.join(" — ")}` : poi;
  }
  return rest.length ? rest.join(" — ") : fallback;
}

async function osrmFetch(base: string, points: LatLng[]): Promise<RouteResult> {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error(`Routing HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error(data.message || "No route found");
  const r = data.routes[0];
  return {
    geometry: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
    distanceM: r.distance,
    durationS: r.duration,
  };
}

const CHUNK = 50;

async function routeChunk(points: LatLng[], mode: TravelMode): Promise<RouteResult> {
  try {
    return await osrmFetch(OSRM_BASE[mode], points);
  } catch {
    if (mode === "car") return osrmFetch(OSRM_FALLBACK, points);
    throw new Error("Nie udało się wyznaczyć trasy");
  }
}

export const osrmProvider: RoutingProvider = {
  id: "osrm",
  name: "OSRM (OpenStreetMap)",
  async route(points, mode) {
    const results: RouteResult[] = [];
    for (let i = 0; i < points.length - 1; i += CHUNK - 1) {
      results.push(await routeChunk(points.slice(i, i + CHUNK), mode));
    }
    return {
      geometry: results.flatMap((r, i) => (i === 0 ? r.geometry : r.geometry.slice(1))),
      distanceM: results.reduce((a, r) => a + r.distanceM, 0),
      durationS: results.reduce((a, r) => a + r.durationS, 0),
    };
  },
};

export const ROUTING_PROVIDERS: RoutingProvider[] = [osrmProvider];
export const routingProvider = (): RoutingProvider => ROUTING_PROVIDERS[0];

function polishFold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

const STREET_TOKEN: Array<[RegExp, string]> = [
  [/^(ul|ul\.)$/i, "ulica"],
  [/^(os|os\.|osied|osied\.)$/i, "osiedle"],
  [/^(al|al\.)$/i, "aleja"],
  [/^(pl|pl\.)$/i, "plac"],
];
const STREET_TYPE = /^(ulica|osiedle|aleja|plac)$/i;

/** „ul” / „os” rozwijają się do ulicy i osiedla, a sama nazwa szuka się też bez przedrostka. */
export function placeQueryVariants(query: string): string[] {
  const raw = query.trim().replace(/\s+/g, " ");
  if (raw.length < 2) return [];
  const expanded = raw.split(" ").map((part) => {
    const hit = STREET_TOKEN.find(([re]) => re.test(part));
    return hit ? hit[1] : part;
  }).join(" ");
  const stripped = expanded.split(" ").filter((part) => !STREET_TYPE.test(part)).join(" ").trim();
  const out = [expanded];
  if (raw !== expanded) out.unshift(raw);
  if (stripped.length >= 3 && !out.includes(stripped)) out.push(stripped);
  return out;
}

/** Krótka podpowiedź: „Kraków Rynek Główny 16”. */
export function placeSuggestionTitle(parts: { city?: string; street?: string; house?: string; name?: string; fallback?: string }): string {
  const road = [parts.street, parts.house].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const name = parts.name && parts.name !== parts.city && parts.name !== road ? parts.name.trim() : "";
  const line = [parts.city, road || name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return line || parts.fallback || "";
}

const STREET_WORD = /^(ul|ulica|os|osiedle|al|aleja|pl|plac)$/;

function queryTokens(query: string): string[] {
  return polishFold(query).split(/[^a-z0-9]+/).filter((token) => token.length >= 2 && !STREET_WORD.test(token));
}

function placeScore(row: GeocodeResult, query: string): number {
  const tokens = queryTokens(query);
  if (!tokens.length) return 0;
  const key = polishFold(`${row.title} ${row.city ?? ""} ${row.street ?? ""}`);
  return tokens.reduce((sum, token) => sum + (key.includes(token) ? 1 : 0), 0);
}

/** Prefer names that contain the typed words, city and street before a loose match. */
function sortByPrefix(results: GeocodeResult[], query: string): GeocodeResult[] {
  return [...results].sort((a, b) => {
    const sa = placeScore(a, query);
    const sb = placeScore(b, query);
    if (sa !== sb) return sb - sa;
    return polishFold(a.title).localeCompare(polishFold(b.title), "pl");
  });
}

async function geocodePhoton(query: string, _lang: string): Promise<GeocodeResult[]> {
  const url =
    `https://photon.komoot.io/api/?limit=12&lang=default` +
    `&bbox=14.07,49.00,24.15,54.84&lat=52.1&lon=19.4` +
    `&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  const out: GeocodeResult[] = [];
  for (const f of data?.features ?? []) {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (lat == null || lng == null) continue;
    // Bias to Poland when country is set
    if (p.country && !/polska|poland/i.test(String(p.country)) && p.countrycode && p.countrycode !== "PL") continue;
    const name = p.name || p.street || p.city || p.district || "";
    const city = p.city || p.town || p.village || p.county || "";
    const street = p.street || "";
    const country = p.country || "Polska";
    const title = placeSuggestionTitle({
      city,
      street,
      house: p.housenumber,
      name,
      fallback: name || [city, country].filter(Boolean).join(" "),
    });
    out.push({
      title,
      lat: Number(lat),
      lng: Number(lng),
      country,
      city: city || undefined,
      street: street || undefined,
      sortKey: name || street || city || title,
    });
  }
  return out;
}

async function geocodeNominatim(query: string, lang: string): Promise<GeocodeResult[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=10` +
    `&countrycodes=pl&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return (data ?? []).map((r: any) => {
    const poiName = r.namedetails?.name || r.name || undefined;
    const city = r.address?.city || r.address?.town || r.address?.village;
    const street = r.address?.road || undefined;
    return {
      title: placeSuggestionTitle({
        city,
        street,
        house: r.address?.house_number,
        fallback: formatAddressLabel(r.address, r.display_name as string, poiName),
      }),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      country: r.address?.country,
      city,
      street,
      sortKey: poiName || street || city || r.display_name,
    } as GeocodeResult;
  });
}

async function geocodeNominatimStreet(street: string, lang: string): Promise<GeocodeResult[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=8` +
    `&countrycodes=pl&accept-language=${encodeURIComponent(lang)}&street=${encodeURIComponent(street)}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return (data ?? []).map((r: any) => {
    const poiName = r.namedetails?.name || r.name || undefined;
    const city = r.address?.city || r.address?.town || r.address?.village;
    const streetName = r.address?.road || undefined;
    return {
      title: placeSuggestionTitle({
        city,
        street: streetName,
        house: r.address?.house_number,
        fallback: formatAddressLabel(r.address, r.display_name as string, poiName),
      }),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      country: r.address?.country,
      city,
      street: streetName,
      sortKey: streetName || poiName || city || r.display_name,
    } as GeocodeResult;
  });
}

function dedupePlaces(results: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const row of results) {
    const key = `${row.lat.toFixed(4)}:${row.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function geocodeNominatimCityStreet(query: string, lang: string): Promise<GeocodeResult[]> {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  const attempts = [
    [parts[0], parts.slice(1).join(" ")],
    [parts[parts.length - 1], parts.slice(0, -1).join(" ")],
  ];
  const bags = await Promise.all(attempts.map(async ([city, street]) => {
    if (!city || !street || city.length < 2 || street.length < 2) return [];
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=6` +
      `&countrycodes=pl&accept-language=${encodeURIComponent(lang)}` +
      `&city=${encodeURIComponent(city)}&street=${encodeURIComponent(street)}`;
    try {
      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!res.ok) return [];
      const data = await res.json();
      return (data ?? []).map((r: any) => {
        const cityName = r.address?.city || r.address?.town || r.address?.village;
        const road = r.address?.road || undefined;
        return {
          title: placeSuggestionTitle({
            city: cityName,
            street: road,
            house: r.address?.house_number,
            fallback: formatAddressLabel(r.address, r.display_name as string, r.name),
          }),
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          country: r.address?.country,
          city: cityName,
          street: [road, r.address?.house_number].filter(Boolean).join(" ") || undefined,
          sortKey: [cityName, road].filter(Boolean).join(" "),
        } as GeocodeResult;
      });
    } catch {
      return [];
    }
  }));
  return bags.flat();
}

/** Autocomplete: skróty ulicy i osiedla, potem Photon (Polska) i ulice Nominatim. */
export async function geocode(query: string, lang = "pl"): Promise<GeocodeResult[]> {
  const variants = placeQueryVariants(query);
  if (!variants.length) return [];
  const street = variants[variants.length - 1];
  const bags = await Promise.all(variants.map(async (part) => {
    try {
      const photon = await geocodePhoton(part, lang);
      if (photon.length) return photon;
    } catch { /* nominatim */ }
    try { return await geocodeNominatim(part, lang); } catch { return []; }
  }));
  if (street.length >= 3) {
    try { bags.push(await geocodeNominatimStreet(street, lang)); } catch { /* ignore */ }
  }
  try { bags.push(await geocodeNominatimCityStreet(query, lang)); } catch { /* ignore */ }
  if (street !== query.trim()) {
    try { bags.push(await geocodeNominatimCityStreet(street, lang)); } catch { /* ignore */ }
  }
  const ranked = sortByPrefix(dedupePlaces(bags.flat()), variants[0]);
  const best = ranked.length ? placeScore(ranked[0], variants[0]) : 0;
  const tight = best > 0 ? ranked.filter((row) => placeScore(row, variants[0]) === best) : ranked;
  return tight.slice(0, 8);
}

/** Reverse geocode for a map tap. */
export async function reverseGeocode(lat: number, lng: number, lang = "pl"): Promise<GeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1` +
    `&lat=${lat}&lon=${lng}&accept-language=${encodeURIComponent(lang)}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const r = await res.json();
  if (!r?.lat) return { title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
  return {
    title: formatAddressLabel(r.address, r.display_name as string, r.name),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    country: r.address?.country,
    city: r.address?.city || r.address?.town || r.address?.village,
    street: [r.address?.road, r.address?.house_number].filter(Boolean).join(" ") || undefined,
  };
}

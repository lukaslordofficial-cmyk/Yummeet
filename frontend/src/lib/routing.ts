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

/** Format: kraj — miasto — ulica */
export function formatAddressLabel(address: Record<string, string> | undefined, fallback: string, name?: string): string {
  const a = address || {};
  const country = a.country || "";
  const city = a.city || a.town || a.village || a.municipality || a.city_district || a.county || "";
  const street = [a.road, a.house_number].filter(Boolean).join(" ") || a.pedestrian || a.suburb || a.neighbourhood || name || "";
  const parts = [country, city, street].filter(Boolean);
  return parts.length ? parts.join(" — ") : fallback;
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

/** Forward geocoding via Nominatim (addressdetails → kraj — miasto — ulica). */
export async function geocode(query: string, lang = "pl"): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6` +
    `&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return (data ?? []).map((r: any) => {
    const title = formatAddressLabel(r.address, r.display_name as string, r.name);
    return {
      title,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      country: r.address?.country,
      city: r.address?.city || r.address?.town || r.address?.village,
      street: [r.address?.road, r.address?.house_number].filter(Boolean).join(" ") || undefined,
    } as GeocodeResult;
  });
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

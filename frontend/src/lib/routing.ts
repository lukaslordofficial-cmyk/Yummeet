// Routing + geocoding provider abstraction.
// Default: OSRM (FOSSGIS servers, free, no API key) + Nominatim geocoding (OpenStreetMap).
// Add another provider (Google, Mapbox, ORS...) by implementing RoutingProvider and registering it.
import type { LatLng } from './geo';

export type TravelMode = 'car' | 'bike' | 'foot';

export interface RouteResult {
  geometry: LatLng[];
  distanceM: number;
  durationS: number;
}

export interface GeocodeResult {
  title: string;
  lat: number;
  lng: number;
}

export interface RoutingProvider {
  id: string;
  name: string;
  route(points: LatLng[], mode: TravelMode): Promise<RouteResult>;
}

const OSRM_BASE: Record<TravelMode, string> = {
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
};
const OSRM_FALLBACK = 'https://router.project-osrm.org/route/v1/driving';

async function osrmFetch(base: string, points: LatLng[]): Promise<RouteResult> {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error(`Routing HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.message || 'No route found');
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
  } catch (e) {
    if (mode === 'car') return osrmFetch(OSRM_FALLBACK, points);
    throw e;
  }
}

export const osrmProvider: RoutingProvider = {
  id: 'osrm',
  name: 'OSRM (OpenStreetMap)',
  async route(points, mode) {
    // No hard limit on stops: long lists are routed in overlapping chunks and stitched together.
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

/** Forward geocoding via Nominatim (free; keep usage light, 1 req per user action). */
export async function geocode(query: string, lang = 'en'): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=${lang}&q=${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data ?? []).map((r: any) => ({ title: r.display_name as string, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
}

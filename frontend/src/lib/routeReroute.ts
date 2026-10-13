import { pinsAlongRoute } from "@/src/lib/data";
import { distanceToPolyline, simplify, type LatLng } from "@/src/lib/geo";
import { filterPinsNearUser } from "@/src/lib/routePinsFilter";
import type { ActiveRoute } from "@/src/lib/routeTypes";
import { routingProvider } from "@/src/lib/routing";

/** Odległość od polilinii, powyżej której traktujemy zjechanie z trasy. */
export const OFF_ROUTE_M = 120;
const MIN_REROUTE_MS = 25_000;

let lastRerouteAt = 0;
let rerouting = false;

export function isOffRoute(pos: LatLng, line: LatLng[], thresholdM = OFF_ROUTE_M): boolean {
  if (line.length < 2) return false;
  return distanceToPolyline(pos, line).distanceM > thresholdM;
}

/**
 * GPS-style: z aktualnej pozycji → cel B, świeża geometria + piny.
 * Debounce, żeby nie spamować OSRM.
 */
export async function maybeRerouteFrom(pos: LatLng, route: ActiveRoute): Promise<ActiveRoute | null> {
  if (!route.tracking || route.line.length < 2) return null;
  if (!isOffRoute(pos, route.line)) return null;
  const now = Date.now();
  if (rerouting || now - lastRerouteAt < MIN_REROUTE_MS) return null;
  rerouting = true;
  lastRerouteAt = now;
  try {
    const dest = { lat: route.b.lat, lng: route.b.lng };
    // Już prawie na miejscu — nie przeliczaj
    if (distanceToPolyline(pos, [dest]).distanceM < 80) return null;
    const r = await routingProvider().route([pos, dest], route.mode);
    const line = simplify(r.geometry, 400);
    const raw = await pinsAlongRoute(
      line.map((p) => [p.lng, p.lat] as [number, number]),
      Math.max(route.buffer, 2500),
      route.cuisine,
    );
    const pins = filterPinsNearUser(raw, pos, route.buffer);
    return {
      ...route,
      line,
      meta: { d: r.distanceM, t: r.durationS },
      pins,
      // zachowaj alertowane — nie spamuj ponownie
    };
  } catch {
    return null;
  } finally {
    rerouting = false;
  }
}

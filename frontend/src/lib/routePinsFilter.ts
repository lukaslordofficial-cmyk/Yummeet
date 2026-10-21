import { clampRouteBuffer, haversineM, withinRouteReach, type LatLng } from "@/src/lib/geo";
import type { PinMarker } from "@/src/types";

/**
 * Bufor „≤ X km stąd”: zostaw tylko piny w zasięgu od aktualnej lokalizacji.
 * Bez GPS — bez dodatkowego filtra (zostaje korytarz trasy z API).
 */
export function filterPinsNearUser(
  pins: PinMarker[],
  userPos: LatLng | null,
  maxDistanceM: number,
): PinMarker[] {
  if (!userPos || !Number.isFinite(maxDistanceM) || maxDistanceM <= 0) return pins;
  return pins.filter((p) => haversineM(userPos, { lat: p.lat, lng: p.lng }) <= maxDistanceM + 5);
}

/** Lokale w pasie od trasy (maks. 3 km), najbliższe wobec GPS na początku. */
export function pinsNearestOnRoute<T extends LatLng & { distance_m?: number | null }>(
  pins: T[],
  line: LatLng[],
  bufferM: number,
  origin: LatLng | null,
): T[] {
  const cap = clampRouteBuffer(bufferM);
  const inBand = pins.filter((p) => {
    if (!withinRouteReach(p, line, origin, cap)) return false;
    if (typeof p.distance_m === "number" && p.distance_m > cap + 8) return false;
    return true;
  });
  if (!origin) return inBand;
  return [...inBand].sort((a, b) => haversineM(origin, a) - haversineM(origin, b));
}

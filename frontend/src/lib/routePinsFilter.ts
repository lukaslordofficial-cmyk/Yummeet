import { haversineM, type LatLng } from "@/src/lib/geo";
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

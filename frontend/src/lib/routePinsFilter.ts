import { distanceToPolyline, haversineM, type LatLng } from "@/src/lib/geo";
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

/** Lokale w pasie kilometrów od linii trasy, od najbliższego do użytkownika. */
export function pinsNearestOnRoute<T extends LatLng>(
  pins: T[],
  line: LatLng[],
  bufferM: number,
  origin: LatLng | null,
): T[] {
  const inBand = line.length < 2
    ? pins
    : pins.filter((p) => distanceToPolyline(p, line).distanceM <= bufferM + 8);
  if (!origin) return inBand;
  return [...inBand].sort((a, b) => haversineM(origin, a) - haversineM(origin, b));
}

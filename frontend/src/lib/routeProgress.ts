import { distanceToPolyline, type LatLng } from "@/src/lib/geo";
import type { PinMarker } from "@/src/types";

export type PinProgressStatus = "passed" | "next" | "ahead";

export type PinWithStatus = PinMarker & { status: PinProgressStatus; index: number };

/** Sort by position along route; classify vs user progress. */
export function classifyRoutePins(pins: PinMarker[], userAlong: number | null): PinWithStatus[] {
  const sorted = [...pins].sort((a, b) => (a.along ?? 0) - (b.along ?? 0));
  let nextIdx = -1;
  if (userAlong != null) {
    nextIdx = sorted.findIndex((p) => (p.along ?? 0) >= userAlong - 0.02);
    if (nextIdx < 0) nextIdx = sorted.length; // all passed
  }
  return sorted.map((p, i) => {
    let status: PinProgressStatus = "ahead";
    if (userAlong == null) status = i === 0 ? "next" : "ahead";
    else if (i < nextIdx) status = "passed";
    else if (i === nextIdx) status = "next";
    else status = "ahead";
    return { ...p, status, index: i };
  });
}

export function userAlongRoute(pos: LatLng | null, line: LatLng[]): number | null {
  if (!pos || line.length < 2) return null;
  return distanceToPolyline(pos, line).along;
}

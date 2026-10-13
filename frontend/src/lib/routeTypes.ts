import type { LatLng } from "@/src/lib/geo";
import type { GeocodeResult, TravelMode } from "@/src/lib/routing";
import type { PinMarker } from "@/src/types";

/** Aktywna Gastro-Trasa (persistowana lokalnie, dopóki nie zamknięta). */
export type ActiveRoute = {
  id: string;
  a: GeocodeResult;
  b: GeocodeResult;
  mode: TravelMode;
  buffer: number;
  cuisine: string | null;
  line: LatLng[];
  meta: { d: number; t: number } | null;
  pins: PinMarker[];
  startedAt: string;
  tracking: boolean;
  notifyEnabled: boolean;
  trackedM: number;
  alertedPinIds: string[];
};

export type TravelRouteRow = {
  id: string;
  title: string;
  place_a: string;
  place_b: string;
  mode: string;
  distance_m: number;
  km_tracked: number;
  started_at: string;
  ended_at: string;
  reviewed: { pin_id: string; title: string; reviewed_at: string }[];
};

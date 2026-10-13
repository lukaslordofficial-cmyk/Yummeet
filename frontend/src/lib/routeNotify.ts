import { Platform } from "react-native";

import type { Coords } from "@/src/lib/location";
import { haversineM } from "@/src/lib/geo";
import type { ActiveRoute } from "@/src/lib/routeTypes";
import type { PinMarker } from "@/src/types";

const NEAR_M = 200;

let Notifications: typeof import("expo-notifications") | null = null;

async function mod() {
  if (Platform.OS === "web") return null;
  if (!Notifications) {
    try {
      Notifications = await import("expo-notifications");
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      return null;
    }
  }
  return Notifications;
}

export async function ensureNotifyPermission(): Promise<boolean> {
  const N = await mod();
  if (!N) return false;
  const cur = await N.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await N.requestPermissionsAsync();
  return !!req.granted;
}

export async function notifyNearPin(title: string, body: string): Promise<void> {
  const N = await mod();
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/** Sprawdź piny w pobliżu; zwróć nowe alertowane id (do zapisu w ActiveRoute). */
export async function checkNearPins(
  pos: Coords,
  pins: PinMarker[],
  alerted: string[],
  enabled: boolean,
): Promise<string[]> {
  if (!enabled) return alerted;
  const next = [...alerted];
  for (const p of pins) {
    if (next.includes(p.id)) continue;
    if (haversineM(pos, { lat: p.lat, lng: p.lng }) <= NEAR_M) {
      next.push(p.id);
      await notifyNearPin("Knajpa na trasie", `${p.title} — jesteś w pobliżu`);
    }
  }
  return next;
}

export function patchAlerted(route: ActiveRoute, alertedPinIds: string[]): ActiveRoute {
  return { ...route, alertedPinIds };
}

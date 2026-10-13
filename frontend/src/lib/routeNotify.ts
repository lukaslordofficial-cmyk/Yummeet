import { Platform } from "react-native";

import { haversineM } from "@/src/lib/geo";
import type { Coords } from "@/src/lib/location";
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

/** Nie blokuje przełącznika — true jeśli system dał zgodę (opcjonalnie). */
export async function ensureNotifyPermission(): Promise<boolean> {
  const N = await mod();
  if (!N) return false;
  try {
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await N.requestPermissionsAsync();
    return !!req.granted;
  } catch {
    return false;
  }
}

export async function notifyNearPin(title: string, body: string): Promise<boolean> {
  const N = await mod();
  if (!N) return false;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkNearPins(
  pos: Coords,
  pins: PinMarker[],
  alerted: string[],
  enabled: boolean,
): Promise<{ alerted: string[]; newly: PinMarker[] }> {
  if (!enabled) return { alerted, newly: [] };
  const next = [...alerted];
  const newly: PinMarker[] = [];
  for (const p of pins) {
    if (next.includes(p.id)) continue;
    if (haversineM(pos, { lat: p.lat, lng: p.lng }) <= NEAR_M) {
      next.push(p.id);
      newly.push(p);
      await notifyNearPin("Knajpa na trasie", `${p.title} — jesteś w pobliżu`);
    }
  }
  return { alerted: next, newly };
}

import { Platform } from "react-native";

import { haversineM } from "@/src/lib/geo";
import { loadActiveRoute, saveActiveRoute } from "@/src/lib/routeStore";

export const ROUTE_BG_TASK = "yummeet-route-bg";
const NEAR_M = 200;

/** Must run at module load (Expo TaskManager requirement). */
try {
  if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
    if (!TaskManager.isTaskDefined(ROUTE_BG_TASK)) {
      TaskManager.defineTask(ROUTE_BG_TASK, async ({ data, error }: { data?: { locations?: { coords: { latitude: number; longitude: number } }[] }; error?: Error }) => {
        if (error || !data?.locations?.length) return;
        const last = data.locations[data.locations.length - 1];
        const route = await loadActiveRoute();
        if (!route?.tracking || !route.notifyEnabled) return;
        const pos = { lat: last.coords.latitude, lng: last.coords.longitude };
        let changed = false;
        const alerted = [...route.alertedPinIds];
        for (const p of route.pins) {
          if (alerted.includes(p.id)) continue;
          if (haversineM(pos, { lat: p.lat, lng: p.lng }) <= NEAR_M) {
            alerted.push(p.id);
            changed = true;
            try {
              const { notifyNearPin } = await import("@/src/lib/routeNotify");
              await notifyNearPin("Knajpa na trasie", `${p.title} — jesteś w pobliżu`);
            } catch { /* ignore */ }
          }
        }
        if (changed) await saveActiveRoute({ ...route, alertedPinIds: alerted });
      });
    }
  }
} catch {
  /* package missing / web */
}

export async function startRouteBackground(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const Location = await import("expo-location");
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return false;
    const started = await Location.hasStartedLocationUpdatesAsync(ROUTE_BG_TASK).catch(() => false);
    if (!started) {
      await Location.startLocationUpdatesAsync(ROUTE_BG_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 40,
        timeInterval: 15000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Gastro-Trasa",
          notificationBody: "Śledzenie trasy w tle",
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function stopRouteBackground(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Location = await import("expo-location");
    const started = await Location.hasStartedLocationUpdatesAsync(ROUTE_BG_TASK).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(ROUTE_BG_TASK);
  } catch { /* ignore */ }
}

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActiveRoute } from "@/src/lib/routeTypes";

const KEY = "yummeet.activeRoute.v1";

export async function loadActiveRoute(): Promise<ActiveRoute | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveRoute;
  } catch {
    return null;
  }
}

export async function saveActiveRoute(route: ActiveRoute): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(route));
  } catch {
    /* ignore */
  }
}

export async function clearActiveRoute(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

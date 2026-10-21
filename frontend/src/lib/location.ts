import * as Location from "expo-location";

export type Coords = { lat: number; lng: number; heading?: number | null };

async function ensureForeground(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  const perm = cur.granted ? cur : cur.canAskAgain ? await Location.requestForegroundPermissionsAsync() : cur;
  return perm.granted;
}

export async function getCurrentPosition(): Promise<Coords | null> {
  try {
    if (!(await ensureForeground())) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading };
  } catch {
    return null;
  }
}

/** Watch GPS for route tracking. Returns remove() or null if permission denied. */
export async function watchPosition(
  onUpdate: (c: Coords) => void,
  opts?: { distanceInterval?: number; timeInterval?: number },
): Promise<(() => void) | null> {
  try {
    if (!(await ensureForeground())) return null;
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: opts?.distanceInterval ?? 15,
        timeInterval: opts?.timeInterval ?? 4000,
      },
      (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading }),
    );
    return () => sub.remove();
  } catch {
    return null;
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "yummeet.scanned-events";

export async function rememberScannedEvent(eventId: string) {
  const raw = await AsyncStorage.getItem(KEY);
  const ids = new Set<string>(raw ? JSON.parse(raw) as string[] : []);
  ids.add(eventId);
  await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
}

export async function hasScannedEvent(eventId: string) {
  const raw = await AsyncStorage.getItem(KEY);
  const ids = raw ? JSON.parse(raw) as string[] : [];
  return ids.includes(eventId);
}

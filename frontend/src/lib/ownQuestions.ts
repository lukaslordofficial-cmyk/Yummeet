import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "yummeet.own-questions";

/** Własne pytania zostają na tym telefonie. Nie wchodzą do wspólnej bazy Yummeet. */
export async function loadOwnQuestions(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === "string" && q.trim().length >= 5).slice(0, 40) : [];
  } catch {
    return [];
  }
}

export async function rememberOwnQuestion(title: string): Promise<string[]> {
  const clean = title.trim().slice(0, 200);
  const current = await loadOwnQuestions();
  if (clean.length < 5) return current;
  const next = [clean, ...current.filter((q) => q !== clean)].slice(0, 40);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

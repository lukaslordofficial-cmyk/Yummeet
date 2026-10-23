import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";

const LOCAL_KEY = "yummeet.saved-find-prompts";
const KIND = "find_prompt";

function cleanLine(body: string) {
  return body.trim().slice(0, 500);
}

async function readLocal(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((line) => typeof line === "string" && cleanLine(line).length >= 5).map((line) => cleanLine(line)).slice(-40) : [];
  } catch {
    return [];
  }
}

async function writeLocal(lines: string[]) {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(lines.slice(-40)));
}

async function accountId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Zdania „Znajdź kogoś” zapisane na koncie, którym użytkownik się loguje. Najnowsze na końcu. */
export async function loadSavedFindPrompts(): Promise<string[]> {
  const local = await readLocal();
  const userId = await accountId();
  if (!userId) return local;
  try {
    const { data, error } = await supabase
      .from("user_saved_lines")
      .select("body")
      .eq("user_id", userId)
      .eq("kind", KIND)
      .order("created_at", { ascending: true });
    if (error) return local;
    const remote = (data ?? []).map((row) => cleanLine(String(row.body ?? ""))).filter((line) => line.length >= 5);
    const extras = local.filter((line) => !remote.includes(line));
    for (const body of extras) {
      const { error: insertError } = await supabase.from("user_saved_lines").insert({ user_id: userId, kind: KIND, body });
      if (insertError) break;
    }
    const rows = [...remote, ...extras].slice(-40);
    await writeLocal(rows);
    return rows;
  } catch {
    return local;
  }
}

export async function rememberSavedFindPrompt(body: string): Promise<string[]> {
  const clean = cleanLine(body);
  const current = await loadSavedFindPrompts();
  if (clean.length < 5) return current;
  const next = [...current.filter((line) => line !== clean), clean].slice(-40);
  await writeLocal(next);
  const userId = await accountId();
  if (!userId) return next;
  try {
    await supabase.from("user_saved_lines").delete().eq("user_id", userId).eq("kind", KIND).eq("body", clean);
    const { error } = await supabase.from("user_saved_lines").insert({ user_id: userId, kind: KIND, body: clean });
    if (error) return next;
  } catch {
    /* tabela albo sieć — zostaje kopia na telefonie */
  }
  return next;
}

export async function forgetSavedFindPrompt(body: string): Promise<string[]> {
  const clean = cleanLine(body);
  const next = (await readLocal()).filter((line) => line !== clean);
  await writeLocal(next);
  const userId = await accountId();
  if (!userId) return next;
  try {
    await supabase.from("user_saved_lines").delete().eq("user_id", userId).eq("kind", KIND).eq("body", clean);
  } catch {
    /* zostaje usunięte lokalnie */
  }
  return (await loadSavedFindPrompts().catch(() => next));
}

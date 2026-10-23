import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";

export type SavedKind = "find_prompt" | "question" | "story_starter";

export type SavedLine = { label: string; body: string };

const LOCAL_KEY = "yummeet.saved-lines";
const LEGACY_QUESTIONS = "yummeet.own-questions";
const LEGACY_FIND = "yummeet.saved-find-prompts";

function cleanBody(body: string) {
  return body.trim().slice(0, 2000);
}

function cleanLabel(label: string) {
  return label.trim().slice(0, 80);
}

async function readBag(): Promise<Record<SavedKind, SavedLine[]>> {
  const empty = { find_prompt: [], question: [], story_starter: [] };
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    for (const kind of Object.keys(empty) as SavedKind[]) {
      const rows = Array.isArray(parsed?.[kind]) ? parsed[kind] : [];
      empty[kind] = rows
        .map((row: { label?: string; body?: string }) => ({ label: cleanLabel(String(row?.label ?? "")), body: cleanBody(String(row?.body ?? "")) }))
        .filter((row: SavedLine) => row.body.length >= 5)
        .slice(0, 40);
    }
  } catch {
    /* pusta kopia */
  }
  return empty;
}

async function writeBag(bag: Record<SavedKind, SavedLine[]>) {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(bag));
}

async function legacyLines(): Promise<Partial<Record<SavedKind, SavedLine[]>>> {
  const extra: Partial<Record<SavedKind, SavedLine[]>> = {};
  try {
    const questions = await AsyncStorage.getItem(LEGACY_QUESTIONS);
    const parsedQ = questions ? JSON.parse(questions) : [];
    if (Array.isArray(parsedQ)) {
      extra.question = parsedQ.filter((line) => typeof line === "string").map((line) => ({ label: "", body: cleanBody(line) })).filter((row) => row.body.length >= 5);
    }
  } catch { /* brak starej listy */ }
  try {
    const prompts = await AsyncStorage.getItem(LEGACY_FIND);
    const parsedP = prompts ? JSON.parse(prompts) : [];
    if (Array.isArray(parsedP)) {
      extra.find_prompt = parsedP.filter((line) => typeof line === "string").map((line) => ({ label: "", body: cleanBody(line) })).filter((row) => row.body.length >= 5);
    }
  } catch { /* brak starej listy */ }
  return extra;
}

async function accountId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function mergeFront(current: SavedLine[], incoming: SavedLine[]) {
  const next = [...current];
  for (const row of incoming) {
    if (!next.some((item) => item.body === row.body && item.label === row.label)) next.unshift(row);
  }
  return next.slice(0, 40);
}

/** Własne zdania na koncie logowania. Najnowsze są na początku listy. */
export async function loadSavedLines(kind: SavedKind): Promise<SavedLine[]> {
  const bag = await readBag();
  const legacy = await legacyLines();
  bag[kind] = mergeFront(bag[kind], legacy[kind] ?? []);
  await writeBag(bag);
  const userId = await accountId();
  if (!userId) return bag[kind];
  try {
    const { data, error } = await supabase
      .from("user_saved_lines")
      .select("label, body")
      .eq("user_id", userId)
      .eq("kind", kind)
      .order("created_at", { ascending: false });
    if (error) return bag[kind];
    const remote = (data ?? [])
      .map((row) => ({ label: cleanLabel(String(row.label ?? "")), body: cleanBody(String(row.body ?? "")) }))
      .filter((row) => row.body.length >= 5);
    const extras = bag[kind].filter((row) => !remote.some((item) => item.body === row.body));
    for (const row of extras) {
      const { error: insertError } = await supabase.from("user_saved_lines").insert({ user_id: userId, kind, body: row.body, label: row.label });
      if (insertError) break;
    }
    const rows = mergeFront(remote, extras);
    bag[kind] = rows;
    await writeBag(bag);
    return rows;
  } catch {
    return bag[kind];
  }
}

export async function rememberSavedLine(kind: SavedKind, body: string, label = ""): Promise<SavedLine[]> {
  const clean = cleanBody(body);
  const name = cleanLabel(label);
  const current = await loadSavedLines(kind);
  if (clean.length < 5) return current;
  const next = [{ label: name, body: clean }, ...current.filter((row) => row.body !== clean)].slice(0, 40);
  const bag = await readBag();
  bag[kind] = next;
  await writeBag(bag);
  const userId = await accountId();
  if (!userId) return next;
  try {
    await supabase.from("user_saved_lines").delete().eq("user_id", userId).eq("kind", kind).eq("body", clean);
    const { error } = await supabase.from("user_saved_lines").insert({ user_id: userId, kind, body: clean, label: name });
    if (error) return next;
  } catch {
    /* zostaje kopia na telefonie */
  }
  return next;
}

export async function forgetSavedLine(kind: SavedKind, body: string): Promise<SavedLine[]> {
  const clean = cleanBody(body);
  const bag = await readBag();
  bag[kind] = bag[kind].filter((row) => row.body !== clean);
  await writeBag(bag);
  const userId = await accountId();
  if (!userId) return bag[kind];
  try {
    await supabase.from("user_saved_lines").delete().eq("user_id", userId).eq("kind", kind).eq("body", clean);
  } catch {
    /* zostaje usunięte lokalnie */
  }
  return bag[kind];
}

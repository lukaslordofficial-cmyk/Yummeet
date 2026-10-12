import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { storage } from "@/src/utils/storage";

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

if (!url || !anonKey) {
  throw new Error(
    "Brak EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY w frontend/.env (oba z tego samego projektu Supabase).",
  );
}

// Session JSON exceeds SecureStore's 2 KB limit, so it lives in the general KV store.
const authStorage = {
  getItem: (key: string) => storage.getItem<string | null>(key, null) as Promise<string | null>,
  setItem: async (key: string, value: string) => { await storage.setItem(key, value); },
  removeItem: async (key: string) => { await storage.removeItem(key); },
};

export const supabase = createClient(url, anonKey, {
  auth: { storage: authStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (saves battery + requests).
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

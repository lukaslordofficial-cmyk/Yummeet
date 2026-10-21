import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState } from "react-native";

import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "@/src/lib/publicEnv";
import { storage } from "@/src/utils/storage";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const url = (
  PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  extra.supabaseUrl ||
  ""
).trim();
const anonKey = (
  PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra.supabaseAnonKey ||
  ""
).trim();

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error(
    "Brak konfiguracji Supabase — wygeneruj src/lib/publicEnv.ts z frontend/.env i przebuduj APK.",
  );
}

// Session JSON exceeds SecureStore's 2 KB limit, so it lives in the general KV store.
const authStorage = {
  getItem: (key: string) => storage.getItem<string | null>(key, null) as Promise<string | null>,
  setItem: async (key: string, value: string) => { await storage.setItem(key, value); },
  removeItem: async (key: string) => { await storage.removeItem(key); },
};

export const supabase = createClient(url || "https://invalid.local", anonKey || "invalid", {
  auth: { storage: authStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (saves battery + requests).
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

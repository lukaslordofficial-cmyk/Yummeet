import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { supabase } from "./supabase";

type PgFilter = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema?: string;
  table: string;
  filter?: string;
};

/**
 * Safe postgres_changes subscription.
 * Realtime may be unavailable (publication not enabled / API key / Strict Mode race) —
 * never throw into the UI; screens keep working via polling/reload.
 */
export function subscribePostgres<T extends Record<string, unknown> = Record<string, unknown>>(
  topic: string,
  filter: PgFilter,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
): () => void {
  const name = `${topic}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  let ch: RealtimeChannel | null = null;
  try {
    ch = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: filter.event, schema: filter.schema ?? "public", table: filter.table, filter: filter.filter },
        (payload) => onChange(payload as RealtimePostgresChangesPayload<T>),
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[realtime] ${topic}:`, status, err?.message ?? err);
        }
      });
  } catch (e) {
    console.warn(`[realtime] ${topic} unavailable:`, e);
    ch = null;
  }
  return () => {
    if (ch) void supabase.removeChannel(ch);
  };
}

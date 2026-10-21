import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useToast } from "@/src/components/ui";
import { presencePing } from "@/src/lib/data";

const PING_MS = 30000;

/** Proximity duels: pings position ONLY while duel mode is on, permission granted and the app is in the foreground. */
export function useDuelPresence(enabled: boolean) {
  const router = useRouter();
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const opened = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      if (AppState.currentState !== "active") return;
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos.mocked) return;
        const res = await presencePing(pos.coords.latitude, pos.coords.longitude);
        const duelId = res?.duels?.[0];
        const convId = res?.conversations?.[0];
        if (!duelId || cancelled) return;
        if (opened.current.has(duelId)) return;
        opened.current.add(duelId);
        toast("Yummiteer w pobliżu — ustalcie szczegóły na czacie!", "success");
        if (convId) router.push(`/chat/${convId}`);
        else router.push(`/duel/${duelId}`);
      } catch {
        // network / location hiccups are ignored; next tick retries
      }
    };
    tick();
    timer.current = setInterval(tick, PING_MS);
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current); };
  }, [enabled, router, toast]);
}

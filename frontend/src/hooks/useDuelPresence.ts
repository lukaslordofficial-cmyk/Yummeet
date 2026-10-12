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

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      if (AppState.currentState !== "active") return;
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos.mocked) return; // Android reports mock locations: ignore them
        const res = await presencePing(pos.coords.latitude, pos.coords.longitude);
        const id = res?.duels?.[0];
        if (id && !cancelled) {
          toast("Yummiteer w pobliżu — wchodzisz w tryb pojedynku!", "success");
          router.push(`/duel/${id}`);
        }
      } catch {
        // network / location hiccups are ignored; next tick retries
      }
    };
    tick();
    timer.current = setInterval(tick, PING_MS);
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current); };
  }, [enabled, router, toast]);
}

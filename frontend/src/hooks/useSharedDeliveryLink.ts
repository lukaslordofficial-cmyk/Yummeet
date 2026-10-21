import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { detectDeliveryPlatform, extractHttpUrl, type DeliveryPlatform } from "@/src/lib/deliveryLinks";

type ShareTarget = DeliveryPlatform | "website";

function pickUrlFromShare(payloads: { value?: string; contentUri?: string | null }[]): string | null {
  for (const p of payloads) {
    for (const raw of [p.contentUri, p.value].filter(Boolean).map(String)) {
      const url = extractHttpUrl(raw) || (/^https?:\/\//i.test(raw.trim()) ? raw.trim() : null);
      if (url) return url;
    }
  }
  return null;
}

/**
 * Odbiera URL z systemowego Share Sheet (expo-sharing).
 * Działa w buildach z pluginem; w Expo Go / na web cicho nic nie robi.
 */
export function useSharedDeliveryLink(onLink: (url: string, target: ShareTarget) => void) {
  const handled = useRef(false);
  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;

  useEffect(() => {
    if (Platform.OS === "web") return;

    let alive = true;

    const run = async () => {
      if (!alive || handled.current) return;
      try {
        const Sharing = await import("expo-sharing");
        const raw = Sharing.getSharedPayloads?.() ?? [];
        let payloads: { value?: string; contentUri?: string | null }[] = raw;
        if (raw.length > 0) {
          try {
            const resolved = await Sharing.getResolvedSharedPayloadsAsync();
            if (resolved?.length) payloads = resolved;
          } catch {
            /* użyj raw */
          }
        }
        if (!payloads.length) return;
        const url = pickUrlFromShare(payloads);
        if (!url) return;
        handled.current = true;
        const platform = detectDeliveryPlatform(url);
        onLinkRef.current(url, platform ?? "website");
        try {
          Sharing.clearSharedPayloads();
        } catch {
          /* ignore */
        }
      } catch {
        /* brak natywnego share receive */
      }
    };

    void run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        handled.current = false;
        return;
      }
      void run();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
}

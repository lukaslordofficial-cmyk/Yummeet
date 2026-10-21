import { useCallback, useEffect, useRef, useState } from "react";

import { haversineM, type LatLng } from "@/src/lib/geo";
import { getCurrentPosition, watchPosition } from "@/src/lib/location";
import { startRouteBackground, stopRouteBackground } from "@/src/lib/routeBg";
import { checkNearPins, ensureNotifyPermission } from "@/src/lib/routeNotify";
import { maybeRerouteFrom } from "@/src/lib/routeReroute";
import { clearActiveRoute, loadActiveRoute, saveActiveRoute } from "@/src/lib/routeStore";
import type { ActiveRoute } from "@/src/lib/routeTypes";

export type NotifyToggleResult = { enabled: boolean; message: string };

export function useActiveRoute() {
  const [active, setActiveState] = useState<ActiveRoute | null>(null);
  const [userPos, setUserPos] = useState<(LatLng & { heading?: number | null }) | null>(null);
  const [liveFollow, setLiveFollow] = useState(0);
  const [rerouteTick, setRerouteTick] = useState(0);
  const lastPos = useRef<LatLng | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);
  const activeRef = useRef<ActiveRoute | null>(null);
  const onAlertRef = useRef<((title: string) => void) | null>(null);
  const onRerouteRef = useRef<(() => void) | null>(null);

  const persist = useCallback(async (next: ActiveRoute | null) => {
    activeRef.current = next;
    setActiveState(next);
    if (next) await saveActiveRoute(next);
    else await clearActiveRoute();
  }, []);

  const onTrack = useCallback(async (pos: LatLng) => {
    let cur = activeRef.current;
    if (!cur) return;
    let trackedM = cur.trackedM;
    if (lastPos.current) {
      const step = haversineM(lastPos.current, pos);
      if (step > 2 && step < 800) trackedM += step;
    }
    lastPos.current = pos;
    setUserPos(pos);
    setLiveFollow(Date.now());

    const rerouted = await maybeRerouteFrom(pos, { ...cur, trackedM });
    if (rerouted) {
      cur = rerouted;
      setRerouteTick((t) => t + 1);
      onRerouteRef.current?.();
    }

    const { alerted, newly } = await checkNearPins(pos, cur.pins, cur.alertedPinIds, cur.notifyEnabled);
    for (const p of newly) onAlertRef.current?.(p.title);

    const next = { ...cur, trackedM, alertedPinIds: alerted };
    activeRef.current = next;
    setActiveState(next);
    await saveActiveRoute(next);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await loadActiveRoute();
      if (!alive) return;
      if (r) {
        activeRef.current = r;
        setActiveState(r);
        if (r.tracking) {
          const remove = await watchPosition((p) => void onTrack(p), { distanceInterval: 12, timeInterval: 3000 });
          if (remove) {
            stopWatch.current?.();
            stopWatch.current = remove;
          }
          if (r.notifyEnabled) await startRouteBackground();
        }
      }
      const p = await getCurrentPosition();
      if (alive && p) setUserPos(p);
    })();
    return () => {
      alive = false;
      stopWatch.current?.();
      stopWatch.current = null;
    };
  }, [onTrack]);

  const startTracking = useCallback(async () => {
    const cur = activeRef.current;
    if (!cur || cur.line.length < 2) return false;
    const remove = await watchPosition((p) => void onTrack(p), { distanceInterval: 12, timeInterval: 3000 });
    if (!remove) return false;
    stopWatch.current?.();
    stopWatch.current = remove;
    lastPos.current = null;
    await persist({ ...cur, tracking: true, trackedM: 0, alertedPinIds: [] });
    if (cur.notifyEnabled) {
      await ensureNotifyPermission();
      await startRouteBackground();
    }
    return true;
  }, [onTrack, persist]);

  const setNotify = useCallback(async (enabled: boolean): Promise<NotifyToggleResult> => {
    const cur = activeRef.current;
    if (!cur) return { enabled: false, message: "Brak aktywnej trasy." };

    // Zawsze przełącz flagę w stanie (nie blokuj UI na uprawnieniach).
    await persist({ ...cur, notifyEnabled: enabled });

    if (!enabled) {
      await stopRouteBackground();
      return { enabled: false, message: "Powiadomienia wyłączone." };
    }

    const granted = await ensureNotifyPermission();
    if (cur.tracking || activeRef.current?.tracking) await startRouteBackground();

    if (granted) {
      return { enabled: true, message: "Powiadomienia włączone (z dźwiękiem)." };
    }
    return {
      enabled: true,
      message: "Włączone w trasie. Jeśli nie ma dźwięku systemowego — zezwól na powiadomienia w ustawieniach telefonu. Alerty w aplikacji działają przy śledzeniu.",
    };
  }, [persist]);

  const fromHereM = useCallback((pins: { id: string; lat: number; lng: number }[]) => {
    if (!userPos) return {} as Record<string, number>;
    const out: Record<string, number> = {};
    for (const p of pins) out[p.id] = haversineM(userPos, { lat: p.lat, lng: p.lng });
    return out;
  }, [userPos]);

  const setAlertHandler = useCallback((fn: ((title: string) => void) | null) => {
    onAlertRef.current = fn;
  }, []);
  const setRerouteHandler = useCallback((fn: (() => void) | null) => {
    onRerouteRef.current = fn;
  }, []);

  return {
    active,
    setActive: persist,
    userPos,
    liveFollow,
    rerouteTick,
    startTracking,
    setNotify,
    fromHereM,
    setAlertHandler,
    setRerouteHandler,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

import { haversineM, type LatLng } from "@/src/lib/geo";
import { getCurrentPosition, watchPosition } from "@/src/lib/location";
import { startRouteBackground, stopRouteBackground } from "@/src/lib/routeBg";
import { checkNearPins, ensureNotifyPermission } from "@/src/lib/routeNotify";
import { clearActiveRoute, loadActiveRoute, saveActiveRoute } from "@/src/lib/routeStore";
import type { ActiveRoute } from "@/src/lib/routeTypes";

export function useActiveRoute() {
  const [active, setActive] = useState<ActiveRoute | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [liveFollow, setLiveFollow] = useState(0);
  const lastPos = useRef<LatLng | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await loadActiveRoute();
      if (!alive) return;
      if (r) {
        setActive(r);
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
      // Zatrzymaj tylko foreground watch — tło (routeBg) zostaje, jeśli włączone.
      stopWatch.current?.();
      stopWatch.current = null;
    };
    // onTrack stabilne przez refy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (next: ActiveRoute | null) => {
    setActive(next);
    if (next) await saveActiveRoute(next);
    else await clearActiveRoute();
  }, []);

  const onTrack = useCallback(async (pos: LatLng) => {
    const cur = activeRef.current;
    if (!cur) return;
    let trackedM = cur.trackedM;
    if (lastPos.current) {
      const step = haversineM(lastPos.current, pos);
      if (step > 2 && step < 800) trackedM += step;
    }
    lastPos.current = pos;
    setUserPos(pos);
    setLiveFollow(Date.now());
    const alerted = await checkNearPins(pos, cur.pins, cur.alertedPinIds, cur.notifyEnabled);
    const next = { ...cur, trackedM, alertedPinIds: alerted };
    activeRef.current = next;
    setActive(next);
    await saveActiveRoute(next);
  }, []);

  const startTracking = useCallback(async () => {
    const cur = activeRef.current;
    if (!cur || cur.line.length < 2) return false;
    const remove = await watchPosition((p) => void onTrack(p), { distanceInterval: 12, timeInterval: 3000 });
    if (!remove) return false;
    stopWatch.current?.();
    stopWatch.current = remove;
    lastPos.current = null;
    const next = { ...cur, tracking: true, trackedM: 0, alertedPinIds: [] };
    await persist(next);
    if (next.notifyEnabled) {
      await ensureNotifyPermission();
      await startRouteBackground();
    }
    return true;
  }, [onTrack, persist]);

  const setNotify = useCallback(async (enabled: boolean) => {
    const cur = activeRef.current;
    if (!cur) return;
    if (enabled) {
      const ok = await ensureNotifyPermission();
      if (!ok) return;
    }
    const next = { ...cur, notifyEnabled: enabled };
    await persist(next);
    if (enabled && cur.tracking) await startRouteBackground();
    else if (!enabled) await stopRouteBackground();
  }, [persist]);

  const fromHereM = useCallback((pins: { id: string; lat: number; lng: number }[]) => {
    if (!userPos) return {} as Record<string, number>;
    const out: Record<string, number> = {};
    for (const p of pins) out[p.id] = haversineM(userPos, { lat: p.lat, lng: p.lng });
    return out;
  }, [userPos]);

  return {
    active, setActive: persist, userPos, liveFollow,
    startTracking, setNotify, fromHereM, stopWatch, lastPos,
  };
}

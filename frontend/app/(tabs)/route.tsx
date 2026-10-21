import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { RouteHistory } from "@/src/components/RouteHistory";
import { RoutePinProgress } from "@/src/components/RoutePinProgress";
import { RoutePointInput } from "@/src/components/RoutePointInput";
import { Body, Button, Chip, ChipRow, Title, useToast } from "@/src/components/ui";
import { useActiveRoute } from "@/src/hooks/useActiveRoute";
import { errorMessage } from "@/src/lib/api";
import { CUISINES, cuisinePinStyle } from "@/src/lib/cuisines";
import { myTravelRoutes, pinsAlongRoute, travelAddKm, travelRouteFinish } from "@/src/lib/data";
import { formatDuration, formatKm, simplify } from "@/src/lib/geo";
import { stopRouteBackground } from "@/src/lib/routeBg";
import { filterPinsNearUser } from "@/src/lib/routePinsFilter";
import { classifyRoutePins, userAlongRoute } from "@/src/lib/routeProgress";
import type { ActiveRoute, TravelRouteRow } from "@/src/lib/routeTypes";
import { routingProvider, type GeocodeResult, type TravelMode } from "@/src/lib/routing";
import { radius, spacing, useTheme } from "@/src/theme";

export default function RoutePlanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const {
    active, setActive, userPos, liveFollow, rerouteTick, startTracking, setNotify, fromHereM,
    setAlertHandler, setRerouteHandler,
  } = useActiveRoute();

  const [a, setA] = useState<GeocodeResult | null>(null);
  const [b, setB] = useState<GeocodeResult | null>(null);
  const [mode, setMode] = useState<TravelMode>("car");
  const [buffer, setBuffer] = useState(1000);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [routeFollow, setRouteFollow] = useState(0);
  const [history, setHistory] = useState<TravelRouteRow[]>([]);

  const line = active?.line ?? [];
  const pins = active?.pins ?? [];
  const tracking = !!active?.tracking;

  useEffect(() => {
    if (!active) return;
    setA(active.a); setB(active.b); setMode(active.mode);
    setBuffer(active.buffer); setCuisine(active.cuisine);
  }, [active?.id]);

  const loadHistory = useCallback(() => {
    myTravelRoutes().then(setHistory).catch(() => setHistory([]));
  }, []);
  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  useEffect(() => {
    setAlertHandler((title) => toast(`W pobliżu: ${title}`, "info"));
    setRerouteHandler(() => toast("Zjazd z trasy — przeliczam optymalną drogę do celu…", "info"));
    return () => { setAlertHandler(null); setRerouteHandler(null); };
  }, [setAlertHandler, setRerouteHandler, toast]);

  useEffect(() => {
    if (rerouteTick > 0) setRouteFollow(Date.now());
  }, [rerouteTick]);

  /** Korytarz API ≥ bufor „stąd”, potem filtr po dystansie od GPS. */
  const fetchPins = async (path: typeof line, buf: number, cui: string | null) => {
    const corridor = Math.max(buf, 2500);
    const raw = await pinsAlongRoute(path.map((p) => [p.lng, p.lat] as [number, number]), corridor, cui);
    return filterPinsNearUser(raw, userPos, buf);
  };

  const refreshPins = async (path: typeof line, buf: number, cui: string | null) => {
    if (path.length < 2 || !active) return;
    const nextPins = await fetchPins(path, buf, cui);
    await setActive({ ...active, pins: nextPins, buffer: buf, cuisine: cui });
  };

  const run = async () => {
    if (!a || !b) return toast("Wybierz punkt A i B", "error");
    setBusy(true);
    try {
      const r = await routingProvider().route([{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], mode);
      const simple = simplify(r.geometry, 400);
      const nextPins = await fetchPins(simple, buffer, cuisine);
      const draft: ActiveRoute = {
        id: `local-${Date.now()}`, a, b, mode, buffer, cuisine, line: simple,
        meta: { d: r.distanceM, t: r.durationS }, pins: nextPins,
        startedAt: new Date().toISOString(), tracking: false, notifyEnabled: false,
        trackedM: 0, alertedPinIds: [],
      };
      await setActive(draft);
      setRouteFollow(Date.now());
      toast("Trasa zapisana — wrócisz do niej, aż ją zamkniesz.", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    const ok = await startTracking();
    toast(ok ? "Start — trasa działa też po wyjściu z zakładki." : "Włącz GPS.", ok ? "success" : "info");
  };

  const endTrip = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await stopRouteBackground();
      const km = Math.round((active.trackedM / 1000) * 100) / 100;
      if (km >= 0.05) await travelAddKm(km).catch(() => null);
      await travelRouteFinish({
        title: `${active.a.title} → ${active.b.title}`,
        placeA: active.a.title, placeB: active.b.title,
        aLat: active.a.lat, aLng: active.a.lng, bLat: active.b.lat, bLng: active.b.lng,
        mode: active.mode, distanceM: active.meta?.d ?? 0, kmTracked: km,
        startedAt: active.startedAt, pinIds: active.pins.map((p) => p.id),
      });
      await setActive(null);
      loadHistory();
      toast("Trasa zamknięta i zapisana w historii.", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const visiblePins = useMemo(() => filterPinsNearUser(pins, userPos, buffer), [pins, userPos, buffer]);
  const along = userAlongRoute(userPos, line);
  const pinsStatus = useMemo(() => classifyRoutePins(visiblePins, along), [visiblePins, along]);
  const distMap = fromHereM(visiblePins);

  const markers = useMemo(() => {
    const pinMarks = pinsStatus.map((p) => {
      const style = cuisinePinStyle(p.cuisine);
      return {
        id: p.id, lat: p.lat, lng: p.lng, title: p.title,
        glyph: style.glyph,
        official: p.is_official,
        color: p.status === "passed" ? colors.muted : p.status === "next" ? style.color : colors.brandSecondary,
      };
    });
    return [
      ...(a ? [{ id: "A", lat: a.lat, lng: a.lng, label: "A", glyph: "A", color: colors.surfaceInverse }] : []),
      ...(b ? [{ id: "B", lat: b.lat, lng: b.lng, label: "B", glyph: "B", color: colors.surfaceInverse }] : []),
      ...(userPos ? [{ id: "me", lat: userPos.lat, lng: userPos.lng, label: "Ty", glyph: "📍", color: colors.success }] : []),
      ...pinMarks,
    ];
  }, [a, b, pinsStatus, userPos, colors]);

  return (
    <View testID="route-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.xs }}>
        <Title size={28} testID="route-title">Gastro-Trasa</Title>
        <Body muted testID="route-intro">Ustal trasę przejazdu i odkryj miejsca po drodze, w których mógłbyś zjeść.</Body>
      </View>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {active ? (
          <View style={{ marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, gap: spacing.sm }}>
            <Title size={16} testID="route-active-banner">Aktywna trasa: {active.a.title.split("—")[0].trim()} → {active.b.title.split("—")[0].trim()}</Title>
            <Body muted>Tryb GPS: przy zjeździe z trasy przelicza drogę do celu i odświeża piny. Trwa, aż zamkniesz.</Body>
            <Button
              testID="route-notify-toggle"
              title={active.notifyEnabled ? "Powiadomienia: ON" : "Powiadomienia: OFF"}
              variant={active.notifyEnabled ? "secondary" : "ghost"}
              onPress={() => {
                void setNotify(!active.notifyEnabled).then((r) => toast(r.message, r.enabled ? "success" : "info"));
              }}
            />
          </View>
        ) : null}

        {!tracking ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            <RoutePointInput testID="route-a" label="Punkt A (start)" value={a} onPick={setA} showMyLocation />
            <RoutePointInput testID="route-b" label="Punkt B (cel)" value={b} onPick={setB} />
          </View>
        ) : null}

        <ChipRow>
          {([["car", "Auto"], ["bike", "Rower"], ["foot", "Pieszo"]] as const).map(([k, l]) => (
            <Chip key={k} testID={`route-mode-${k}`} label={l} selected={mode === k} onPress={() => setMode(k)} />
          ))}
          {[500, 1000, 3000].map((m) => (
            <Chip key={m} testID={`route-buffer-${m}`} label={`≤${formatKm(m)} stąd`} selected={buffer === m} onPress={() => { setBuffer(m); if (active) void refreshPins(line, m, cuisine); }} color={colors.brandSecondary} />
          ))}
        </ChipRow>
        <Body muted style={{ paddingHorizontal: spacing.lg }}>Promień liczony od Twojej lokalizacji GPS (nie od linii trasy).</Body>
        <ChipRow testID="route-cuisine-chips">
          {CUISINES.map((c) => (
            <Chip key={c.label} testID={`route-cuisine-${c.key ?? "all"}`} label={`${cuisinePinStyle(c.key).glyph} ${c.label}`} selected={cuisine === c.key} onPress={() => { setCuisine(c.key); if (active) void refreshPins(line, buffer, c.key); }} />
          ))}
        </ChipRow>

        {!active ? (
          <Button testID="route-run-button" title="Wyznacz trasę" icon="map-marker-path" loading={busy} onPress={() => void run()} style={{ marginHorizontal: spacing.lg }} />
        ) : null}

        {line.length > 1 ? (
          <>
            <View style={{ height: 280, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden" }}>
              <AppMapView center={userPos ?? line[0]} polyline={line} markers={markers} fitBounds={!tracking} followCenterToken={tracking ? liveFollow : routeFollow} onMarkerPress={(id) => id.length > 2 && id !== "me" && router.push(`/pin/${id}`)} />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Title size={18} testID="route-summary">{active?.meta ? `${formatKm(active.meta.d)} · ${formatDuration(active.meta.t)} · ${visiblePins.length} lokali ≤${formatKm(buffer)} stąd` : ""}</Title>
              {tracking ? <Body testID="route-tracked-km">Przejechano: {(active!.trackedM / 1000).toFixed(2)} km</Body> : null}
              {!tracking ? <Button testID="route-start-button" title="Start — śledź trasę" icon="play" onPress={() => void onStart()} /> : null}
              <Button testID="route-end-button" title="Zamknij trasę i zapisz" icon="flag-checkered" variant="secondary" loading={busy} onPress={() => void endTrip()} />
              <RoutePinProgress pins={pinsStatus} fromHereM={distMap} onOpen={(id) => router.push(`/pin/${id}`)} />
            </View>
          </>
        ) : null}

        <RouteHistory rows={history} />
      </KeyboardAwareScrollView>
    </View>
  );
}

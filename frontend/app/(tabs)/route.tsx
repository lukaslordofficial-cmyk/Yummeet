import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RouteHistory } from "@/src/components/RouteHistory";
import { RouteMapPane, type RouteMapMode } from "@/src/components/RouteMapPane";
import { RoutePinProgress } from "@/src/components/RoutePinProgress";
import { RoutePointInput } from "@/src/components/RoutePointInput";
import { Body, Button, Chip, ChipRow, Title, useToast } from "@/src/components/ui";
import { useActiveRoute } from "@/src/hooks/useActiveRoute";
import { errorMessage } from "@/src/lib/api";
import { CUISINES, cuisinePinStyle } from "@/src/lib/cuisines";
import { myTravelRoutes, pinsAlongRoute, travelAddKm, travelRouteFinish } from "@/src/lib/data";
import { clampRouteBuffer, distanceToPolyline, filterPinsByPrice, formatDuration, formatKm, haversineM, simplify, type LatLng } from "@/src/lib/geo";
import { stopRouteBackground } from "@/src/lib/routeBg";
import { pinsNearestOnRoute } from "@/src/lib/routePinsFilter";
import { getCurrentPosition } from "@/src/lib/location";
import { labelRoutePins, userAlongRoute } from "@/src/lib/routeProgress";
import type { ActiveRoute, TravelRouteRow } from "@/src/lib/routeTypes";
import { routingProvider, type GeocodeResult, type TravelMode } from "@/src/lib/routing";
import { radius, spacing, useTheme } from "@/src/theme";

const PRICE_BANDS = [
  { key: "any", label: "Każda cena", min: null, max: null },
  { key: "low", label: "do 40 zł", min: null, max: 40 },
  { key: "mid", label: "40–80 zł", min: 40, max: 80 },
  { key: "high", label: "od 80 zł", min: 80, max: null },
] as const;

export default function RoutePlanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { height: windowH } = useWindowDimensions();
  const lastPinFetch = useRef<{ lat: number; lng: number } | null>(null);
  const {
    active, setActive, userPos, liveFollow, rerouteTick, startTracking, setNotify, fromHereM,
    setAlertHandler, setRerouteHandler,
  } = useActiveRoute();

  const [a, setA] = useState<GeocodeResult | null>(null);
  const [b, setB] = useState<GeocodeResult | null>(null);
  const [mode, setMode] = useState<TravelMode>("car");
  const [buffer, setBuffer] = useState(1000);
  const [mapMode, setMapMode] = useState<RouteMapMode>("window");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [priceKey, setPriceKey] = useState<(typeof PRICE_BANDS)[number]["key"]>("any");
  const [spot, setSpot] = useState<LatLng | null>(null);
  const [locateAt, setLocateAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [routeFollow, setRouteFollow] = useState(0);
  const [history, setHistory] = useState<TravelRouteRow[]>([]);

  const line = active?.line ?? [];
  const pins = active?.pins ?? [];
  const tracking = !!active?.tracking;

  useEffect(() => {
    if (!active) return;
    setA(active.a); setB(active.b); setMode(active.mode);
    setBuffer(clampRouteBuffer(active.buffer)); setCuisine(active.cuisine);
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

  /** Pas liczony od linii trasy. SQL zwraca najbliższe wobec GPS, lista i tak sortuje lokalnie. */
  const fetchPins = async (path: typeof line, buf: number, cui: string | null) => {
    const cap = clampRouteBuffer(buf);
    const raw = await pinsAlongRoute(path.map((p) => [p.lng, p.lat] as [number, number]), cap, cui, userPos);
    return pinsNearestOnRoute(raw, path, cap, userPos);
  };

  const refreshPins = async (path: typeof line, buf: number, cui: string | null) => {
    if (path.length < 2 || !active) return;
    const cap = clampRouteBuffer(buf);
    const nextPins = await fetchPins(path, cap, cui);
    await setActive({ ...active, pins: nextPins, buffer: cap, cuisine: cui });
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

  const visiblePins = useMemo(() => pinsNearestOnRoute(pins, line, buffer, userPos), [pins, line, buffer, userPos]);
  const along = userAlongRoute(userPos, line);
  const pinsStatus = useMemo(() => labelRoutePins(visiblePins, along), [visiblePins, along]);

  useEffect(() => {
    if (!tracking || !userPos || line.length < 2) return;
    const prev = lastPinFetch.current;
    if (prev && haversineM(prev, userPos) < 500) return;
    lastPinFetch.current = userPos;
    void refreshPins(line, buffer, cuisine);
  }, [tracking, userPos, line, buffer, cuisine]);
  const distMap = fromHereM(visiblePins);
  const alongRouteM = useMemo(() => {
    const out: Record<string, number> = {};
    if (line.length < 2) return out;
    for (const p of visiblePins) out[p.id] = distanceToPolyline(p, line).distanceM;
    return out;
  }, [visiblePins, line]);
  const fallbackCenter = line[Math.floor(line.length / 2)] ?? line[0] ?? { lat: 52.23, lng: 21.01 };
  const mapCenter = (tracking ? userPos : spot) ?? userPos ?? fallbackCenter;
  const priceBand = PRICE_BANDS.find((band) => band.key === priceKey) ?? PRICE_BANDS[0];
  const shownPins = useMemo(() => filterPinsByPrice(pinsStatus, priceBand), [pinsStatus, priceBand]);
  const recenter = async () => {
    const here = userPos ?? await getCurrentPosition();
    if (!here) return toast("Włącz GPS, żeby wrócić do swojej lokalizacji.", "info");
    setSpot({ lat: here.lat, lng: here.lng });
    setLocateAt(Date.now());
  };
  const openPin = useCallback((id: string) => {
    if (id.length > 2 && id !== "me") router.push(`/pin/${id}`);
  }, [router]);

  const markers = useMemo(() => {
    const pinMarks = shownPins.map((p) => {
      const style = cuisinePinStyle(p.cuisine);
      return {
        id: p.id, lat: p.lat, lng: p.lng, title: p.title,
        glyph: style.glyph,
        official: p.is_official,
        color: style.color,
      };
    });
    const heading = userPos?.heading;
    return [
      ...(a && !tracking ? [{ id: "A", lat: a.lat, lng: a.lng, label: "A", glyph: "A", color: colors.surfaceInverse }] : []),
      ...(b ? [{ id: "B", lat: b.lat, lng: b.lng, label: "B", glyph: "B", color: colors.surfaceInverse }] : []),
      ...(userPos ? [{
        id: "me",
        lat: userPos.lat,
        lng: userPos.lng,
        title: "Ty",
        color: "#1A73E8",
        ...(typeof heading === "number" && heading >= 0 ? { bearing: heading } : { glyph: "📍", label: "Ty" }),
      }] : []),
      ...(tracking ? pinMarks.slice(0, 24) : pinMarks),
    ];
  }, [a, b, shownPins, userPos, colors, tracking]);
  const filterOverlay = (
    <ChipRow testID="route-map-filters">
      {PRICE_BANDS.map((band) => (
        <Chip key={band.key} testID={`route-price-${band.key}`} label={band.label} selected={priceKey === band.key} onPress={() => setPriceKey(band.key)} />
      ))}
      {CUISINES.map((c) => (
        <Chip
          key={c.key ?? c.label}
          testID={`route-cuisine-${c.key ?? "all"}`}
          label={`${cuisinePinStyle(c.key).glyph} ${c.label}`}
          selected={cuisine === c.key}
          onPress={() => { const next = cuisine === c.key ? null : c.key; setCuisine(next); if (active) void refreshPins(line, buffer, next); }}
        />
      ))}
    </ChipRow>
  );
  const routeMap = (where: "flow" | "full") => (
    <RouteMapPane
      mode={where === "full" ? "full" : mapMode}
      onMode={setMapMode}
      tall={210}
      edgeToEdge={tracking || where === "full"}
      tracking={tracking}
      center={mapCenter}
      line={line}
      markers={markers}
      followToken={tracking ? liveFollow : 0}
      fitToken={routeFollow}
      locateToken={locateAt}
      onRecenter={() => void recenter()}
      onMarkerPress={openPin}
      windowHeight={windowH}
      topInset={insets.top}
      overlay={filterOverlay}
    />
  );

  return (
    <View testID="route-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.xs }}>
        <Title size={28} testID="route-title">Gastro-Trasa</Title>
        {line.length > 1 ? null : <Body muted testID="route-intro">Ustal trasę przejazdu i odkryj miejsca po drodze, w których mógłbyś zjeść.</Body>}
      </View>
      {line.length > 1 && mapMode !== "full" ? routeMap("flow") : null}
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
            <Chip key={m} testID={`route-buffer-${m}`} label={`≤${formatKm(m)} od trasy`} selected={buffer === m} onPress={() => { setBuffer(m); if (active) void refreshPins(line, m, cuisine); }} />
          ))}
        </ChipRow>
        <Body muted style={{ paddingHorizontal: spacing.lg }}>Pas wzdłuż trasy, najwyżej 3 km. Gdy jesteś na trasie, lista też nie sięga dalej niż wybrany dystans od Ciebie. 1. to najbliższy lokal.</Body>

        {!active ? (
          <Button testID="route-run-button" title="Wyznacz trasę" icon="map-marker-path" loading={busy} onPress={() => void run()} style={{ marginHorizontal: spacing.lg }} />
        ) : null}

        {line.length > 1 ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            <Title size={18} testID="route-summary">{active?.meta ? `${formatKm(active.meta.d)} · ${formatDuration(active.meta.t)} · ${shownPins.length} lokali w pasie ≤${formatKm(buffer)}` : ""}</Title>
            {tracking ? <Body testID="route-tracked-km">Przejechano: {(active!.trackedM / 1000).toFixed(2)} km</Body> : null}
            {!tracking ? <Button testID="route-start-button" title="Start — śledź trasę" icon="play" onPress={() => void onStart()} /> : null}
            <Button testID="route-end-button" title="Zamknij trasę i zapisz" icon="flag-checkered" variant="secondary" loading={busy} onPress={() => void endTrip()} />
            <RoutePinProgress pins={shownPins} fromHereM={distMap} alongRouteM={alongRouteM} onOpen={(id) => router.push(`/pin/${id}`)} />
          </View>
        ) : null}

        <RouteHistory rows={history} />
      </KeyboardAwareScrollView>
      {line.length > 1 && mapMode === "full" ? routeMap("full") : null}
    </View>
  );
}

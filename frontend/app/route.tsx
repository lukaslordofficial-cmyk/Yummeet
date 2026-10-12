import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { RoutePointInput } from "@/src/components/RoutePointInput";
import { Body, Button, Card, Chip, ChipRow, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
import { pinsAlongRoute, travelAddKm } from "@/src/lib/data";
import { formatDuration, formatKm, haversineM, simplify, type LatLng } from "@/src/lib/geo";
import { watchPosition } from "@/src/lib/location";
import { routingProvider, type GeocodeResult, type TravelMode } from "@/src/lib/routing";
import { radius, spacing, useTheme } from "@/src/theme";
import type { PinMarker } from "@/src/types";

const NEAR_PIN_M = 180;

export default function RoutePlanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [a, setA] = useState<GeocodeResult | null>(null);
  const [b, setB] = useState<GeocodeResult | null>(null);
  const [mode, setMode] = useState<TravelMode>("car");
  const [buffer, setBuffer] = useState(1000);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [line, setLine] = useState<LatLng[]>([]);
  const [meta, setMeta] = useState<{ d: number; t: number } | null>(null);
  const [pins, setPins] = useState<PinMarker[]>([]);
  const [busy, setBusy] = useState(false);
  const [routeFollow, setRouteFollow] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [trackedM, setTrackedM] = useState(0);
  const lastPos = useRef<LatLng | null>(null);
  const alerted = useRef<Set<string>>(new Set());
  const stopWatch = useRef<(() => void) | null>(null);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  useEffect(() => () => { stopWatch.current?.(); }, []);

  const run = async () => {
    if (!a || !b) return toast("Wybierz punkt A i B", "error");
    setBusy(true);
    try {
      const r = await routingProvider().route([{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], mode);
      const simple = simplify(r.geometry, 400);
      setLine(simple);
      setMeta({ d: r.distanceM, t: r.durationS });
      setPins(await pinsAlongRoute(simple.map((p) => [p.lng, p.lat] as [number, number]), buffer, cuisine));
      setRouteFollow(Date.now());
      alerted.current = new Set();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const onTrackPoint = (pos: LatLng) => {
    if (lastPos.current) {
      const step = haversineM(lastPos.current, pos);
      if (step > 2 && step < 800) setTrackedM((m) => m + step);
    }
    lastPos.current = pos;
    for (const p of pinsRef.current) {
      if (alerted.current.has(p.id)) continue;
      if (haversineM(pos, { lat: p.lat, lng: p.lng }) <= NEAR_PIN_M) {
        alerted.current.add(p.id);
        toast(`W pobliżu: ${p.title}`, "info");
      }
    }
  };

  const startTracking = async () => {
    if (line.length < 2) return toast("Najpierw wyznacz trasę", "info");
    const remove = await watchPosition(onTrackPoint, { distanceInterval: 12, timeInterval: 3000 });
    if (!remove) return toast("Włącz GPS, żeby monitorować trasę.", "info");
    stopWatch.current?.();
    stopWatch.current = remove;
    lastPos.current = null;
    setTrackedM(0);
    setTracking(true);
    toast("Start — monitoruję kilometry i lokale przy trasie.", "success");
  };

  const stopTracking = async () => {
    stopWatch.current?.();
    stopWatch.current = null;
    setTracking(false);
    const km = Math.round((trackedM / 1000) * 100) / 100;
    if (km < 0.05) return toast("Za krótki dystans, nic nie zapisano.", "info");
    setBusy(true);
    try {
      await travelAddKm(km);
      toast(`Zapisano ${km} km w zakładce Km podróży.`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const markers = useMemo(
    () => [
      ...(a ? [{ id: "A", lat: a.lat, lng: a.lng, label: "A", color: colors.surfaceInverse }] : []),
      ...(b ? [{ id: "B", lat: b.lat, lng: b.lng, label: "B", color: colors.surfaceInverse }] : []),
      ...pins.map((p, i) => ({
        id: p.id, lat: p.lat, lng: p.lng, title: p.title, label: p.title || String(i + 1),
        color: p.is_official ? colors.rarityLegendary : colors.brandPrimary, coverUrl: p.cover_url || undefined,
      })),
    ],
    [a, b, pins, colors],
  );

  return (
    <View testID="route-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Gastro-Trasa" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <RoutePointInput testID="route-a" label="Punkt A (start)" value={a} onPick={setA} showMyLocation />
          <RoutePointInput testID="route-b" label="Punkt B (cel)" value={b} onPick={setB} />
        </View>
        <ChipRow>
          {([["car", "Auto"], ["bike", "Rower"], ["foot", "Pieszo"]] as const).map(([k, l]) => (
            <Chip key={k} testID={`route-mode-${k}`} label={l} selected={mode === k} onPress={() => setMode(k)} />
          ))}
          {[500, 1000, 3000].map((m) => (
            <Chip key={m} testID={`route-buffer-${m}`} label={`±${formatKm(m)}`} selected={buffer === m} onPress={() => setBuffer(m)} color={colors.brandSecondary} />
          ))}
        </ChipRow>
        <ChipRow testID="route-cuisine-chips">
          {CUISINES.map((c) => (
            <Chip key={c.label} testID={`route-cuisine-${c.key ?? "all"}`} label={c.label} selected={cuisine === c.key} onPress={() => setCuisine(c.key)} />
          ))}
        </ChipRow>
        <Button testID="route-run-button" title="Wyznacz trasę" icon="map-marker-path" loading={busy} onPress={() => void run()} style={{ marginHorizontal: spacing.lg }} />
        {line.length > 1 ? (
          <>
            <View style={{ height: 300, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden" }}>
              <AppMapView center={line[0]} polyline={line} markers={markers} fitBounds followCenterToken={routeFollow} onMarkerPress={(id) => id.length > 2 && router.push(`/pin/${id}`)} />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Title size={18} testID="route-summary">{meta ? `${formatKm(meta.d)} · ${formatDuration(meta.t)} · ${pins.length} lokali przy trasie` : ""}</Title>
              {tracking ? <Body testID="route-tracked-km">Śledzę trasę: {(trackedM / 1000).toFixed(2)} km</Body> : null}
              {!tracking ? (
                <Button testID="route-start-button" title="Start — monitoruj km" icon="play" onPress={() => void startTracking()} />
              ) : (
                <Button testID="route-stop-button" title="Stop i zapisz km" icon="stop" variant="secondary" loading={busy} onPress={() => void stopTracking()} />
              )}
              {pins.map((p, i) => (
                <Card key={p.id} testID={`route-pin-${p.id}`} onPress={() => router.push(`/pin/${p.id}`)}>
                  <Title size={16}>{i + 1}. {p.title}</Title>
                  <Body muted>{CUISINES.find((c) => c.key === p.cuisine)?.label ?? p.cuisine ?? "lokal"} · {formatKm(p.distance_m ?? 0)} od trasy</Body>
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

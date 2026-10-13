import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { RoutePinProgress } from "@/src/components/RoutePinProgress";
import { RoutePointInput } from "@/src/components/RoutePointInput";
import { Body, Button, Chip, ChipRow, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
import { pinsAlongRoute, travelAddKm } from "@/src/lib/data";
import { formatDuration, formatKm, haversineM, simplify, type LatLng } from "@/src/lib/geo";
import { watchPosition } from "@/src/lib/location";
import { classifyRoutePins, userAlongRoute } from "@/src/lib/routeProgress";
import { routingProvider, type GeocodeResult, type TravelMode } from "@/src/lib/routing";
import { radius, spacing, useTheme } from "@/src/theme";
import type { PinMarker } from "@/src/types";

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
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [liveFollow, setLiveFollow] = useState(0);
  const lastPos = useRef<LatLng | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  useEffect(() => () => { stopWatch.current?.(); }, []);

  const refreshPins = useCallback(async (path: LatLng[], buf: number, cui: string | null) => {
    if (path.length < 2) return;
    setPins(await pinsAlongRoute(path.map((p) => [p.lng, p.lat] as [number, number]), buf, cui));
  }, []);

  const run = async () => {
    if (!a || !b) return toast("Wybierz punkt A i B", "error");
    setBusy(true);
    try {
      const r = await routingProvider().route([{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], mode);
      const simple = simplify(r.geometry, 400);
      setLine(simple);
      setMeta({ d: r.distanceM, t: r.durationS });
      await refreshPins(simple, buffer, cuisine);
      setRouteFollow(Date.now());
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  /** Filtr kuchni / bufor — też w trakcie jazdy (bez ponownego routingu). */
  const onCuisine = async (key: string | null) => {
    setCuisine(key);
    if (line.length < 2) return;
    setBusy(true);
    try {
      await refreshPins(line, buffer, key);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const onBuffer = async (m: number) => {
    setBuffer(m);
    if (line.length < 2) return;
    setBusy(true);
    try {
      await refreshPins(line, m, cuisine);
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
    setUserPos(pos);
    setLiveFollow(Date.now());
  };

  const startTracking = async () => {
    if (line.length < 2) return toast("Najpierw wyznacz trasę", "info");
    const remove = await watchPosition(onTrackPoint, { distanceInterval: 12, timeInterval: 3000 });
    if (!remove) return toast("Włącz GPS, żeby monitorować trasę.", "info");
    stopWatch.current?.();
    stopWatch.current = remove;
    lastPos.current = null;
    setTrackedM(0);
    setUserPos(null);
    setTracking(true);
    toast("Start — śledzę postęp wzdłuż lokali (bez powiadomień).", "success");
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

  const along = userAlongRoute(userPos, line);
  const pinsStatus = useMemo(() => classifyRoutePins(pins, along), [pins, along]);

  const markers = useMemo(() => {
    const pinMarks = pinsStatus.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      title: p.title,
      label: p.status === "next" ? "●" : String(p.index + 1),
      color:
        p.status === "passed"
          ? colors.muted
          : p.status === "next"
            ? colors.brandPrimary
            : p.is_official
              ? colors.rarityLegendary
              : colors.brandSecondary,
      coverUrl: p.status === "passed" ? undefined : p.cover_url || undefined,
    }));
    return [
      ...(a ? [{ id: "A", lat: a.lat, lng: a.lng, label: "A", color: colors.surfaceInverse }] : []),
      ...(b ? [{ id: "B", lat: b.lat, lng: b.lng, label: "B", color: colors.surfaceInverse }] : []),
      ...(userPos ? [{ id: "me", lat: userPos.lat, lng: userPos.lng, label: "Ty", color: colors.success }] : []),
      ...pinMarks,
    ];
  }, [a, b, pinsStatus, userPos, colors]);

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
            <Chip key={m} testID={`route-buffer-${m}`} label={`±${formatKm(m)}`} selected={buffer === m} onPress={() => void onBuffer(m)} color={colors.brandSecondary} />
          ))}
        </ChipRow>
        <ChipRow testID="route-cuisine-chips">
          {CUISINES.map((c) => (
            <Chip key={c.label} testID={`route-cuisine-${c.key ?? "all"}`} label={c.label} selected={cuisine === c.key} onPress={() => void onCuisine(c.key)} />
          ))}
        </ChipRow>
        {line.length > 1 ? <Body muted style={{ paddingHorizontal: spacing.lg }}>Kuchnię i odległość możesz zmieniać także w trakcie jazdy.</Body> : null}
        <Button testID="route-run-button" title="Wyznacz trasę" icon="map-marker-path" loading={busy} onPress={() => void run()} style={{ marginHorizontal: spacing.lg }} />
        {line.length > 1 ? (
          <>
            <View style={{ height: 300, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden" }}>
              <AppMapView center={userPos ?? line[0]} polyline={line} markers={markers} fitBounds={!tracking} followCenterToken={tracking ? liveFollow : routeFollow} onMarkerPress={(id) => id.length > 2 && id !== "me" && router.push(`/pin/${id}`)} />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Title size={18} testID="route-summary">{meta ? `${formatKm(meta.d)} · ${formatDuration(meta.t)} · ${pins.length} lokali` : ""}</Title>
              {tracking ? <Body testID="route-tracked-km">Przejechano: {(trackedM / 1000).toFixed(2)} km</Body> : null}
              {!tracking ? (
                <Button testID="route-start-button" title="Start — śledź postęp" icon="play" onPress={() => void startTracking()} />
              ) : (
                <Button testID="route-stop-button" title="Stop i zapisz km" icon="stop" variant="secondary" loading={busy} onPress={() => void stopTracking()} />
              )}
              <RoutePinProgress pins={pinsStatus} onOpen={(id) => router.push(`/pin/${id}`)} />
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Card, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
import { pinsAlongRoute, travelAddKm } from "@/src/lib/data";
import { formatDuration, formatKm, haversineM, simplify, type LatLng } from "@/src/lib/geo";
import { getCurrentPosition, watchPosition } from "@/src/lib/location";
import { geocode, reverseGeocode, routingProvider, type GeocodeResult, type TravelMode } from "@/src/lib/routing";
import { radius, spacing, useTheme } from "@/src/theme";
import type { PinMarker } from "@/src/types";

const NEAR_PIN_M = 180;

function PointInput({
  label,
  value,
  onPick,
  testID,
  showMyLocation,
}: {
  label: string;
  value: GeocodeResult | null;
  onPick: (g: GeocodeResult) => void;
  testID: string;
  showMyLocation?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [pickLabel, setPickLabel] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const req = useRef(0);

  useEffect(() => {
    if (value) setQ(value.title);
  }, [value]);

  const search = async (query: string) => {
    const id = ++req.current;
    setBusy(true);
    try {
      const hits = await geocode(query, "pl");
      if (id === req.current) setResults(hits);
    } catch {
      if (id === req.current) setResults([]);
    } finally {
      if (id === req.current) setBusy(false);
    }
  };

  const onChangeText = (text: string) => {
    setQ(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(() => void search(text), 400);
  };

  const useGps = async () => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) return toast("Włącz lokalizację GPS w ustawieniach telefonu.", "info");
      const rev = await reverseGeocode(pos.lat, pos.lng, "pl");
      const g: GeocodeResult = rev ?? { title: "Moja lokalizacja", lat: pos.lat, lng: pos.lng };
      onPick({ ...g, title: g.title || "Moja lokalizacja" });
      setResults([]);
      setQ(g.title || "Moja lokalizacja");
    } finally {
      setBusy(false);
    }
  };

  const confirmPick = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      const rev = await reverseGeocode(pick.lat, pick.lng, "pl");
      const g = rev ?? { title: `${pick.lat.toFixed(5)}, ${pick.lng.toFixed(5)}`, ...pick };
      onPick(g);
      setQ(g.title);
      setResults([]);
      setMapOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const onMapPress = async (lat: number, lng: number) => {
    setPick({ lat, lng });
    setPickLabel("…");
    try {
      const rev = await reverseGeocode(lat, lng, "pl");
      setPickLabel(rev?.title ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setPickLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            testID={`${testID}-input`}
            label={label}
            value={q}
            onChangeText={onChangeText}
            placeholder="np. Warszawa Dworzec PKP"
            onSubmitEditing={() => void search(q)}
            returnKeyType="search"
          />
        </View>
        <Button testID={`${testID}-map`} title="Mapa" variant="ghost" onPress={() => { setPick(value ? { lat: value.lat, lng: value.lng } : { lat: 52.23, lng: 21.01 }); setPickLabel(value?.title ?? null); setMapOpen(true); }} />
      </View>
      {showMyLocation ? (
        <Button testID={`${testID}-gps`} title="Moja lokalizacja" icon="crosshairs-gps" variant="ghost" loading={busy} onPress={() => void useGps()} />
      ) : null}
      {value ? (
        <Body muted numberOfLines={2} testID={`${testID}-selected`}>
          ✓ {value.title}{`\n`}📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </Body>
      ) : null}
      {busy && !mapOpen ? <Body muted>Szukam adresów i obiektów…</Body> : null}
      {results.map((r, i) => (
        <Card
          key={`${r.lat}-${r.lng}-${i}`}
          testID={`${testID}-result-${i}`}
          onPress={() => {
            onPick(r);
            setResults([]);
            setQ(r.title);
          }}
        >
          <Body numberOfLines={3}>{r.title}</Body>
          <Body muted>{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</Body>
        </Card>
      ))}

      <Modal visible={mapOpen} animationType="slide" onRequestClose={() => setMapOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
          <Header title="Wybierz na mapie" right={<Button testID={`${testID}-map-close`} title="Zamknij" variant="ghost" onPress={() => setMapOpen(false)} />} />
          <View style={{ flex: 1 }}>
            <AppMapView
              center={pick ?? { lat: 52.23, lng: 21.01 }}
              zoom={pick ? 14 : 6}
              pickMode
              fitBounds={false}
              followCenterToken={mapOpen ? 1 : 0}
              onMapPress={(lat, lng) => void onMapPress(lat, lng)}
            />
          </View>
          <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Body numberOfLines={3}>{pickLabel ?? "Stuknij mapę, żeby wybrać punkt"}</Body>
            {pick ? <Body muted>📍 {pick.lat.toFixed(5)}, {pick.lng.toFixed(5)}</Body> : null}
            <Button testID={`${testID}-map-confirm`} title="Potwierdź to miejsce" disabled={!pick} loading={busy} onPress={() => void confirmPick()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
    if (km < 0.05) {
      toast("Za krótki dystans, nic nie zapisano.", "info");
      return;
    }
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
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        title: p.title,
        label: p.title || String(i + 1),
        color: p.is_official ? colors.rarityLegendary : colors.brandPrimary,
        coverUrl: p.cover_url || undefined,
      })),
    ],
    [a, b, pins, colors],
  );

  return (
    <View testID="route-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Gastro-Trasa" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <PointInput testID="route-a" label="Punkt A (start)" value={a} onPick={setA} showMyLocation />
          <PointInput testID="route-b" label="Punkt B (cel)" value={b} onPick={setB} />
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
              <AppMapView
                center={line[0]}
                polyline={line}
                markers={markers}
                fitBounds
                followCenterToken={routeFollow}
                onMarkerPress={(id) => id.length > 2 && router.push(`/pin/${id}`)}
              />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Title size={18} testID="route-summary">
                {meta ? `${formatKm(meta.d)} · ${formatDuration(meta.t)} · ${pins.length} lokali przy trasie` : ""}
              </Title>
              {tracking ? (
                <Body testID="route-tracked-km">Śledzę trasę: {(trackedM / 1000).toFixed(2)} km</Body>
              ) : null}
              {!tracking ? (
                <Button testID="route-start-button" title="Start — monitoruj km" icon="play" onPress={() => void startTracking()} />
              ) : (
                <Button testID="route-stop-button" title="Stop i zapisz km" icon="stop" variant="secondary" loading={busy} onPress={() => void stopTracking()} />
              )}
              {pins.map((p, i) => (
                <Card key={p.id} testID={`route-pin-${p.id}`} onPress={() => router.push(`/pin/${p.id}`)}>
                  <Title size={16}>{i + 1}. {p.title}</Title>
                  <Body muted>
                    {CUISINES.find((c) => c.key === p.cuisine)?.label ?? p.cuisine ?? "lokal"} · {formatKm(p.distance_m ?? 0)} od trasy
                    {p.score ? ` · Score ${p.score} (${p.review_count})` : ""}
                  </Body>
                  <Body muted>📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Body>
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

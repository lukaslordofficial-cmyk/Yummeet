import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Card, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
import { pinsAlongRoute } from "@/src/lib/data";
import { formatDuration, formatKm, simplify, type LatLng } from "@/src/lib/geo";
import { getCurrentPosition } from "@/src/lib/location";
import { geocode, routingProvider, type GeocodeResult, type TravelMode } from "@/src/lib/routing";
import { radius, spacing, useTheme } from "@/src/theme";
import type { PinMarker } from "@/src/types";

function shortTitle(s: string) {
  return s.split(",").slice(0, 2).join(",").trim();
}

function PointInput({
  label, value, onPick, testID,
}: {
  label: string;
  value: GeocodeResult | null;
  onPick: (g: GeocodeResult) => void;
  testID: string;
}) {
  const toast = useToast();
  const [q, setQ] = useState(value?.title ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const req = useRef(0);

  useEffect(() => {
    if (value) setQ(shortTitle(value.title));
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
    debounce.current = setTimeout(() => void search(text), 450);
  };

  const useGps = async () => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) return toast("Włącz lokalizację GPS w ustawieniach telefonu.", "info");
      onPick({ title: "Moja lokalizacja", lat: pos.lat, lng: pos.lng });
      setResults([]);
      setQ("Moja lokalizacja");
    } finally {
      setBusy(false);
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
            placeholder="np. Warszawa Centralna"
            onSubmitEditing={() => void search(q)}
            returnKeyType="search"
          />
        </View>
        <Button testID={`${testID}-search`} title={busy ? "…" : "Szukaj"} variant="ghost" onPress={() => void search(q)} />
      </View>
      <Button testID={`${testID}-gps`} title="Użyj GPS" icon="crosshairs-gps" variant="ghost" onPress={() => void useGps()} />
      {value ? <Body muted numberOfLines={1} testID={`${testID}-selected`}>✓ {shortTitle(value.title)}</Body> : null}
      {results.map((r, i) => (
        <Card
          key={`${r.lat}-${r.lng}-${i}`}
          testID={`${testID}-result-${i}`}
          onPress={() => {
            onPick({ ...r, title: shortTitle(r.title) });
            setResults([]);
            setQ(shortTitle(r.title));
          }}
        >
          <Body numberOfLines={2}>{r.title}</Body>
        </Card>
      ))}
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

  const run = async () => {
    if (!a || !b) return toast("Wybierz punkt A i B", "error");
    setBusy(true);
    try {
      const r = await routingProvider().route([{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], mode);
      const simple = simplify(r.geometry, 400);
      setLine(simple);
      setMeta({ d: r.distanceM, t: r.durationS });
      setPins(await pinsAlongRoute(simple.map((p) => [p.lng, p.lat] as [number, number]), buffer, cuisine));
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
        label: String(i + 1),
        color: p.is_official ? colors.rarityLegendary : colors.brandPrimary,
      })),
    ],
    [a, b, pins, colors],
  );

  return (
    <View testID="route-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Gastro-Trasa" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <PointInput testID="route-a" label="Punkt A (start)" value={a} onPick={setA} />
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
              <AppMapView center={line[0]} polyline={line} markers={markers} onMarkerPress={(id) => id.length > 2 && router.push(`/pin/${id}`)} />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Title size={18} testID="route-summary">
                {meta ? `${formatKm(meta.d)} · ${formatDuration(meta.t)} · ${pins.length} lokali przy trasie` : ""}
              </Title>
              {pins.map((p, i) => (
                <Card key={p.id} testID={`route-pin-${p.id}`} onPress={() => router.push(`/pin/${p.id}`)}>
                  <Title size={16}>{i + 1}. {p.title}</Title>
                  <Body muted>
                    {CUISINES.find((c) => c.key === p.cuisine)?.label ?? p.cuisine ?? "lokal"} · {formatKm(p.distance_m ?? 0)} od trasy
                    {p.score ? ` · Score ${p.score} (${p.review_count})` : ""}
                  </Body>
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

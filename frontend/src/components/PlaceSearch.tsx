import { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Card, Field, Header } from "@/src/components/ui";
import { geocode, reverseGeocode, type GeocodeResult } from "@/src/lib/routing";
import { spacing, useTheme } from "@/src/theme";

/** Live place autocomplete (cities, streets, POIs) — shared by event + route. */
export function PlaceSearch({
  label,
  value,
  onPick,
  testID,
  placeholder = "np. Kraków Rynek 16 albo ul. Floriańska",
}: {
  label: string;
  value: GeocodeResult | null;
  onPick: (g: GeocodeResult | null) => void;
  testID: string;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState(value?.title ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState("");
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
    if (query.trim().length < 2) {
      setResults([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const hits = await geocode(query, "pl");
      if (id === req.current) {
        setResults(hits);
        setSearched(query.trim());
      }
    } catch {
      if (id === req.current) setResults([]);
    } finally {
      if (id === req.current) setBusy(false);
    }
  };

  const onChangeText = (text: string) => {
    setQ(text);
    onPick(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched("");
      return;
    }
    debounce.current = setTimeout(() => void search(text), 280);
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

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            testID={`${testID}-input`}
            label={label}
            value={q}
            onChangeText={onChangeText}
            placeholder={placeholder}
            onSubmitEditing={() => void search(q)}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        <Button
          testID={`${testID}-map`}
          title="Mapa"
          variant="ghost"
          onPress={() => {
            setPick(value ? { lat: value.lat, lng: value.lng } : { lat: 52.23, lng: 21.01 });
            setPickLabel(value?.title ?? null);
            setMapOpen(true);
          }}
        />
      </View>
      {value ? (
        <Body muted testID={`${testID}-selected`}>
          ✓ {value.title}{"\n"}GPS zapisane: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}. W dniu spotkania sprawdzimy, czy zapisani goście są na miejscu.
        </Body>
      ) : null}
      {busy && !mapOpen ? <Body muted>Szukam…</Body> : null}
      {!value && !busy && searched === q.trim() && results.length === 0 && q.trim().length >= 2 ? (
        <Body muted>Brak podpowiedzi. Wpisz miasto i ulicę, samą ulicę, albo wskaż punkt na mapie.</Body>
      ) : null}
      {results.map((r, i) => (
        <Card
          key={`${r.lat}-${r.lng}-${i}`}
          testID={`${testID}-result-${i}`}
          onPress={() => {
            onPick(r);
            setQ(r.title);
            setResults([]);
            setSearched("");
          }}
        >
          <Body numberOfLines={3}>{r.title}</Body>
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
              onMapPress={(lat, lng) => {
                setPick({ lat, lng });
                setPickLabel("…");
                void reverseGeocode(lat, lng, "pl").then((rev) => setPickLabel(rev?.title ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`));
              }}
            />
          </View>
          <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Body numberOfLines={3}>{pickLabel ?? "Stuknij mapę"}</Body>
            <Button testID={`${testID}-map-confirm`} title="Potwierdź to miejsce" disabled={!pick} loading={busy} onPress={() => void confirmPick()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

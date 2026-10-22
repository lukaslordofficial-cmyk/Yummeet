import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Body, Card, Field } from "@/src/components/ui";
import { geocode, type GeocodeResult } from "@/src/lib/routing";
import { spacing } from "@/src/theme";

/** Live place autocomplete (cities, streets, POIs) — shared by event + route. */
export function PlaceSearch({
  label,
  value,
  onPick,
  testID,
  placeholder = "np. War… albo Jag…",
}: {
  label: string;
  value: GeocodeResult | null;
  onPick: (g: GeocodeResult | null) => void;
  testID: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value?.title ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
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
      if (id === req.current) setResults(hits);
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
      return;
    }
    debounce.current = setTimeout(() => void search(text), 280);
  };

  return (
    <View style={{ gap: spacing.sm }}>
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
      {value ? (
        <Body muted testID={`${testID}-selected`}>
          ✓ {value.title}{"\n"}GPS zapisane: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}. W dniu spotkania sprawdzimy, czy zapisani goście są na miejscu.
        </Body>
      ) : null}
      {busy ? <Body muted>Szukam…</Body> : null}
      {results.map((r, i) => (
        <Card
          key={`${r.lat}-${r.lng}-${i}`}
          testID={`${testID}-result-${i}`}
          onPress={() => {
            onPick(r);
            setQ(r.title);
            setResults([]);
          }}
        >
          <Body numberOfLines={3}>{r.title}</Body>
        </Card>
      ))}
    </View>
  );
}

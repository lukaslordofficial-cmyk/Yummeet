import { useEffect, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Chip, ChipRow, Field, Title } from "@/src/components/ui";
import { ATTR_CATEGORY_HINTS, type AttractionCategory } from "@/src/lib/attractionsCatalog";
import { attractionSuggestions } from "@/src/lib/data";
import { spacing } from "@/src/theme";

export type DraftAttraction = { key: string; category: AttractionCategory; title: string; body: string };

const TABS: { key: AttractionCategory; label: string }[] = [
  { key: "questions", label: "Pytania" },
  { key: "games", label: "Gry" },
  { key: "challenges", label: "Wyzwania" },
];

/** Wybór atrakcji przy tworzeniu stołu (bez zapisu do DB). */
export function AttractionPicker({
  picked,
  onChange,
  testID = "attraction-picker",
}: {
  picked: DraftAttraction[];
  onChange: (next: DraftAttraction[]) => void;
  testID?: string;
}) {
  const [tab, setTab] = useState<AttractionCategory>("questions");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    attractionSuggestions(tab).then((rows) => setSuggestions((rows as any[]) || [])).catch(() => setSuggestions([]));
  }, [tab]);

  const toggle = (s: any) => {
    const key = `sug:${s.id}`;
    if (picked.some((p) => p.key === key)) onChange(picked.filter((p) => p.key !== key));
    else onChange([...picked, { key, category: tab, title: s.title, body: s.body || "" }]);
  };

  const addCustom = () => {
    if (title.trim().length < 2) return;
    onChange([...picked, { key: `custom:${Date.now()}`, category: tab, title: title.trim(), body: body.trim() }]);
    setTitle("");
    setBody("");
  };

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Title size={18}>Atrakcje (opcjonalnie)</Title>
      <ChipRow testID={`${testID}-tabs`}>
        {TABS.map((t) => (
          <Chip key={t.key} testID={`${testID}-tab-${t.key}`} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ChipRow>
      <Body muted testID={`${testID}-hint`}>{ATTR_CATEGORY_HINTS[tab]}</Body>
      {suggestions.map((s) => {
        const selected = picked.some((p) => p.key === `sug:${s.id}`);
        return (
          <Card key={s.id} testID={`${testID}-sug-${s.id}`} onPress={() => toggle(s)}>
            <Title size={16}>{selected ? "✓ " : ""}{s.title}</Title>
            {s.body ? <Body muted>{s.body}</Body> : null}
          </Card>
        );
      })}
      <Field testID={`${testID}-title`} label="Własna atrakcja" value={title} onChangeText={setTitle} placeholder="np. 20 pompek" />
      <Field testID={`${testID}-body`} label="Opis" value={body} onChangeText={setBody} />
      <Button testID={`${testID}-add`} title="Dodaj własną" variant="ghost" onPress={addCustom} />
      {picked.length ? <Body muted>Wybrane: {picked.length}</Body> : null}
    </View>
  );
}

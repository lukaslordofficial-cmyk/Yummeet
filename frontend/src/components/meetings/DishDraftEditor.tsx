import { View } from "react-native";

import { Body, Button, Field, Title } from "@/src/components/ui";
import { spacing } from "@/src/theme";

export type DishDraft = { name: string; description: string };

export function DishDraftEditor({
  dishes, onChange, hint,
}: {
  dishes: DishDraft[];
  onChange: (next: DishDraft[]) => void;
  hint: string;
}) {
  const set = (i: number, patch: Partial<DishDraft>) => {
    onChange(dishes.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  return (
    <View style={{ gap: spacing.md }} testID="dish-draft-editor">
      <Title size={18}>Dania do oceny</Title>
      <Body muted>{hint}</Body>
      {dishes.map((d, i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <Field testID={`dish-name-${i}`} label={`Danie ${i + 1}`} value={d.name} onChangeText={(t) => set(i, { name: t })} placeholder="np. ramen miso" />
          <Field testID={`dish-desc-${i}`} label="Opis (opcjonalnie)" value={d.description} onChangeText={(t) => set(i, { description: t })} placeholder="Co to jest i jak jest podane" />
          {dishes.length > 1 ? (
            <Button testID={`dish-remove-${i}`} title="Usuń danie" variant="ghost" onPress={() => onChange(dishes.filter((_, idx) => idx !== i))} />
          ) : null}
        </View>
      ))}
      {dishes.length < 12 ? (
        <Button testID="dish-add" title="Dodaj danie" variant="secondary" onPress={() => onChange([...dishes, { name: "", description: "" }])} />
      ) : null}
    </View>
  );
}

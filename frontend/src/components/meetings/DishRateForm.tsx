import { useState } from "react";
import { View } from "react-native";

import { Body, Button, Chip, ChipRow, Field, Title } from "@/src/components/ui";
import { DISH_AXES, type DishAxis, type DishScores } from "@/src/lib/dishMath";
import { spacing } from "@/src/theme";

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function DishRateForm({
  dishName, initial, busy, onSave,
}: {
  dishName: string;
  initial: DishScores & { note?: string | null };
  busy: boolean;
  onSave: (scores: DishScores, note: string) => void;
}) {
  const [scores, setScores] = useState<DishScores>(initial);
  const [note, setNote] = useState(initial.note ?? "");
  const setAxis = (axis: DishAxis, n: number) => {
    setScores((cur) => ({ ...cur, [axis]: cur[axis] === n ? null : n }));
  };
  return (
    <View testID="dish-rate-form" style={{ gap: spacing.md }}>
      <Title size={18}>{dishName}</Title>
      <Body muted>Skala 1–10. Puste cechy nie wchodzą do średniej. Wystarczy jedna.</Body>
      {DISH_AXES.map(([axis, label]) => (
        <View key={axis} style={{ gap: spacing.xs }}>
          <Body>{label}{scores[axis] ? ` · ${scores[axis]}` : ""}</Body>
          <ChipRow>
            {NUMBERS.map((n) => (
              <Chip key={n} testID={`score-${axis}-${n}`} label={String(n)} selected={scores[axis] === n} onPress={() => setAxis(axis, n)} />
            ))}
          </ChipRow>
        </View>
      ))}
      <Field testID="dish-rate-note" label="Notatka (opcjonalnie)" value={note} onChangeText={setNote} placeholder="Co zostało w pamięci" />
      <Button testID="dish-rate-save" title="Zapisz kartę dania" loading={busy} onPress={() => onSave(scores, note)} />
    </View>
  );
}

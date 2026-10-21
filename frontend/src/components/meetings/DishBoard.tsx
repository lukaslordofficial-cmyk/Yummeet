import { useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Title } from "@/src/components/ui";
import { DISH_AXES } from "@/src/lib/dishMath";
import type { DishSummary } from "@/src/lib/meetingData";
import { spacing } from "@/src/theme";

/** Lista dań: średnia, opis i liczba kart, z których średnia jest liczona. */
export function DishBoard({ rows, onRate }: { rows: DishSummary[]; onRate?: (row: DishSummary) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <Body muted testID="dish-board-empty">Jeszcze nikt nie ocenił dań z tego miejsca.</Body>;
  return (
    <View style={{ gap: spacing.md }} testID="dish-board">
      {rows.map((row) => {
        const key = row.dish_id ?? row.dish_key ?? row.name;
        const expanded = open === key;
        return (
          <Card key={key} testID={`dish-row-${key}`} onPress={() => setOpen(expanded ? null : key)}>
            <Title size={18}>{row.name}</Title>
            <Body muted>{row.description?.trim() ? row.description : "Brak opisu dania."}</Body>
            <Body testID={`dish-average-${key}`}>
              {row.rating_count > 0 && row.average != null
                ? `Średnia ${row.average}/10 · na podstawie ${row.rating_count} ${row.rating_count === 1 ? "oceny" : "ocen"}`
                : "Jeszcze bez ocen"}
            </Body>
            {expanded ? (
              <View style={{ gap: 2 }}>
                {DISH_AXES.map(([axis, label]) => (
                  <Body key={axis} muted>{label}: {row[axis] ?? "—"}</Body>
                ))}
              </View>
            ) : null}
            {onRate && row.dish_id ? (
              <Button testID={`dish-rate-${row.dish_id}`} title={row.my_taste || row.my_look ? "Popraw swoją kartę" : "Oceń to danie"} variant="secondary" onPress={() => onRate(row)} />
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

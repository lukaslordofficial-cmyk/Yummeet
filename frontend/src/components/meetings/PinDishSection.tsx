import { useEffect, useState } from "react";
import { View } from "react-native";

import { DishBoard } from "@/src/components/meetings/DishBoard";
import { Body, Title } from "@/src/components/ui";
import { pinDishSummary, type DishSummary } from "@/src/lib/meetingData";
import { spacing } from "@/src/theme";

/** Publiczna lista dań z degustacji. Pusta, gdy nikt jeszcze nie oddał karty. */
export function PinDishSection({ pinId }: { pinId: string }) {
  const [rows, setRows] = useState<DishSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    pinDishSummary(pinId).then((r) => { if (alive) setRows(r ?? []); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [pinId]);
  if (!rows?.length) return null;
  return (
    <View style={{ gap: spacing.sm }} testID="pin-dish-section">
      <Title size={20}>Ocenione potrawy</Title>
      <Body muted>Średnia z kart degustacyjnych ze spotkań. Niżej zostaje zwykła ocena lokalu.</Body>
      <DishBoard rows={rows} />
    </View>
  );
}

import { View } from "react-native";

import { Body, Card, Title } from "@/src/components/ui";
import { formatKm } from "@/src/lib/geo";
import type { TravelRouteRow } from "@/src/lib/routeTypes";
import { spacing } from "@/src/theme";

export function RouteHistory({ rows }: { rows: TravelRouteRow[] }) {
  if (!rows.length) {
    return <Body muted style={{ paddingHorizontal: spacing.lg }}>Brak zapisanych tras. Zamknij aktywną trasę, żeby dodać ją do historii.</Body>;
  }
  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }} testID="route-history">
      <Title size={18}>Historia tras</Title>
      {rows.map((r) => (
        <Card key={r.id} testID={`route-history-${r.id}`}>
          <Title size={16}>{r.place_a} → {r.place_b}</Title>
          <Body muted>
            {formatKm(Number(r.distance_m) || 0)} · śledzono {Number(r.km_tracked).toFixed(1)} km · {r.mode}
          </Body>
          <Body muted>
            Knajpy z recenzją: {(r.reviewed || []).length
              ? (r.reviewed || []).map((x) => x.title).join(", ")
              : "brak"}
          </Body>
        </Card>
      ))}
    </View>
  );
}

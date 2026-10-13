import { View } from "react-native";

import { Body, Card, Title } from "@/src/components/ui";
import { CUISINES } from "@/src/lib/cuisines";
import { formatKm } from "@/src/lib/geo";
import type { PinWithStatus } from "@/src/lib/routeProgress";
import { spacing, useTheme } from "@/src/theme";

const STATUS_LABEL: Record<PinWithStatus["status"], string> = {
  passed: "ominięto",
  next: "najbliższa",
  ahead: "przed Tobą",
};

/** Lista lokali wzdłuż trasy ze statusem postępu + dystans „stąd”. */
export function RoutePinProgress({
  pins,
  onOpen,
  fromHereM,
}: {
  pins: PinWithStatus[];
  onOpen: (id: string) => void;
  /** pinId → metry od aktualnej lokalizacji użytkownika */
  fromHereM?: Record<string, number>;
}) {
  const { colors } = useTheme();
  const next = pins.find((p) => p.status === "next");
  const passedN = pins.filter((p) => p.status === "passed").length;

  return (
    <View style={{ gap: spacing.sm }} testID="route-pin-progress">
      {pins.length > 0 ? (
        <Body muted testID="route-pin-progress-summary">
          {passedN}/{pins.length} ominięto
          {next ? ` · teraz: ${next.title}` : pins.length ? " · koniec listy lokali" : ""}
        </Body>
      ) : (
        <Body muted>Brak lokali w buforze dla wybranej kuchni.</Body>
      )}

      {/* Pasek postępu: kafelki w kolejności trasy */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} testID="route-pin-dots">
        {pins.map((p) => (
          <View
            key={p.id}
            style={{
              width: p.status === "next" ? 14 : 10,
              height: p.status === "next" ? 14 : 10,
              borderRadius: 7,
              backgroundColor:
                p.status === "passed"
                  ? colors.muted
                  : p.status === "next"
                    ? colors.brandPrimary
                    : colors.brandSecondary,
              opacity: p.status === "passed" ? 0.45 : 1,
            }}
          />
        ))}
      </View>

      {pins.map((p) => (
        <Card
          key={p.id}
          testID={`route-pin-${p.id}`}
          onPress={() => onOpen(p.id)}
          style={
            p.status === "next"
              ? { borderWidth: 2, borderColor: colors.brandPrimary }
              : p.status === "passed"
                ? { opacity: 0.55 }
                : undefined
          }
        >
          <Title size={16}>
            {p.index + 1}. {p.title}
          </Title>
          <Body muted>
            {STATUS_LABEL[p.status]} · {CUISINES.find((c) => c.key === p.cuisine)?.label ?? p.cuisine ?? "lokal"}
            {fromHereM?.[p.id] != null ? ` · ${formatKm(fromHereM[p.id])} stąd` : ""}
            {p.distance_m != null ? ` · ${formatKm(p.distance_m)} od trasy` : ""}
          </Body>
        </Card>
      ))}
    </View>
  );
}

import { Text, View } from "react-native";

import { fonts, spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";
import { Icon } from "./Icon";
import { Badge, Body, Card, Title } from "./ui";

export const KIND_LABEL: Record<string, string> = {
  open_table: "Otwarty stół", speed_friending: "Speed Friending", official: "Wydarzenie", food_exchange: "Wymiana potraw", volunteer: "Wolontariat", dinner: "Kolacja tematyczna",
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function EventCard({ event, onPress }: { event: EventRow; onPress: () => void }) {
  const { colors } = useTheme();
  const free = event.capacity - event.seats_taken;
  return (
    <Card testID={`event-card-${event.id}`} onPress={onPress} accent={event.is_official ? colors.rarityLegendary : undefined}>
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        {event.is_official ? <Badge testID="event-official-badge" label="OFICJALNE WYDARZENIE" color={colors.rarityLegendary} textColor={colors.onSurface} /> : null}
        <Badge label={KIND_LABEL[event.kind] ?? event.kind} color={colors.brandTertiary} textColor={colors.onBrandTertiary} />
        {event.discount_text ? <Badge testID="event-discount-badge" label={event.discount_text} color={colors.brandSecondary} textColor={colors.onBrandSecondary} /> : null}
      </View>
      <Title size={20}>{event.title}</Title>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Icon name="map-marker" size={16} color={colors.muted} /><Body muted>{event.place_name}</Body>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Icon name="calendar-clock" size={16} color={colors.muted} /><Body muted>{formatDate(event.starts_at)}</Body>
        </View>
        <Text testID={`event-seats-${event.id}`} style={{ fontFamily: fonts.display, fontSize: 18, color: free > 0 ? colors.success : colors.error }}>
          {event.seats_taken}/{event.capacity}
        </Text>
      </View>
    </Card>
  );
}

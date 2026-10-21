import { Pressable, View } from "react-native";

import { EventCard } from "@/src/components/EventCard";
import { Icon } from "@/src/components/Icon";
import { Body, Title } from "@/src/components/ui";
import { MEETING_CATEGORIES } from "@/src/lib/meetingCatalog";
import { radius, spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";

/** Kategorie spotkań jedna pod drugą. Otwarty kafelek pokazuje lokale z tej półki. */
export function MeetingCategoryTiles({
  openKey,
  onToggle,
  events,
  onOpenEvent,
}: {
  openKey: string | null;
  onToggle: (key: string) => void;
  events: EventRow[] | null;
  onOpenEvent: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {MEETING_CATEGORIES.map((c) => {
        const open = openKey === c.key;
        const rows = events?.filter((e) => e.category_key === c.key) ?? [];
        return (
          <View key={c.key} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
            <Pressable
              testID={`tables-category-${c.key}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => onToggle(c.key)}
              style={{ padding: spacing.lg, gap: spacing.sm }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Title size={18} style={{ flex: 1 }}>{c.label}</Title>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={24} color={colors.brandPrimary} />
              </View>
              <Body muted>{c.blurb}</Body>
            </Pressable>
            {open ? (
              <View testID={`tables-category-${c.key}-events`} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
                {events === null ? <Body muted>Ładowanie spotkań…</Body> : rows.length === 0 ? (
                  <Body muted>Brak otwartych spotkań w tej kategorii.</Body>
                ) : rows.map((event) => (
                  <EventCard key={event.id} event={event} onPress={() => onOpenEvent(event.id)} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

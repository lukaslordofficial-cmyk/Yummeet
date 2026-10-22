import { Pressable, ScrollView, View } from "react-native";

import { EventCard } from "@/src/components/EventCard";
import { Body, Title } from "@/src/components/ui";
import { MEETING_CATEGORIES } from "@/src/lib/meetingCatalog";
import { radius, spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";

const EMPTY = "Nikt nie organizuje spotkań w tej kategorii, w promieniu 50 kilometrów.";

/** Kategorie bez opisów, w poziomym slajdzie. Lista spotkań pojawia się po wyborze. */
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
  const rows = events?.filter((event) => event.category_key === openKey) ?? [];
  return (
    <View style={{ gap: spacing.lg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="tables-category-slide"
        contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}
      >
        {MEETING_CATEGORIES.map((category) => {
          const selected = openKey === category.key;
          return (
            <Pressable
              key={category.key}
              testID={`tables-category-${category.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onToggle(category.key)}
              style={{
                minWidth: 168,
                maxWidth: 220,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: selected ? colors.brandPrimary : colors.border,
                backgroundColor: colors.surfaceSecondary,
                justifyContent: "center",
              }}
            >
              <Title size={16} style={{ textAlign: "center" }}>{category.label}</Title>
            </Pressable>
          );
        })}
      </ScrollView>
      {openKey ? (
        <View testID={`tables-category-${openKey}-events`} style={{ gap: spacing.md }}>
          {events === null ? <Body muted style={{ textAlign: "center" }}>Ładowanie spotkań…</Body> : rows.length === 0 ? (
            <Body muted style={{ textAlign: "center" }}>{EMPTY}</Body>
          ) : rows.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => onOpenEvent(event.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

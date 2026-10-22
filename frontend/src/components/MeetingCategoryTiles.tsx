import { Pressable, ScrollView, Text, View } from "react-native";

import { EventCard } from "@/src/components/EventCard";
import { Body, ErrorState } from "@/src/components/ui";
import { MEETING_CATEGORIES } from "@/src/lib/meetingCatalog";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";

const EMPTY = "Nikt nie organizuje spotkań w tej kategorii, w promieniu 50 kilometrów.";

export type NearbyStatus = "hidden" | "loading" | "need-gps" | "ready" | "error";

/** Kafelki jak przycisk Nowe. Lista i tekst wyszukiwania dopiero po wyborze. */
export function MeetingCategoryTiles({
  openKey,
  onToggle,
  events,
  onOpenEvent,
  status,
  error,
  onRetry,
}: {
  openKey: string | null;
  onToggle: (key: string) => void;
  events: EventRow[] | null;
  onOpenEvent: (id: string) => void;
  status: NearbyStatus;
  error?: string | null;
  onRetry?: () => void;
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
                minHeight: 48,
                paddingHorizontal: spacing.xl,
                borderRadius: radius.pill,
                borderWidth: selected ? 3 : 0,
                borderColor: colors.onBrandPrimary,
                backgroundColor: colors.brandPrimary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.onBrandPrimary, textAlign: "center" }}>{category.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {status === "hidden" ? null : (
        <View testID={openKey ? `tables-category-${openKey}-events` : "tables-nearby-status"} style={{ gap: spacing.md }}>
          {status === "error" && error ? <ErrorState message={error} onRetry={onRetry} /> : null}
          {status === "loading" ? <Body muted style={{ textAlign: "center" }}>Szukam spotkań w promieniu 50 kilometrów…</Body> : null}
          {status === "need-gps" ? <Body muted style={{ textAlign: "center" }}>Włącz lokalizację, żeby zobaczyć spotkania w promieniu 50 kilometrów.</Body> : null}
          {status === "ready" && events === null ? <Body muted style={{ textAlign: "center" }}>Ładowanie spotkań…</Body> : null}
          {status === "ready" && events !== null && rows.length === 0 ? <Body muted style={{ textAlign: "center" }}>{EMPTY}</Body> : null}
          {status === "ready" && rows.length > 0 ? rows.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => onOpenEvent(event.id)} />
          )) : null}
        </View>
      )}
    </View>
  );
}

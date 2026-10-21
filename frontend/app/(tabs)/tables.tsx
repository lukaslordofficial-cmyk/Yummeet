import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EventCard } from "@/src/components/EventCard";
import { Body, Button, Chip, ChipRow, EmptyState, ErrorState, Loading, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { listEvents } from "@/src/lib/data";
import { MEETING_CATEGORIES, categoryByKey } from "@/src/lib/meetingCatalog";
import { subscribePostgres } from "@/src/lib/realtime";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";

const FILTERS = [
  { key: null, label: "Wszystkie" },
  ...MEETING_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
];

export default function Tables() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [filter, setFilter] = useState<string | null>(null);
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listEvents(filter)); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    load();
    return subscribePostgres("events-list", { event: "*", table: "events" }, () => { void load(); });
  }, [load]));

  return (
    <View testID="tables-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", gap: spacing.sm }}>
        <Title size={28} testID="tables-title">Spotkanie</Title>
        <Body muted testID="tables-intro">Dołącz do otwartego stołu albo zorganizuj własne spotkanie przy jedzeniu.</Body>
        <Button testID="tables-create-button" title="Nowe spotkanie" icon="plus" onPress={() => router.push(filter ? `/event/new?category=${filter}` : "/event/new")} style={{ alignSelf: "stretch" }} />
        <Button testID="tables-journal-button" title="Dziennik Spotkań" icon="notebook-outline" variant="secondary" onPress={() => router.push("/meetings")} style={{ alignSelf: "stretch" }} />
      </View>
      <ChipRow testID="tables-filter-chips">
        {FILTERS.map((f) => <Chip key={f.label} testID={`tables-filter-${f.key ?? "all"}`} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </ChipRow>
      {categoryByKey(filter) ? <Body muted style={{ paddingHorizontal: spacing.lg }}>{categoryByKey(filter)?.blurb}</Body> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : rows === null ? <Loading /> : (
        <FlatList data={rows} keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="tables-empty" icon="table-furniture" title="Brak otwartych spotkań" text="Może założysz pierwsze?" />}
          renderItem={({ item }) => <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />} />
      )}
    </View>
  );
}

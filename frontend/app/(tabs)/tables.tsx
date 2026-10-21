import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MeetingCategoryTiles } from "@/src/components/MeetingCategoryTiles";
import { Body, Button, ErrorState, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { listEvents } from "@/src/lib/data";
import { subscribePostgres } from "@/src/lib/realtime";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";

export default function Tables() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listEvents(null)); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return subscribePostgres("events-list", { event: "*", table: "events" }, () => { void load(); });
  }, [load]));

  return (
    <View testID="tables-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Title size={32} testID="tables-title">Spotkania</Title>
          <Body muted testID="tables-intro">Dołącz do otwartego stołu albo zorganizuj własne spotkanie przy jedzeniu.</Body>
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xl }}>
            <Button testID="tables-create-button" title="Nowe" icon="plus" onPress={() => router.push(openKey ? `/event/new?category=${openKey}` : "/event/new")} style={{ flex: 1 }} />
            <Button testID="tables-journal-button" title="Dziennik" icon="notebook-outline" variant="secondary" onPress={() => router.push("/meetings")} style={{ flex: 1 }} />
          </View>
        </View>
        <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
          {error ? <ErrorState message={error} onRetry={load} /> : (
            <MeetingCategoryTiles
              openKey={openKey}
              onToggle={(key) => setOpenKey((cur) => (cur === key ? null : key))}
              events={rows}
              onOpenEvent={(id) => router.push(`/event/${id}`)}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

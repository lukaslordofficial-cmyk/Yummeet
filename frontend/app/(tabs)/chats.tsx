import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Body, Card, EmptyState, ErrorState, Loading, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { myConversations } from "@/src/lib/data";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";

const KIND_ICON: Record<string, string> = { direct: "account", group: "account-group", event: "table-chair", mission: "flag", duel: "sword-cross" };

export default function Chats() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setRows(await myConversations()); setError(null); } catch (e) { setError(errorMessage(e)); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View testID="chats-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}><Title size={28}>Czaty</Title></View>
      {error ? <ErrorState message={error} onRetry={load} /> : rows === null ? <Loading /> : (
        <FlatList data={rows} keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="chats-empty" icon="chat-sleep-outline" title="Cisza przy stole" text="Dołącz do stołu lub napisz do Yummiteera." />}
          renderItem={({ item }) => (
            <Card testID={`chat-row-${item.id}`} onPress={() => router.push(`/chat/${item.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
                <Icon name={KIND_ICON[item.kind] ?? "chat"} size={22} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Title size={16}>{item.kind === "direct" ? item.other_name ?? "Rozmowa" : item.title ?? "Czat"}</Title>
                <Body muted numberOfLines={1}>{item.last_body ?? "Brak wiadomości"}</Body>
              </View>
            </Card>
          )} />
      )}
    </View>
  );
}

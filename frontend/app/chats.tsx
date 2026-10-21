import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Body, Card, EmptyState, ErrorState, Header, IconButton, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { leaveConversation, myConversations } from "@/src/lib/data";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";

const KIND_ICON: Record<string, string> = { direct: "account", group: "account-group", event: "table-chair", mission: "flag", duel: "sword-cross" };

export default function Chats() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setRows(await myConversations()); setError(null); } catch (e) { setError(errorMessage(e)); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeChat = (id: string, title: string) => {
    Alert.alert("Usunąć czat?", `„${title}” zniknie z Twojej listy.`, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: () => {
          leaveConversation(id)
            .then(() => {
              setRows((prev) => prev?.filter((c) => c.id !== id) ?? prev);
              toast("Czat usunięty", "success");
            })
            .catch((e) => toast(errorMessage(e), "error"));
        },
      },
    ]);
  };

  return (
    <View testID="chats-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Czaty" />
      {error ? <ErrorState message={error} onRetry={load} /> : rows === null ? <Loading /> : (
        <FlatList data={rows} keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="chats-empty" icon="chat-sleep-outline" title="Cisza przy stole" text="Dołącz do spotkania lub napisz do Yummiteera." />}
          renderItem={({ item }) => {
            const title = item.kind === "direct" ? item.other_name ?? "Rozmowa" : item.title ?? "Czat";
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Card testID={`chat-row-${item.id}`} onPress={() => router.push(`/chat/${item.id}`)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
                    <Icon name={KIND_ICON[item.kind] ?? "chat"} size={22} color={colors.onBrandTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Title size={16}>{title}</Title>
                    <Body muted numberOfLines={1}>{item.last_body ?? "Brak wiadomości"}</Body>
                  </View>
                </Card>
                <IconButton testID={`chat-delete-${item.id}`} icon="delete-outline" onPress={() => removeChat(item.id, title)} />
              </View>
            );
          }} />
      )}
    </View>
  );
}

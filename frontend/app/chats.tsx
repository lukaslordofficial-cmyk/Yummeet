import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Card, EmptyState, ErrorState, Header, IconButton, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { leaveConversation, myConversations } from "@/src/lib/data";
import { usesNativeTabs } from "@/src/navigation";
import { radius, spacing, useTheme } from "@/src/theme";

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
  const [pending, setPending] = useState<{ id: string; title: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const load = useCallback(async () => { try { setRows(await myConversations()); setError(null); } catch (e) { setError(errorMessage(e)); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmRemove = async () => {
    if (!pending || removing) return;
    setRemoving(true);
    try {
      await leaveConversation(pending.id);
      setRows((prev) => prev?.filter((c) => c.id !== pending.id) ?? prev);
      toast("Czat usunięty", "success");
      setPending(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setRemoving(false);
    }
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
                <IconButton testID={`chat-delete-${item.id}`} icon="delete-outline" onPress={() => setPending({ id: item.id, title })} />
              </View>
            );
          }} />
      )}
      <Modal visible={!!pending} transparent animationType="slide" onRequestClose={() => { if (!removing) setPending(null); }}>
        <Pressable
          testID="chat-delete-backdrop"
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => { if (!removing) setPending(null); }}
        >
          <Pressable
            testID="chat-delete-sheet"
            onPress={() => {}}
            style={{
              backgroundColor: colors.surfaceSecondary,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              gap: spacing.md,
            }}
          >
            <Title size={20}>Usunąć czat?</Title>
            <Body>„{pending?.title}” zniknie z Twojej listy.</Body>
            <Button testID="chat-delete-confirm" title="Usuń" variant="danger" loading={removing} onPress={() => void confirmRemove()} />
            <Button testID="chat-delete-cancel" title="Anuluj" variant="ghost" disabled={removing} onPress={() => setPending(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

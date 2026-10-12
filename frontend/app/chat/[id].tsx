import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, Field, Header, IconButton, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { listMessages, sendMessage } from "@/src/lib/data";
import { subscribePostgres } from "@/src/lib/realtime";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => { try { setMsgs(await listMessages(id)); } catch (e) { toast(errorMessage(e), "error"); } }, [id, toast]);
  useEffect(() => {
    load();
    return subscribePostgres(`chat-${id}`, { event: "INSERT", table: "messages", filter: `conversation_id=eq.${id}` }, (p) => {
      setMsgs((prev) => (prev.some((m) => m.id === (p.new as any).id) ? prev : [p.new, ...prev]));
    });
  }, [id, load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    try { await sendMessage(id, body); load(); } catch (e) { toast(errorMessage(e), "error"); setText(body); }
  };

  return (
    <View testID="chat-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Rozmowa" />
      <FlatList inverted data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }] }}><EmptyState testID="chat-empty" icon="chat-outline" title="Napisz pierwszą wiadomość" /></View>}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View testID={`chat-message-${item.id}`} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", backgroundColor: mine ? colors.brandPrimary : colors.surfaceSecondary,
              borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: fonts.text, fontSize: 15, color: mine ? colors.onBrandPrimary : colors.onSurface }}>{item.body}</Text>
            </View>
          );
        }} />
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <View style={{ flex: 1 }}><Field testID="chat-input" value={text} onChangeText={setText} placeholder="Wiadomość…" onSubmitEditing={send} returnKeyType="send" /></View>
          <IconButton testID="chat-send-button" icon="send" tone="brand" onPress={send} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

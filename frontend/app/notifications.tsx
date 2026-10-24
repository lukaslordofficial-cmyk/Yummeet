import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, EmptyState, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  deleteNotification, listMyNotifications, markAllNotificationsRead, markNotificationRead,
  type AppNotification,
} from "@/src/lib/data";
import { emitNotificationsChanged } from "@/src/lib/notifyBus";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

function routeForNotification(n: AppNotification): string | null {
  const d = n.data ?? {};
  // Wiadomość / pojedynek z czatem — najpierw czat
  const interest = d.interest_id;
  if (typeof interest === "string" && interest) return `/dates/contact/${interest}`;
  const conv = d.conversation_id;
  if (typeof conv === "string" && conv) return `/chat/${conv}`;
  if (typeof d.duel_id === "string" && d.duel_id) return `/duel/${d.duel_id}`;
  if (typeof d.event_id === "string" && d.event_id) return `/event/${d.event_id}`;
  if (typeof d.user_mission_id === "string" && d.user_mission_id) return `/mission/${d.user_mission_id}`;

  const offerId = typeof d.offer_id === "string" ? d.offer_id : null;
  if (n.kind === "food_nearby" || offerId) {
    const kind = typeof d.kind === "string" ? d.kind : "exchange";
    const seg =
      kind === "signature" ? "signature"
        : kind === "giveaway" ? "giveaway"
          : kind === "order" ? "signature"
            : "exchange";
    const q = new URLSearchParams({ seg });
    if (offerId) q.set("offerId", offerId);
    return `/food?${q.toString()}`;
  }

  const tipId = typeof d.tip_id === "string" ? d.tip_id : null;
  if (n.kind === "tip_nearby" || tipId) {
    const tipKind = d.tip_kind === "lifehack" ? "lifehack" : "recipe";
    const q = new URLSearchParams({ seg: "tips", tipKind });
    if (tipId) q.set("tipId", tipId);
    return `/food?${q.toString()}`;
  }
  return null;
}

function timeLabel(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listMyNotifications(80));
      emitNotificationsChanged();
    } catch (e) {
      toast(errorMessage(e), "error");
      setItems([]);
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openItem = async (n: AppNotification) => {
    setBusyId(n.id);
    try {
      if (!n.read_at) await markNotificationRead(n.id);
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x)) ?? null);
      emitNotificationsChanged();
      const path = routeForNotification(n);
      if (path) router.push(path as any);
      else toast("Brak powiązanego ekranu dla tego powiadomienia", "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (id: string) => {
    setBusyId(id);
    try {
      await deleteNotification(id);
      setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
      emitNotificationsChanged();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null);
      emitNotificationsChanged();
      toast("Oznaczono jako przeczytane", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const unread = items?.filter((x) => !x.read_at).length ?? 0;

  return (
    <View testID="notifications-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Powiadomienia"
        right={unread > 0 ? <Button testID="notif-mark-all" title="Przeczytane" variant="ghost" onPress={() => void markAll()} /> : undefined}
      />
      {items === null ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="notifications-empty"
              icon="bell-outline"
              title="Brak powiadomień"
              text="Gdy ktoś napisze wiadomość albo wydarzy się coś w okolicy, zobaczysz to tutaj."
            />
          }
          renderItem={({ item }) => {
            const unreadRow = !item.read_at;
            return (
              <Pressable
                testID={`notif-row-${item.id}`}
                disabled={busyId === item.id}
                onPress={() => void openItem(item)}
                style={{
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: unreadRow ? colors.brandPrimary + "18" : colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: unreadRow ? colors.brandPrimary : colors.border,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  {unreadRow ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary }} />
                  ) : null}
                  <Title size={15} style={{ flex: 1, fontFamily: fonts.display }} numberOfLines={2}>{item.title}</Title>
                </View>
                {item.body ? <Body numberOfLines={3}>{item.body}</Body> : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Body muted style={{ fontSize: 12 }}>{timeLabel(item.created_at)}</Body>
                  <Button testID={`notif-delete-${item.id}`} title="Usuń" variant="ghost" onPress={() => void removeItem(item.id)} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

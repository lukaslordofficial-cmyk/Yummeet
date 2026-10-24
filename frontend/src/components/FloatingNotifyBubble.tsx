import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, PanResponder, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { emitNotificationsChanged, onNotificationsChanged } from "@/src/lib/notifyBus";
import { ensureNotifyPermission, notifyNearPin } from "@/src/lib/routeNotify";
import { subscribePostgres } from "@/src/lib/realtime";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, spacing, useTheme } from "@/src/theme";

const SIZE = 56;

/**
 * Przesuwalna ikona powiadomień na głównym ekranie.
 * Nowa wiadomość → badge + lokalne powiadomienie systemowe.
 */
export function FloatingNotifyBubble() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [unread, setUnread] = useState(0);
  const pos = useRef(new Animated.ValueXY({ x: width - SIZE - spacing.lg, y: height * 0.42 })).current;
  const dragging = useRef(false);
  const lastPing = useRef(0);

  const loadUnread = useCallback(async () => {
    if (!uid) { setUnread(0); return; }
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null);
      if (!error && typeof count === "number") setUnread(count);
    } catch { /* ignore */ }
  }, [uid]);

  const ping = useCallback((title: string, body: string) => {
    const now = Date.now();
    if (now - lastPing.current < 1200) return;
    lastPing.current = now;
    void notifyNearPin(title, body);
  }, []);

  useEffect(() => {
    void ensureNotifyPermission();
    void loadUnread();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void loadUnread();
    });
    const offBus = onNotificationsChanged(() => { void loadUnread(); });
    return () => { sub.remove(); offBus(); };
  }, [loadUnread]);

  useEffect(() => {
    if (!uid) return;
    const offNotif = subscribePostgres(
      "bubble-notifications",
      { event: "INSERT", table: "notifications", filter: `user_id=eq.${uid}` },
      (payload) => {
        setUnread((n) => n + 1);
        emitNotificationsChanged();
        const row = payload.new as { title?: string; body?: string; kind?: string } | undefined;
        ping(row?.title ?? "Powiadomienie", row?.body ?? "Masz nowe powiadomienie w Yummeet");
      },
    );
    const offMsg = subscribePostgres(
      "bubble-messages",
      { event: "INSERT", table: "messages" },
      async (payload) => {
        const row = payload.new as { sender_id?: string; body?: string; conversation_id?: string } | undefined;
        if (!row?.sender_id || row.sender_id === uid) return;
        try {
          const { data } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("conversation_id", row.conversation_id)
            .eq("user_id", uid)
            .maybeSingle();
          if (!data) return;
        } catch { return; }
        // Fallback gdy migracja 021 jeszcze nie działa — inaczej dedupe w ping()
        ping("Nowa wiadomość", row.body?.slice(0, 80) || "Ktoś napisał do Ciebie");
        void loadUnread();
      },
    );
    return () => { offNotif(); offMsg(); };
  }, [uid, loadUnread, ping]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderGrant: () => { dragging.current = true; pos.extractOffset(); },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pos.flattenOffset();
        // @ts-expect-error Animated value private
        const curX = (pos.x as any)._value as number;
        // @ts-expect-error Animated value private
        const curY = (pos.y as any)._value as number;
        const minX = spacing.sm;
        const maxX = width - SIZE - spacing.sm;
        const minY = insets.top + spacing.sm;
        const maxY = height - insets.bottom - SIZE - 88;
        const snapX = curX + SIZE / 2 < width / 2 ? minX : maxX;
        const snapY = Math.min(maxY, Math.max(minY, curY));
        Animated.spring(pos, { toValue: { x: snapX, y: snapY }, useNativeDriver: false, bounciness: 6 }).start();
        setTimeout(() => { dragging.current = false; }, 100);
      },
    }),
  ).current;

  if (!uid) return null;

  return (
    <Animated.View
      testID="floating-notify-bubble"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        zIndex: 999,
        elevation: 16,
        width: SIZE,
        height: SIZE,
        transform: pos.getTranslateTransform(),
      }}
      {...pan.panHandlers}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Powiadomienia, ${unread} nieprzeczytanych` : "Powiadomienia"}
        onPress={() => {
          if (dragging.current) return;
          void loadUnread();
          router.push("/notifications");
        }}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: colors.brandPrimary,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Icon name="bell" size={26} color={colors.onBrandPrimary} />
        {unread > 0 ? (
          <View
            style={{
              position: "absolute", top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11,
              backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
              borderWidth: 2, borderColor: colors.surface,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 11, color: colors.onError }}>{unread > 99 ? "99+" : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KIND_LABEL, formatDate } from "@/src/components/EventCard";
import { Badge, Body, Button, Card, ErrorState, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { eventCheckin, eventCheckinCode, eventConversationId, eventJoin, eventLeave, eventParticipants, getEvent, myEventStatus, report } from "@/src/lib/data";
import { subscribePostgres } from "@/src/lib/realtime";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, spacing, useTheme } from "@/src/theme";
import type { EventRow } from "@/src/types";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const [e, setE] = useState<EventRow | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [people, setPeople] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [orgCode, setOrgCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isOrganizer = e?.organizer_id === session?.user.id;

  const load = useCallback(async () => {
    try {
      const [ev, st, ps] = await Promise.all([getEvent(id), myEventStatus(id), eventParticipants(id)]);
      setE(ev); setStatus(st); setPeople(ps ?? []); setError(null);
      if (ev?.organizer_id === session?.user.id) setOrgCode(await eventCheckinCode(id));
    } catch (err) { setError(errorMessage(err)); }
  }, [id, session?.user.id]);
  useEffect(() => { load(); }, [load]);
  // Live seat counter (optional — app works without Realtime publication).
  useEffect(() => {
    return subscribePostgres<EventRow>(`event-${id}`, { event: "UPDATE", table: "events", filter: `id=eq.${id}` }, (p) => {
      if (p.new) setE(p.new as EventRow);
    });
  }, [id]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok, "success"); await load(); } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const openChat = async () => { const c = await eventConversationId(id); if (c) router.push(`/chat/${c}`); else toast("Czat niedostępny", "info"); };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Stół" /><ErrorState message={error} onRetry={load} /></View>;
  if (!e) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Stół" /><Loading /></View>;
  const joined = status === "joined" || status === "attended";

  return (
    <View testID="event-detail-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={KIND_LABEL[e.kind] ?? "Stół"} right={<Button testID="event-report-button" title="Zgłoś" variant="ghost" onPress={() => act(() => report("event", id, "event_issue"), "Zgłoszenie wysłane")} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Card accent={e.is_official ? colors.rarityLegendary : undefined}>
          {e.is_official ? <Badge label="OFICJALNE WYDARZENIE" color={colors.rarityLegendary} textColor={colors.onSurface} /> : null}
          <Title size={24} testID="event-title">{e.title}</Title>
          <Body>{e.place_name} · {formatDate(e.starts_at)}</Body>
          {e.description ? <Body muted>{e.description}</Body> : null}
          {e.theme ? <Body>Temat: {e.theme}</Body> : null}
          {e.rules ? <Body muted>Zasady: {e.rules}</Body> : null}
          {e.discount_text ? <Badge label={e.discount_text} color={colors.brandSecondary} textColor={colors.onBrandSecondary} /> : null}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Text testID="event-detail-seats" style={{ fontFamily: fonts.display, fontSize: 36, color: colors.brandPrimary }}>{e.capacity - e.seats_taken}</Text>
            <Body muted>wolnych miejsc z {e.capacity}</Body>
          </View>
        </Card>
        {!joined ? <Button testID="event-join-button" title="Zarezerwuj miejsce" icon="seat" loading={busy} disabled={e.seats_taken >= e.capacity} onPress={() => act(() => eventJoin(id), "Miejsce zarezerwowane!")} /> : (
          <View style={{ gap: spacing.md }}>
            <Badge testID="event-joined-badge" label={status === "attended" ? "Obecność potwierdzona ✓" : "Jesteś na liście"} color={colors.success} textColor={colors.onSuccess} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button testID="event-chat-button" title="Czat stołu" icon="chat" style={{ flex: 1 }} onPress={openChat} />
              <Button testID="event-games-button" title="Gry" icon="dice-multiple" variant="secondary" onPress={() => router.push("/games")} />
            </View>
            {!isOrganizer && status === "joined" ? <Button testID="event-leave-button" title="Zrezygnuj" variant="ghost" onPress={() => act(() => eventLeave(id), "Zrezygnowano")} /> : null}
          </View>
        )}
        {isOrganizer && orgCode ? <Card testID="event-organizer-code"><Title size={16}>Kod obecności (pokaż uczestnikom na miejscu)</Title><Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary, letterSpacing: 4 }}>{orgCode}</Text></Card> : null}
        {joined && status !== "attended" && !isOrganizer ? (
          <Card>
            <Field testID="event-checkin-input" label="Kod obecności od organizatora" value={code} onChangeText={setCode} autoCapitalize="characters" />
            <Button testID="event-checkin-button" title="Potwierdź obecność" variant="secondary" onPress={() => act(() => eventCheckin(id, code), "Obecność potwierdzona! +25 XP")} />
          </Card>
        ) : null}
        <Title size={18}>Uczestnicy</Title>
        {people.length === 0 ? <Body muted testID="event-participants-hidden">Lista uczestników widoczna po dołączeniu.</Body> : people.map((p) => (
          <Pressable key={p.user_id} testID={`event-participant-${p.user_id}`} onPress={() => p.user_id !== session?.user.id && router.push(`/user/${p.user_id}`)}>
            <Card><Body>{p.display_name}{p.status === "attended" ? " ✓" : ""}</Body></Card>
          </Pressable>
        ))}
      </KeyboardAwareScrollView>
    </View>
  );
}

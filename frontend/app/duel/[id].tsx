import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameCard } from "@/src/components/GameCard";
import { MOVE_LABEL, RpsPicker } from "@/src/components/RpsPicker";
import { Badge, Body, Button, Card, ErrorState, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { DUEL_OUTCOME_LABEL, DUEL_STATUS_LABEL, OPEN_DUEL_STATUSES } from "@/src/domain/rules";
import { errorMessage } from "@/src/lib/api";
import { duelCancel, duelConfirm, duelForfeit, duelPlay, duelPlayDefense, duelRespond, duelState, duelSubmitEvidence, myCards } from "@/src/lib/data";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, spacing, useTheme } from "@/src/theme";
import type { UserCard } from "@/src/types";

export default function DuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [defCards, setDefCards] = useState<UserCard[]>([]);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setD(await duelState(id)); setError(null); } catch (e) { setError(errorMessage(e)); } }, [id]);
  useEffect(() => { load(); }, [load]);
  // Light polling only while the duel is open (stops when finished).
  useEffect(() => {
    if (!d || !OPEN_DUEL_STATUSES.includes(d.status)) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [d, load]);
  useEffect(() => {
    if (d?.status === "awaiting_card" && d.defender_id === me) myCards().then((c) => setDefCards(c.filter((x) => x.card.kind === "defensive"))).catch(() => {});
  }, [d?.status, d?.defender_id, me]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok, "success"); await load(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Pojedynek" /><ErrorState message={error} onRetry={load} /></View>;
  if (!d) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Pojedynek" /><Loading /></View>;

  const iAmChallenger = d.challenger_id === me;
  const isDefender = d.defender_id === me;
  const isAttacker = d.attacker_id === me;
  const lastRound = d.rounds?.[d.rounds.length - 1];

  return (
    <View testID="duel-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Pojedynek" right={d.conversation_id ? <Button testID="duel-chat-button" title="Czat" variant="ghost" icon="chat" onPress={() => router.push(`/chat/${d.conversation_id}`)} /> : undefined} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Card accent={colors.brandPrimary}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Title size={20} style={{ flex: 1 }}>{d.challenger_name}</Title>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.brandPrimary }}>VS</Text>
            <Title size={20} style={{ flex: 1, textAlign: "right" }}>{d.opponent_name}</Title>
          </View>
          <Badge testID="duel-status" label={DUEL_STATUS_LABEL[d.status]} color={colors.brandTertiary} textColor={colors.onBrandTertiary} />
          {d.mode === "proximity" ? <Body muted>Pojedynek z bliskości — obowiązkowy. Twoja dokładna lokalizacja nie jest ujawniana.</Body> : null}
          {lastRound ? <Body muted testID="duel-last-round">Ostatnia runda: {MOVE_LABEL[lastRound.challenger_move] ?? "—"} vs {MOVE_LABEL[lastRound.opponent_move] ?? "—"} · {lastRound.winner_id ? (lastRound.winner_id === me ? "wygrywasz" : "przegrywasz") : "remis — gramy dalej!"}</Body> : null}
        </Card>

        {d.status === "pending_acceptance" ? (iAmChallenger ? (
          <Card><Body>Czekamy, aż przeciwnik przyjmie wyzwanie (może odmówić).</Body>
            <Button testID="duel-cancel-button" title="Wycofaj wyzwanie" variant="ghost" onPress={() => act(() => duelCancel(id), "Anulowano")} /></Card>
        ) : (
          <Card><Title size={18}>Zostałeś wyzwany!</Title>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button testID="duel-accept-button" title="Przyjmuję" style={{ flex: 1 }} loading={busy} onPress={() => act(() => duelRespond(id, true), "Do boju!")} />
              <Button testID="duel-reject-button" title="Odmawiam" variant="ghost" onPress={() => act(() => duelRespond(id, false), "Odrzucono bez konsekwencji")} />
            </View></Card>
        )) : null}

        {(d.status === "round1" || d.status === "awaiting_response") ? (
          <Card testID="duel-rps-card">
            <Title size={18}>{d.phase === "attack" ? "Runda ataku" : "Runda obrony"} · rozdanie {d.current_round}</Title>
            <Body muted>{d.phase === "attack" ? "Zwycięzca zagrywa losową kartę ofensywną ze swojej talii." : `Stawka: czy ${d.defender_id === me ? "możesz" : "przeciwnik może"} użyć karty defensywnej.`}</Body>
            {d.my_move_played ? <Body testID="duel-waiting-move">Ruch zagrany — czekamy na przeciwnika…</Body> : <RpsPicker disabled={busy} onPick={(mv) => act(() => duelPlay(id, mv))} />}
            {d.mode === "invite" && d.status === "round1" ? <Button testID="duel-cancel-round-button" title="Anuluj pojedynek" variant="ghost" onPress={() => act(() => duelCancel(id), "Anulowano")} /> : null}
          </Card>
        ) : null}

        {d.offensive_card ? (
          <View style={{ gap: spacing.sm }}>
            <Title size={18}>Zagrana karta ofensywna</Title>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <GameCard testID="duel-offensive-card" card={d.offensive_card} compact />
              {d.defensive_card ? <GameCard testID="duel-defensive-card" card={d.defensive_card} compact /> : <View style={{ flex: 1 }} />}
            </View>
          </View>
        ) : null}

        {d.status === "awaiting_card" ? (isDefender ? (
          <Card testID="duel-defense-picker">
            <Title size={18}>Wygrałeś obronę! Wybierz kartę defensywną</Title>
            {defCards.map((c) => <Button key={c.id} testID={`duel-defense-card-${c.id}`} title={c.card.name} variant="secondary" onPress={() => act(() => duelPlayDefense(id, c.id), "Karta zagrana")} />)}
            <Button testID="duel-defense-skip" title="Nie używam karty" variant="ghost" onPress={() => act(() => duelPlayDefense(id, null))} />
          </Card>
        ) : <Body muted>Przeciwnik wybiera kartę defensywną…</Body>) : null}

        {["active_challenge", "awaiting_confirmation", "finished"].includes(d.status) && d.challenge_text ? (
          <Card testID="duel-challenge-card" accent={colors.warning}>
            <Title size={18}>Wyzwanie</Title>
            <Body>{d.challenge_text}</Body>
            {d.challenge_variant ? <Body testID="duel-challenge-variant">Zmienione przez kartę: {d.challenge_variant}</Body> : null}
            {d.challenge_deadline ? <Body muted>Termin: {new Date(d.challenge_deadline).toLocaleString("pl-PL")}</Body> : null}
            <Body muted>🛡 Spotkania tylko w miejscach publicznych. Nikt nie musi przyjmować ani jeść jedzenia.</Body>
          </Card>
        ) : null}

        {d.status === "active_challenge" && isDefender ? (
          <Card>
            <Field testID="duel-evidence-input" label="Dowód wykonania" value={evidence} onChangeText={setEvidence} multiline placeholder="Opis / link do zdjęcia" />
            <Button testID="duel-evidence-submit" title="Zgłoś wykonanie" loading={busy} onPress={() => act(() => duelSubmitEvidence(id, evidence), "Wysłano do potwierdzenia")} />
            <Button testID="duel-forfeit-button" title="Rezygnuję (tracę 1 losową kartę)" variant="ghost" onPress={() => act(() => duelForfeit(id), "Rezygnacja zapisana")} />
          </Card>
        ) : null}
        {d.status === "active_challenge" && isAttacker ? <Body muted>Przeciwnik realizuje wyzwanie.</Body> : null}

        {d.status === "awaiting_confirmation" ? (isAttacker ? (
          <Card testID="duel-confirm-card">
            <Title size={18}>Dowód przeciwnika</Title><Body>{d.evidence}</Body>
            <Button testID="duel-confirm-accept" title="Potwierdzam odbiór / wykonanie" loading={busy} onPress={() => act(() => duelConfirm(id, true), "Pojedynek zakończony")} />
            <Button testID="duel-confirm-dispute" title="Zgłoś spór" variant="ghost" onPress={() => act(() => duelConfirm(id, false), "Spór przekazany do moderacji")} />
          </Card>
        ) : <Body muted>Czekamy na potwierdzenie atakującego (auto-akceptacja po 48 h).</Body>) : null}

        {d.status === "finished" ? (
          <Card testID="duel-result-card" accent={d.winner_id === me ? colors.success : colors.border}>
            <Title size={22}>{d.winner_id === me ? "Wygrana!" : d.winner_id ? "Przegrana" : "Koniec"}</Title>
            <Body testID="duel-outcome">{DUEL_OUTCOME_LABEL[d.outcome] ?? d.outcome}</Body>
            {d.penalty_user_card_id ? <Body muted>Karta zmieniła właściciela.</Body> : null}
          </Card>
        ) : null}
        {["cancelled", "rejected", "expired"].includes(d.status) ? <Body testID="duel-closed-info" muted>Pojedynek zamknięty bez konsekwencji.</Body> : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

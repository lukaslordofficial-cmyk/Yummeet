import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Badge, Body, Button, Card, Chip, ChipRow, EmptyState, ErrorState, IconButton, Loading, Title, useToast } from "@/src/components/ui";
import { DUEL_OUTCOME_LABEL, DUEL_STATUS_LABEL, MISSION_STATUS_LABEL, OPEN_DUEL_STATUSES } from "@/src/domain/rules";
import { errorMessage } from "@/src/lib/api";
import { cardHistory, confirmRequests, duelLeaderboard, missionBoard, missionConfirm, missionHistory, myDuels } from "@/src/lib/data";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, spacing, useTheme } from "@/src/theme";
import type { BoardMission } from "@/src/types";

type Seg = "missions" | "duels" | "history";
const CATEGORY_ICON: Record<string, string> = {
  restaurant: "silverware", travel: "map-marker-path", cooking: "chef-hat", food_exchange: "swap-horizontal", food_rescue: "leaf", volunteer: "hand-heart",
  social: "account-group", dating: "heart", review: "star-outline", specialization: "shield-star", card: "cards",
};

export default function Challenges() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile, session } = useAuth();
  const me = session?.user.id;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [seg, setSeg] = useState<Seg>("missions");
  const [board, setBoard] = useState<BoardMission[] | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [duels, setDuels] = useState<any[] | null>(null);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [history, setHistory] = useState<{ missions: any[]; cards: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      if (seg === "missions") { const [b, r] = await Promise.all([missionBoard(), confirmRequests()]); setBoard(b); setRequests(r as any[]); }
      if (seg === "duels") { const [d, l] = await Promise.all([myDuels(), duelLeaderboard()]); setDuels(d as any[]); setLeaders(l); }
      if (seg === "history") { const [m, c] = await Promise.all([missionHistory(), cardHistory()]); setHistory({ missions: m as any[], cards: c as any[] }); }
    } catch (e) { setError(errorMessage(e)); }
  }, [seg]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirm = async (id: string, ok: boolean) => {
    try { await missionConfirm(id, ok); toast(ok ? "Potwierdzono wykonanie misji" : "Odrzucono", ok ? "success" : "info"); load(); } catch (e) { toast(errorMessage(e), "error"); }
  };

  const renderMissions = () => {
    if (!board) return <Loading />;
    return (
      <>
        {!profile?.primary_specialization ? (
          <Card testID="choose-spec-banner" accent={colors.brandPrimary} onPress={() => router.push("/specializations")}>
            <Title size={18}>Wybierz swoją klasę postaci</Title>
            <Body muted>Specjalizacja główna odblokuje wszystkie jej misje (z innych klas widzisz losowe 25%).</Body>
          </Card>
        ) : null}
        {requests.map((r) => (
          <Card key={r.id} testID={`confirm-request-${r.id}`} accent={colors.info}>
            <Title size={16}>Prośba o potwierdzenie</Title>
            <Body>{r.owner?.display_name} — {r.mission?.name}</Body>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID={`confirm-approve-${r.id}`} title="Potwierdzam" variant="secondary" style={{ flex: 1 }} onPress={() => confirm(r.id, true)} />
              <Button testID={`confirm-reject-${r.id}`} title="Odrzuć" variant="ghost" onPress={() => confirm(r.id, false)} />
            </View>
          </Card>
        ))}
        {board.length === 0 ? <EmptyState testID="missions-empty" icon="book-closed" title="Brak misji" text="Wkrótce pojawią się nowe wyzwania." /> : null}
        {board.map((m) => (
          <Card key={m.mission_id} testID={`mission-card-${m.code}`} onPress={() => router.push(`/mission/${m.mission_id}`)} accent={m.is_primary ? colors.brandPrimary : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name={CATEGORY_ICON[m.category] ?? "flag"} size={24} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Title size={17}>{m.name}</Title>
                <Body muted numberOfLines={2}>{m.description}</Body>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Badge label={`+${m.reward_xp} XP`} color={colors.brandPrimary} textColor={colors.onBrandPrimary} />
              {m.card_reward_count > 0 ? <Badge label={`${m.card_reward_count} karta`} color={colors.rarityRare} textColor={colors.onBrand} /> : null}
              <Badge testID={`mission-status-${m.code}`} label={MISSION_STATUS_LABEL[m.user_status]} color={m.user_status === "completed" ? colors.success : colors.surfaceTertiary}
                textColor={m.user_status === "completed" ? colors.onSuccess : colors.onSurfaceTertiary} />
              <Text style={{ fontFamily: fonts.text, color: colors.muted, fontSize: 12 }}>{"★".repeat(m.difficulty)}</Text>
            </View>
          </Card>
        ))}
      </>
    );
  };

  const renderDuels = () => {
    if (!duels) return <Loading />;
    return (
      <>
        <Button testID="duel-new-button" title="Wyzwij Yummiteera" icon="sword-cross" onPress={() => router.push("/duel/new")} />
        {duels.length === 0 ? <EmptyState testID="duels-empty" icon="sword-cross" title="Brak pojedynków" text="Wyzwij kogoś albo włącz tryb pojedynków w ustawieniach." /> : null}
        {duels.map((d) => {
          const other = d.challenger_id === me ? d.opponent?.display_name : d.challenger?.display_name;
          const open = OPEN_DUEL_STATUSES.includes(d.status);
          return (
            <Card key={d.id} testID={`duel-card-${d.id}`} onPress={() => router.push(`/duel/${d.id}`)} accent={open ? colors.brandPrimary : undefined}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Title size={17}>vs {other ?? "Yummiteer"}</Title>
                {d.mode === "proximity" ? <Icon name="map-marker-radius" size={20} color={colors.brandPrimary} /> : null}
              </View>
              <Body muted>{DUEL_STATUS_LABEL[d.status]}{d.outcome ? ` · ${DUEL_OUTCOME_LABEL[d.outcome]}` : ""}{d.winner_id ? (d.winner_id === me ? " · Wygrana" : " · Przegrana") : ""}</Body>
            </Card>
          );
        })}
        <Title size={20} style={{ marginTop: spacing.md }}>Ranking pojedynków</Title>
        <Card testID="duel-leaderboard">
          {leaders.length === 0 ? <Body muted>Brak danych</Body> : leaders.map((l, i) => (
            <View key={l.user_id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Body style={{ flex: 1 }}>{i + 1}. {l.display_name}</Body>
              <Body muted>W {l.wins} · P {l.losses} · +{l.cards_won}/-{l.cards_lost} kart</Body>
            </View>
          ))}
        </Card>
      </>
    );
  };

  const renderHistory = () => {
    if (!history) return <Loading />;
    return (
      <>
        <Title size={18}>Ukończone misje</Title>
        {history.missions.length === 0 ? <Body muted>Jeszcze nic — czas na pierwszą misję!</Body> : history.missions.map((h) => (
          <Card key={h.id}><Body>{h.mission?.name} · +{h.xp} XP · kart: {h.cards?.length ?? 0}</Body><Body muted>{new Date(h.created_at).toLocaleString("pl-PL")}</Body></Card>
        ))}
        <Title size={18}>Historia kart</Title>
        {history.cards.map((h) => (
          <Card key={h.id}><Body>{({ granted: "Zdobyta", played_offense: "Zagrana (atak)", played_defense: "Zagrana (obrona)", lost: "Utracona", won: "Wygrana", consumed: "Zużyta" } as any)[h.action]} · {h.card?.name}</Body></Card>
        ))}
      </>
    );
  };

  return (
    <View testID="challenges-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Title size={28} style={{ flex: 1 }}>Wyzwania</Title>
        <IconButton testID="challenges-cards-button" icon="cards" onPress={() => router.push("/cards")} />
        <IconButton testID="challenges-specs-button" icon="shield-star" onPress={() => router.push("/specializations")} />
      </View>
      <ChipRow testID="challenges-segments">
        <Chip testID="seg-missions" label="Misje" selected={seg === "missions"} onPress={() => setSeg("missions")} />
        <Chip testID="seg-duels" label="Pojedynki" selected={seg === "duels"} onPress={() => setSeg("duels")} />
        <Chip testID="seg-history" label="Historia" selected={seg === "history"} onPress={() => setSeg("history")} />
      </ChipRow>
      {error ? <ErrorState message={error} onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}>
          {seg === "missions" ? renderMissions() : seg === "duels" ? renderDuels() : renderHistory()}
        </ScrollView>
      )}
    </View>
  );
}

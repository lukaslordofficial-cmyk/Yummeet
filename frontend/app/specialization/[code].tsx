import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Body, Card, Chip, ChipRow, EmptyState, ErrorState, Header, Loading, Title } from "@/src/components/ui";
import { MISSION_STATUS_LABEL } from "@/src/domain/rules";
import { errorMessage } from "@/src/lib/api";
import { getSpecializationHub, missionBoard, type SpecHub } from "@/src/lib/data";
import { spacing, useTheme } from "@/src/theme";
import type { BoardMission } from "@/src/types";

type Tab = "overview" | "missions" | "skills" | "history";

export default function SpecializationDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [hub, setHub] = useState<SpecHub | null>(null);
  const [board, setBoard] = useState<BoardMission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([getSpecializationHub(), missionBoard()]);
      setHub(h); setBoard(b); setError(null);
    } catch (e) { setError(errorMessage(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const spec = hub?.specializations.find((s) => s.code === code);
  const missions = useMemo(() => (board ?? []).filter((m) => m.specialization_code === code), [board, code]);
  const history = useMemo(() => missions.filter((m) => m.completions > 0 || m.user_status === "completed"), [missions]);

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Specjalizacja" /><ErrorState message={error} onRetry={load} /></View>;
  if (!hub || !board) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Specjalizacja" /><Loading /></View>;
  if (!spec) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Specjalizacja" /><EmptyState title="Nie znaleziono" text="Ta specjalizacja nie istnieje." /></View>;

  return (
    <View testID={`spec-detail-${code}`} style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={spec.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <ChipRow>
          {([["overview", "Przegląd"], ["missions", "Misje"], ["skills", "Skille"], ["history", "Historia"]] as const).map(([k, label]) => (
            <Chip key={k} testID={`spec-tab-${k}`} label={label} selected={tab === k} onPress={() => setTab(k)} />
          ))}
        </ChipRow>

        {tab === "overview" ? (
          <Card accent={spec.color}>
            <Title size={22}>{spec.name}</Title>
            <Body>{spec.description}</Body>
            <Body muted>PD {spec.pd} · poziom {spec.level} · ukończone misje {spec.missions_completed}</Body>
            <Body muted>Skille odblokowują się automatycznie od poziomu 2 specjalizacji (nie przez samo kliknięcie).</Body>
          </Card>
        ) : null}

        {tab === "missions" ? (
          missions.length === 0 ? <EmptyState title="Brak misji" text="Wkrótce pojawią się nowe wyzwania tej klasy." /> : missions.map((m) => (
            <Card key={m.mission_id} testID={`spec-mission-${m.code}`} onPress={() => router.push(`/mission/${m.mission_id}`)}>
              <Title size={16}>{m.name}</Title>
              <Body muted numberOfLines={2}>{m.description}</Body>
              <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                <Badge label={`+${m.reward_xp} PD/XP`} color={spec.color} textColor={colors.onBrand} />
                <Badge label={MISSION_STATUS_LABEL[m.user_status]} color={colors.surfaceTertiary} textColor={colors.onSurfaceTertiary} />
              </View>
            </Card>
          ))
        ) : null}

        {tab === "skills" ? (
          (spec.skills ?? []).map((sk) => (
            <Card key={sk.code} testID={`spec-skill-${sk.code}`} accent={spec.color} style={{ backgroundColor: `${spec.color}14` }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "flex-start" }}>
                <Title size={16} style={{ flex: 1, color: spec.color }}>{sk.name}</Title>
                <Badge
                  label={sk.status === "unlocked" ? "Odblokowany" : sk.status === "available" ? "Do odblokowania" : "Zablokowany"}
                  color={sk.status === "unlocked" ? spec.color : colors.surfaceTertiary}
                  textColor={sk.status === "unlocked" ? colors.onBrand : colors.onSurfaceTertiary}
                />
              </View>
              <Body>{sk.description}</Body>
              <Body muted>Wymagany poziom specjalizacji: {sk.unlock_level}</Body>
            </Card>
          ))
        ) : null}

        {tab === "history" ? (
          history.length === 0 ? <EmptyState title="Brak historii" text="Ukończ misję tej specjalizacji, by zobaczyć postęp." /> : history.map((m) => (
            <Card key={m.mission_id} testID={`spec-hist-${m.code}`} onPress={() => router.push(`/mission/${m.mission_id}`)}>
              <Title size={16}>{m.name}</Title>
              <Body muted>Ukończono {m.completions}× · +{m.reward_xp} PD za pierwsze przejście</Body>
            </Card>
          ))
        ) : null}
      </ScrollView>
    </View>
  );
}

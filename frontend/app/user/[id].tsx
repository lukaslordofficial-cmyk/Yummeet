import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { blockUser, duelInvite, getProfile, openDirect, profileStats, report } from "@/src/lib/data";
import { spacing, useTheme } from "@/src/theme";
import type { Profile } from "@/src/types";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  useEffect(() => { getProfile(id).then(setP).catch(() => setP(null)); profileStats(id).then(setStats).catch(() => {}); }, [id]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok, "success"); } catch (e) { toast(errorMessage(e), "error"); } };

  return (
    <View testID="user-profile-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Yummiteer" />
      {p === undefined ? <Loading /> : !p ? <Body muted style={{ padding: spacing.lg }}>Profil prywatny lub niedostępny.</Body> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          <Card>
            <Title size={24} testID="user-name">{p.display_name}</Title>
            <Body muted>Poziom {p.level} · {p.xp} XP</Body>
            {p.bio ? <Body>{p.bio}</Body> : null}
            {stats ? <Body muted>Misje {stats.missions_completed} · Pojedynki W{stats.duels_won}/P{stats.duels_lost} · Karty {stats.cards_owned}</Body> : <Body muted>Statystyki prywatne</Body>}
          </Card>
          <Button testID="user-duel-button" title="Wyzwij na pojedynek" icon="sword-cross" onPress={() => act(async () => router.push(`/duel/${await duelInvite(id)}`), "Wyzwanie wysłane")} />
          <Button testID="user-message-button" title="Napisz" icon="chat" variant="secondary" onPress={() => act(async () => router.push(`/chat/${await openDirect(id)}`))} />
          <Button testID="user-block-button" title="Zablokuj" variant="ghost" onPress={() => act(async () => { await blockUser(id); router.back(); }, "Zablokowano")} />
          <Button testID="user-report-button" title="Zgłoś profil" variant="ghost" onPress={() => act(() => report("profile", id, "profile_issue"), "Zgłoszenie wysłane")} />
        </ScrollView>
      )}
    </View>
  );
}

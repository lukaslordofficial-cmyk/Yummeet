import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Stars } from "@/src/components/Stars";
import { Body, Button, Card, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { blockUser, getProfile, openDirect, organizerRating, profileStats, report, type OrganizerRating } from "@/src/lib/data";
import { fonts, spacing, useTheme } from "@/src/theme";
import type { Profile } from "@/src/types";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [orgRating, setOrgRating] = useState<OrganizerRating | null>(null);
  useEffect(() => {
    getProfile(id).then(setP).catch(() => setP(null));
    profileStats(id).then(setStats).catch(() => {});
    organizerRating(id).then(setOrgRating).catch(() => setOrgRating(null));
  }, [id]);

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
            {stats ? <Body muted>Spotkania {stats.events_attended ?? 0} · Pojedynki W{stats.duels_won}/P{stats.duels_lost} · Karty {stats.cards_owned}</Body> : <Body muted>Statystyki prywatne</Body>}
          </Card>
          <Card testID="user-organizer-rating">
            <Title size={18}>Ocena organizatora</Title>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Title size={36} style={{ fontFamily: fonts.display, color: colors.brandPrimary }}>{orgRating?.summary?.yummeet_score ?? "–"}</Title>
              <View>
                <Stars testID="user-organizer-stars" value={Number(orgRating?.summary?.yummeet_score ?? 0)} size={22} />
                <Body muted>{orgRating?.summary?.review_count ?? 0} opinii</Body>
              </View>
            </View>
            {orgRating?.summary ? (
              <>
                <Body muted>Gościnność {orgRating.summary.hospitality} · Organizacja {orgRating.summary.organization}</Body>
                <Body muted>Atmosfera {orgRating.summary.atmosphere} · Kontakt {orgRating.summary.communication}</Body>
              </>
            ) : <Body muted>Jeszcze nikt nie ocenił tego organizatora.</Body>}
            {(orgRating?.reviews ?? []).map((rv) => (
              <Card key={rv.id} testID={`user-org-review-${rv.id}`}>
                <Title size={15}>{rv.author ?? "Yummiteer"}{rv.event_title ? ` · ${rv.event_title}` : ""}</Title>
                <Stars testID={`user-org-review-stars-${rv.id}`} value={(rv.hospitality + rv.organization + rv.atmosphere + rv.communication) / 4} size={16} />
                {rv.tip ? <Body>{rv.tip}</Body> : null}
              </Card>
            ))}
          </Card>
          <Body muted>Pojedynki tylko automatycznie w pobliżu (tryb pojedynków) — max raz na tydzień z tą samą osobą.</Body>
          <Button testID="user-message-button" title="Napisz" icon="chat" variant="secondary" onPress={() => act(async () => router.push(`/chat/${await openDirect(id)}`))} />
          <Button testID="user-block-button" title="Zablokuj" variant="ghost" onPress={() => act(async () => { await blockUser(id); router.back(); }, "Zablokowano")} />
          <Button testID="user-report-button" title="Zgłoś profil" variant="ghost" onPress={() => act(() => report("profile", id, "profile_issue"), "Zgłoszenie wysłane")} />
        </ScrollView>
      )}
    </View>
  );
}

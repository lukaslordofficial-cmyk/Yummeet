import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { openTutorial } from "@/src/components/AppTutorial";
import { Icon } from "@/src/components/Icon";
import { Stars } from "@/src/components/Stars";
import { Body, Button, Card, IconButton, Title } from "@/src/components/ui";
import { levelProgress } from "@/src/domain/rules";
import { CULINARY_LEVELS } from "@/src/lib/culinaryProfile";
import { getLevels, getSpecializationHub, getSpecializations, myBadges, organizerRating, profileStats, type OrganizerRating, type SpecHub } from "@/src/lib/data";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import type { LevelDef, Specialization } from "@/src/types";

const STAT_LABELS: [string, string][] = [
  ["missions_completed", "Misje"], ["visited_places", "Odwiedzone lokale"], ["events_attended", "Spotkania"], ["meals_exchanged", "Wymienione posiłki"],
  ["cards_owned", "Karty"], ["duels_won", "Wygrane pojedynki"], ["duels_lost", "Przegrane"], ["pins_created", "Piny"], ["travel_km", "Km podróży"],
];

export default function ProfileTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, refreshProfile, signOut, session } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [levels, setLevels] = useState<LevelDef[]>([]);
  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [hub, setHub] = useState<SpecHub | null>(null);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [orgRating, setOrgRating] = useState<OrganizerRating | null>(null);

  useFocusEffect(useCallback(() => {
    refreshProfile();
    Promise.all([
      getLevels(), getSpecializations(), getSpecializationHub(),
      session ? profileStats(session.user.id) : null, myBadges(),
      session ? organizerRating(session.user.id).catch(() => null) : null,
    ]).then(([l, s, h, st, b, org]) => {
      setLevels(l); setSpecs(s); setHub(h); setStats(st); setBadges(b); setOrgRating(org);
    }).catch(() => {});
  }, [refreshProfile, session]));

  const mainCode = hub?.main && hub.main !== "__versatile__" ? hub.main : profile?.primary_specialization;
  const spec = specs.find((s) => s.code === mainCode) ?? specs.find((s) => s.code === hub?.preferred);
  const banner = spec?.color ?? colors.brandPrimary;
  const lp = levelProgress(profile?.xp ?? 0, levels);
  const culinary = CULINARY_LEVELS.find((l) => l.level === profile?.culinary_skill_level);
  const unlockedSkills = (hub?.specializations ?? []).flatMap((s) => (s.skills ?? []).filter((sk) => sk.status === "unlocked").map((sk) => ({ ...sk, spec: s.name })));

  return (
    <ScrollView testID="profile-screen" style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}>
      <View style={{ backgroundColor: banner, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, gap: spacing.md }}>
        <IconButton testID="header-back-button" icon="arrow-left" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSecondary, borderWidth: 4, borderColor: colors.rarityLegendary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 34, color: banner }}>{(profile?.display_name ?? "Y").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text testID="profile-name" style={{ fontFamily: fonts.display, fontSize: 26, color: colors.onBrand }}>{profile?.display_name ?? "Yummiteer"}</Text>
            <Text testID="profile-spec" style={{ fontFamily: fonts.text, fontSize: 14, color: colors.onBrand }}>
              {hub?.main_label ?? (spec ? spec.name : "Nowicjusz")}
            </Text>
            {hub?.preferred ? (
              <Text style={{ fontFamily: fonts.text, fontSize: 12, color: colors.onBrand }}>
                Preferowana: {specs.find((s) => s.code === hub.preferred)?.name ?? hub.preferred}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "center" }}>
            <Text testID="profile-level" style={{ fontFamily: fonts.display, fontSize: 32, color: colors.onBrand }}>{profile?.level ?? 1}</Text>
            <Text style={{ fontFamily: fonts.text, fontSize: 11, color: colors.onBrand }}>poziom</Text>
          </View>
        </View>
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fonts.display, color: colors.onBrand }}>{lp.current.name}</Text>
            <Text testID="profile-xp" style={{ fontFamily: fonts.display, color: colors.onBrand }}>{profile?.xp ?? 0} XP{lp.next ? ` / ${lp.next.min_xp}` : ""}</Text>
          </View>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: spacing.xs }}>
            <View style={{ width: `${Math.round((Number.isFinite(lp.progress) ? lp.progress : 0) * 100)}%`, height: "100%", backgroundColor: colors.brandSecondary }} />
          </View>
        </View>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Button testID="profile-cards-button" title="Księga kart" icon="book-open-variant" style={{ flex: 1 }} onPress={() => router.push("/cards")} />
          <Button testID="profile-spec-button" title="Specjalizacje" icon="shield-star" variant="secondary" onPress={() => router.push("/specializations")} />
        </View>
        <Button testID="profile-culinary-button" title="Profil kulinarny" icon="chef-hat" variant="ghost" onPress={() => router.push("/profile/culinary")} />

        {hub ? (
          <>
            <Title size={20}>Postęp specjalizacji</Title>
            {(hub.specializations ?? []).map((s) => (
              <Card key={s.code} testID={`profile-spec-progress-${s.code}`} onPress={() => router.push(`/specialization/${s.code}`)}>
                <Title size={16}>{s.name}</Title>
                <Body muted>PD {s.pd} · poziom {s.level} · misje {s.missions_completed}</Body>
              </Card>
            ))}
            <Title size={20}>Odblokowane skille</Title>
            {unlockedSkills.length === 0 ? <Body muted>Skille odblokują się od poziomu 2 danej specjalizacji.</Body> : unlockedSkills.map((sk) => {
              const sc = hub?.specializations.find((s) => s.name === sk.spec);
              return (
                <Card key={sk.code} testID={`profile-skill-${sk.code}`} accent={sc?.color} style={sc?.color ? { backgroundColor: `${sc.color}14` } : undefined}>
                  <Title size={15} style={sc?.color ? { color: sc.color } : undefined}>{sk.name}</Title>
                  <Body muted>{sk.spec}</Body>
                </Card>
              );
            })}
          </>
        ) : null}

        {culinary || profile?.signature_dish ? (
          <Card testID="profile-culinary-summary">
            <Title size={16}>Kuchnia Yummitera</Title>
            {culinary ? <Body>{culinary.emoji} {culinary.title}</Body> : null}
            {profile?.signature_dish ? <Body muted>Popisowe: {profile.signature_dish}</Body> : null}
            {profile?.diet_style ? <Body muted>Dieta: {profile.diet_style}</Body> : null}
          </Card>
        ) : null}

        <Card testID="profile-organizer-rating">
          <Title size={16}>Ocena jako organizator</Title>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary }}>{orgRating?.summary?.yummeet_score ?? "–"}</Text>
            <View>
              <Stars testID="profile-organizer-stars" value={Number(orgRating?.summary?.yummeet_score ?? 0)} size={20} />
              <Body muted>{orgRating?.summary?.review_count ?? 0} opinii ze spotkań</Body>
            </View>
          </View>
        </Card>
        <Button testID="profile-tutorial-button" title="Samouczek Yummeet" icon="play-circle-outline" variant="ghost" onPress={() => openTutorial()} />
        <Title size={20}>Statystyki</Title>
        <View testID="profile-stats" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {STAT_LABELS.map(([k, label]) => (
            <View key={k} style={{ width: "30%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.brandPrimary }}>{stats?.[k] ?? 0}</Text>
              <Body muted style={{ fontSize: 12 }}>{label}</Body>
            </View>
          ))}
        </View>
        <Title size={20}>Odznaki</Title>
        <View testID="profile-badges" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {badges.map((b) => (
            <View key={b.code} testID={`badge-${b.code}`} style={{ width: 96, alignItems: "center", gap: spacing.xs, opacity: b.owned ? 1 : 0.35 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: b.owned ? colors.rarityLegendary : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name={b.icon} size={28} color={colors.onSurface} />
              </View>
              <Body style={{ fontSize: 12, textAlign: "center" }} numberOfLines={2}>{b.name}</Body>
            </View>
          ))}
        </View>
        <Card testID="profile-settings-card" onPress={() => router.push("/settings")} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Icon name="shield-account" size={26} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}><Title size={16}>Preferencje, prywatność i bezpieczeństwo</Title><Body muted>Widoczność, tryb pojedynków, blokady, dieta</Body></View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Card>
        <Card testID="profile-games-card" onPress={() => router.push("/games")} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Icon name="dice-multiple" size={26} color={colors.brandSecondary} />
          <View style={{ flex: 1 }}><Title size={16}>Atrakcje</Title><Body muted>Pytania, gry i wyzwania przy stole</Body></View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Card>
        <Button testID="profile-logout-button" title="Wyloguj się" variant="ghost" icon="logout" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Badge, Body, Button, Card, ErrorState, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { getSpecializationHub, invalidateSpecCache, setPreferredSpecialization, type SpecHub } from "@/src/lib/data";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

export default function Specializations() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { refreshProfile } = useAuth();
  const [hub, setHub] = useState<SpecHub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      invalidateSpecCache();
      setHub(await getSpecializationHub());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setPreferred = async (code: string | null) => {
    setBusy(true);
    try {
      await setPreferredSpecialization(code);
      await refreshProfile();
      toast(code ? "Preferowana specjalizacja zapisana" : "Preferencja wyczyszczona", "success");
      await load();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="specializations-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Specjalizacje" />
      {error ? <ErrorState message={error} onRetry={load} /> : !hub ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          <Card testID="spec-main-card" accent={colors.brandPrimary}>
            <Title size={18}>Główna specjalizacja</Title>
            <Body>{hub.main_label}</Body>
          </Card>
          {hub.specializations.map((s) => {
            const isPref = hub.preferred === s.code;
            const isMain = hub.main === s.code;
            return (
              <Card key={s.code} testID={`spec-card-${s.code}`} accent={isPref ? s.color : undefined} onPress={() => router.push(`/specialization/${s.code}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: s.color, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={s.icon} size={28} color={colors.onBrand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Title size={17}>{s.name}</Title>
                    <Body muted numberOfLines={3}>{s.description}</Body>
                    <Body muted>PD {s.pd} · poz. {s.level} · misje {s.missions_completed}</Body>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
                  {isMain ? <Badge label="GŁÓWNA (z PD)" color={s.color} textColor={colors.onBrand} /> : null}
                  {isPref ? <Badge label="PREFEROWANA" color={colors.brandSecondary} textColor={colors.onBrand} /> : (
                    <Button testID={`spec-prefer-${s.code}`} title="Ustaw preferowaną" variant="ghost" loading={busy} onPress={() => void setPreferred(s.code)} />
                  )}
                  <Button testID={`spec-open-${s.code}`} title="Misje i skille" variant="secondary" onPress={() => router.push(`/specialization/${s.code}`)} />
                </View>
              </Card>
            );
          })}
          {hub.preferred ? (
            <Button testID="spec-clear-preferred" title="Wyczyść preferencję" variant="ghost" loading={busy} onPress={() => void setPreferred(null)} />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

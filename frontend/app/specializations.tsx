import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Badge, Body, Button, Card, ErrorState, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { chooseSpecialization, getSpecializations, myInterests } from "@/src/lib/data";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";
import type { Specialization } from "@/src/types";

export default function Specializations() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const [specs, setSpecs] = useState<Specialization[] | null>(null);
  const [primary, setPrimary] = useState<string | null>(profile?.primary_specialization ?? null);
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getSpecializations(), myInterests()]).then(([s, i]) => { setSpecs(s); setInterests(i); }).catch((e) => setError(errorMessage(e)));
  }, []);

  const save = async () => {
    if (!primary) return toast("Wybierz klasę główną", "error");
    setBusy(true);
    try { await chooseSpecialization(primary, interests.filter((i) => i !== primary)); await refreshProfile(); toast("Klasa postaci zapisana!", "success"); router.back(); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <View testID="specializations-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Klasy postaci" />
      {error ? <ErrorState message={error} /> : !specs ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          <Body muted>Klasa główna odblokowuje wszystkie jej misje. Z innych klas zobaczysz losowe 25% misji. Zainteresowania wpływają na rekomendacje.</Body>
          {specs.map((s) => {
            const isPrimary = primary === s.code;
            const isInterest = interests.includes(s.code);
            return (
              <Card key={s.code} testID={`spec-card-${s.code}`} accent={isPrimary ? s.color : undefined}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: s.color, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={s.icon} size={28} color={colors.onBrand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Title size={17}>{s.name}</Title>
                    <Body muted>{s.description}</Body>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  {isPrimary ? <Badge label="KLASA GŁÓWNA" color={s.color} textColor={colors.onBrand} /> : (
                    <Button testID={`spec-primary-${s.code}`} title="Ustaw jako główną" variant="ghost" onPress={() => setPrimary(s.code)} />
                  )}
                  {!isPrimary ? <Button testID={`spec-interest-${s.code}`} title={isInterest ? "✓ Zainteresowanie" : "+ Zainteresowanie"} variant={isInterest ? "secondary" : "ghost"}
                    onPress={() => setInterests(isInterest ? interests.filter((i) => i !== s.code) : [...interests, s.code])} /> : null}
                </View>
              </Card>
            );
          })}
          <Button testID="spec-save-button" title="Zapisz" loading={busy} onPress={save} />
        </ScrollView>
      )}
    </View>
  );
}

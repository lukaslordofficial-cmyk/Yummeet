import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, EmptyState, Header } from "@/src/components/ui";
import { spacing, useTheme } from "@/src/theme";

/** Ręczne wyzwania wyłączone — tylko proximity (w pobliżu). */
export default function NewDuel() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View testID="new-duel-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Pojedynki" />
      <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <EmptyState
          testID="duel-invite-disabled"
          icon="map-marker-radius"
          title="Tylko w pobliżu"
          text="Nie można ręcznie wyzwać Yummitera. Włącz tryb pojedynków w ustawieniach — pojedynek startuje automatycznie, gdy ktoś z włączonym trybem jest blisko (max raz na tydzień ta sama para)."
        />
        <Body muted style={{ marginTop: spacing.md }}>Ranking w zakładce Pojedynki pokazuje tylko osoby w promieniu 20 km.</Body>
      </View>
    </View>
  );
}

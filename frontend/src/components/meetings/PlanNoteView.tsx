import { Text, View } from "react-native";

import { Body } from "@/src/components/ui";
import { isActivityParagraph } from "@/src/lib/meetingPlan";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

/** Akapit „Organizator przeprowadzi…” jest czarny na pomarańczowym tle. */
export function PlanNoteView({ body, testID }: { body: string; testID?: string }) {
  const { colors } = useTheme();
  const parts = body.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  return (
    <View testID={testID} style={{ gap: spacing.lg, width: "100%", marginTop: spacing.sm }}>
      {parts.map((part, index) => isActivityParagraph(part) ? (
        <View key={`${index}-${part.slice(0, 24)}`} style={{ backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: colors.onBrandPrimary, textAlign: "center" }}>{part}</Text>
        </View>
      ) : (
        <Body key={`${index}-${part.slice(0, 24)}`} style={{ textAlign: "center" }}>{part}</Body>
      ))}
    </View>
  );
}

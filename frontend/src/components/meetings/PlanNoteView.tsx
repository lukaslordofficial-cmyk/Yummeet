import { Text, View } from "react-native";

import { Body } from "@/src/components/ui";
import { isActivityParagraph } from "@/src/lib/meetingPlan";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

/** Nazwa zabawy: biały tekst na czarnym tle. */
export function ActivityName({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.onBrandPrimary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: colors.onBrandSecondary, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

export function PlanNoteView({ body, hideQuestions, testID }: { body: string; hideQuestions?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const parts = body.split(/\n\n+/).map((part) => part.trim()).filter(Boolean)
    .filter((part) => !hideQuestions || !part.startsWith("• "));
  return (
    <View testID={testID} style={{ gap: spacing.lg, width: "100%", marginTop: spacing.sm }}>
      {parts.map((part, index) => isActivityParagraph(part) ? (
        <ActivityName key={`${index}-${part.slice(0, 24)}`}>{part}</ActivityName>
      ) : (
        <Body key={`${index}-${part.slice(0, 24)}`} style={{ textAlign: "center", color: part.startsWith("• ") ? colors.onSurface : undefined }}>{part}</Body>
      ))}
    </View>
  );
}

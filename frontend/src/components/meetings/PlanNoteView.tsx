import { Text, View } from "react-native";

import { Body } from "@/src/components/ui";
import { isActivityParagraph } from "@/src/lib/meetingPlan";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

/** Akapit „Organizator przeprowadzi…” — czarna czcionka na pomarańczowym tle. */
export function ActivityName({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: colors.onBrandPrimary, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

/** Wpisany opis aktywności — biała czcionka na czarnym tle. */
export function ActivityBody({ children }: { children: string }) {
  return (
    <View style={{ backgroundColor: "#000000", borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
      <Text style={{ fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: "#FFFFFF", textAlign: "center" }}>{children}</Text>
    </View>
  );
}

function groupPlanParts(parts: string[], headings: string[]) {
  const groups: { title?: string; rest: string[] }[] = [];
  for (const part of parts) {
    if (isActivityParagraph(part, headings)) {
      groups.push({ title: part, rest: [] });
    } else if (groups.length && groups[groups.length - 1].title) {
      groups[groups.length - 1].rest.push(part);
    } else {
      groups.push({ rest: [part] });
    }
  }
  return groups;
}

export function PlanNoteView({ body, hideQuestions, headings = [], testID }: { body: string; hideQuestions?: boolean; headings?: string[]; testID?: string }) {
  const { colors } = useTheme();
  const parts = body.split(/\n\n+/).map((part) => part.trim()).filter(Boolean)
    .filter((part) => !hideQuestions || !part.startsWith("• "));
  const groups = groupPlanParts(parts, headings);
  return (
    <View testID={testID} style={{ gap: spacing.xxxl, width: "100%", marginTop: spacing.md }}>
      {groups.map((group, index) => (
        <View key={`${index}-${(group.title ?? group.rest[0] ?? "").slice(0, 24)}`} style={{ gap: spacing.xxl, width: "100%" }}>
          {group.title ? <ActivityName>{group.title}</ActivityName> : null}
          {group.rest.map((part) => (
            <Body key={part.slice(0, 48)} style={{ textAlign: "center", color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>{part}</Body>
          ))}
        </View>
      ))}
    </View>
  );
}

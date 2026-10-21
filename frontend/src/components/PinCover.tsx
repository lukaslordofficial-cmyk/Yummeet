import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/src/components/ui";
import { cuisineLabel } from "@/src/lib/cuisines";
import { fonts, spacing, useTheme } from "@/src/theme";

/** Duże zdjęcie lokalu z nazwą na dole, jak w karcie restauracji. */
export function PinCover({
  title,
  cuisine,
  coverUrl,
  right,
}: {
  title: string;
  cuisine?: string | null;
  coverUrl?: string | null;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={{ height: 300, backgroundColor: colors.surfaceTertiary }}>
      {coverUrl ? (
        <Image testID="pin-cover-image" source={{ uri: coverUrl }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} contentFit="cover" />
      ) : null}
      <LinearGradient
        colors={["transparent", colors.surface]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 170 }}
      />
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <IconButton testID="header-back-button" icon="arrow-left" tone="sheet" onPress={back} />
        {right}
      </View>
      <View style={{ flex: 1, justifyContent: "flex-end", padding: spacing.lg, gap: 4 }}>
        {cuisine ? (
          <Text style={{ fontFamily: fonts.text, fontSize: 13, color: colors.brandPrimary }}>{cuisineLabel(cuisine)}</Text>
        ) : null}
        <Text testID="pin-hero-title" style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.onSurface }}>{title}</Text>
      </View>
    </View>
  );
}

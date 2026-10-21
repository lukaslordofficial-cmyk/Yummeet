import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { cuisineLabel } from "@/src/lib/cuisines";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import type { PinMarker } from "@/src/types";

/** Jasna karta lokalu nad mapą: zdjęcie, nazwa i dwie akcje. */
export function DiscoverPlaceCard({
  pin,
  onOpen,
  onFocus,
}: {
  pin: PinMarker;
  onOpen: () => void;
  onFocus: () => void;
}) {
  const { colors } = useTheme();
  const cuisine = cuisineLabel(pin.cuisine);
  const score = pin.score != null ? `${pin.score}` : "brak ocen";
  return (
    <View
      testID="discover-place-card"
      style={{
        backgroundColor: colors.sheet,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        {pin.cover_url ? (
          <Image source={{ uri: pin.cover_url }} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="cover" />
        ) : (
          <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="silverware-fork-knife" size={26} color={colors.onBrandTertiary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.onSheet }}>{pin.title}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: colors.sheetMuted }}>
            {cuisine} · {score}{pin.review_count ? ` · ${pin.review_count} ocen` : ""}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          testID="discover-place-focus"
          accessibilityRole="button"
          onPress={onFocus}
          style={{ flex: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.sheetMuted, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.onSheet }}>Pokaż na mapie</Text>
        </Pressable>
        <Pressable
          testID="discover-place-open"
          accessibilityRole="button"
          onPress={onOpen}
          style={{ flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.onSurface }}>Menu i opinie</Text>
        </Pressable>
      </View>
    </View>
  );
}

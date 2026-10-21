import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import { cardArtSource } from "@/src/lib/cardArt";
import { fonts, radius, rarityColor, spacing, useTheme } from "@/src/theme";
import type { CardDef } from "@/src/types";
import { Icon } from "./Icon";
import { haptic } from "./ui";

const KIND_LABEL = { offensive: "Ofensywna", defensive: "Defensywna", special: "Specjalna" } as const;
const KIND_ICON = { offensive: "sword", defensive: "shield-half-full", special: "star-four-points" } as const;
const RARITY_LABEL: Record<string, string> = { common: "Zwykła", rare: "Rzadka", epic: "Epicka", legendary: "Legendarna" };

/** Pełna grafika karty — contain, bez ucięcia artworku. */
export function GameCard({
  card,
  owned = true,
  count,
  onPress,
  testID,
  compact,
  fullArt,
}: {
  card: CardDef;
  owned?: boolean;
  count?: number;
  onPress?: () => void;
  testID: string;
  compact?: boolean;
  /** Całe okienko = artwork (bez dolnego bloku tekstu na karcie). */
  fullArt?: boolean;
}) {
  const { colors } = useTheme();
  const rc = rarityColor(colors, card.rarity);
  const artH = fullArt ? undefined : compact ? 140 : 180;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic.medium();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: radius.lg,
        borderWidth: 3,
        borderColor: rc,
        backgroundColor: colors.surfaceSecondary,
        overflow: "hidden",
        opacity: owned ? 1 : 0.45,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        ...(fullArt ? { aspectRatio: 0.72, minHeight: 280 } : {}),
      })}
    >
      <View style={{ height: artH, flex: fullArt ? 1 : undefined, backgroundColor: "#1a1510" }}>
        {cardArtSource(card.art_key || card.code) ? (
          <Image
            source={cardArtSource(card.art_key || card.code)!}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        ) : null}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: fullArt ? 90 : 56 }}
        />
        <View
          style={{
            position: "absolute",
            top: spacing.sm,
            left: spacing.sm,
            backgroundColor: rc,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 11, color: colors.onBrand }}>{RARITY_LABEL[card.rarity]}</Text>
        </View>
        {count && count > 1 ? (
          <View
            style={{
              position: "absolute",
              top: spacing.sm,
              right: spacing.sm,
              backgroundColor: colors.surfaceInverse,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.sm,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.onSurfaceInverse }}>×{count}</Text>
          </View>
        ) : null}
        <View
          style={{
            position: "absolute",
            bottom: spacing.sm,
            left: spacing.sm,
            right: spacing.sm,
            gap: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name={KIND_ICON[card.kind]} size={14} color={colors.onBrand} />
            <Text style={{ fontFamily: fonts.text, fontSize: 11, color: colors.onBrand }}>{KIND_LABEL[card.kind]}</Text>
          </View>
          <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: fullArt ? 18 : 14, color: "#fff" }}>
            {card.name}
          </Text>
        </View>
      </View>
      {!fullArt && !compact ? (
        <View style={{ padding: spacing.md, gap: 4 }}>
          <Text numberOfLines={3} style={{ fontFamily: fonts.text, fontSize: 12, color: colors.muted }}>
            {card.lore || card.challenge_text || card.effect}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export { KIND_LABEL, RARITY_LABEL };

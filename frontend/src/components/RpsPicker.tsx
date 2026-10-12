import { Pressable, Text, View } from "react-native";

import { fonts, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "./Icon";
import { haptic } from "./ui";

const MOVES = [
  { key: "rock", label: "Kamień", icon: "hand-back-left" },
  { key: "paper", label: "Papier", icon: "note-outline" },
  { key: "scissors", label: "Nożyce", icon: "content-cut" },
] as const;
export const MOVE_LABEL: Record<string, string> = { rock: "Kamień", paper: "Papier", scissors: "Nożyce" };

export function RpsPicker({ onPick, disabled }: { onPick: (m: string) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {MOVES.map((m) => (
        <Pressable key={m.key} testID={`rps-${m.key}-button`} disabled={disabled}
          onPress={() => { haptic.heavy(); onPick(m.key); }}
          style={({ pressed }) => ({ flex: 1, aspectRatio: 0.85, borderRadius: radius.lg, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
            gap: spacing.sm, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.92 : 1 }],
            borderBottomWidth: 6, borderBottomColor: colors.onBrandTertiary })}>
          <Icon name={m.icon} size={40} color={colors.onBrandPrimary} />
          <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.onBrandPrimary }}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

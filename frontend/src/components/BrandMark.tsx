import { View } from "react-native";

import { useTheme } from "@/src/theme";

/** Znak Yummeet: pinezka spotkania i miodowa kropka wspólnego stołu. */
export function BrandMark({ size = 88 }: { size?: number }) {
  const { colors } = useTheme();
  const pin = Math.round(size * 0.78);
  const dot = Math.round(size * 0.36);
  const ring = Math.max(3, Math.round(size * 0.045));
  return (
    <View testID="brand-mark" accessibilityRole="image" accessibilityLabel="Yummeet" style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: Math.round(size * 0.04),
          width: pin,
          height: pin,
          borderRadius: pin / 2,
          backgroundColor: colors.brandPrimary,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.brandTertiary,
          borderWidth: ring,
          borderColor: colors.surface,
        }}
      />
    </View>
  );
}

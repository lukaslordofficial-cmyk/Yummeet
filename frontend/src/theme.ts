// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#100E0C",
  onSurface: "#F6F1EA",
  surfaceSecondary: "#1C1916",
  onSurfaceSecondary: "#F6F1EA",
  surfaceTertiary: "#2A2622",
  onSurfaceTertiary: "#F6F1EA",
  surfaceInverse: "#F7F3EE",
  onSurfaceInverse: "#1A1612",
  sheet: "#FFF8F1",
  onSheet: "#1C1612",
  sheetMuted: "#6E6258",
  brand: "#E6A04A",
  onBrand: "#1A120C",
  brandPrimary: "#E6A04A",
  onBrandPrimary: "#1A120C",
  brandSecondary: "#1F7A45",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#3A2E22",
  onBrandTertiary: "#F6D7A8",
  success: "#7DDEA4",
  onSuccess: "#102116",
  warning: "#E6A04A",
  onWarning: "#1A120C",
  error: "#E15A4A",
  onError: "#FFFFFF",
  info: "#7DCEC4",
  onInfo: "#10211F",
  border: "#3A332C",
  borderStrong: "#52483F",
  divider: "#2A2622",
  muted: "#B3A79C",
  rarityCommon: "#A39890",
  rarityRare: "#7DDEA4",
  rarityEpic: "#E15A4A",
  rarityLegendary: "#E6A04A",
  classFoodie: "#E6A04A",
  classCritic: "#F6F1EA",
  classSommelier: "#E15A4A",
  classHunter: "#7DDEA4",
  classSocialite: "#E6A04A",
  classChef: "#D7B899",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}



/** Window and system-nav color. Same value as `light.surface`. */
export const windowBackground = light.surface;

/** React Navigation chrome. Keys match DarkTheme.colors. */
export const navigationColors = {
  primary: light.brandPrimary,
  background: light.surface,
  card: light.surface,
  text: light.onSurface,
  border: light.border,
  notification: light.error,
};

export const fonts = { display: "PlusJakartaSemi", text: "PlusJakarta" } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const rarityColor = (c: ThemeColors, r: string) =>
  r === "legendary" ? c.rarityLegendary : r === "epic" ? c.rarityEpic : r === "rare" ? c.rarityRare : c.rarityCommon;

import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { ReactNode } from "react";
import { Dimensions, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { useDuelPresence } from "@/src/hooks/useDuelPresence";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, useTheme } from "@/src/theme";

const VISIBLE_TABS = [
  { name: "index", label: "Odkrywaj", icon: "map-search", sf: "map.fill" },
  { name: "tables", label: "Spotkania", icon: "account-group", sf: "person.3.fill" },
  { name: "dates", label: "Randki", icon: "heart-outline", sf: "heart.fill" },
] as const;

const HIDDEN_TABS = ["food", "challenges", "route"] as const;
const HIDDEN_TAB_NAMES = new Set<string>(HIDDEN_TABS);

function AppTabBar({
  state,
  descriptors,
  navigation,
}: {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  descriptors: Record<string, { options: { title?: string; href?: unknown; tabBarButtonTestID?: string; tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode } }>;
  navigation: { emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const shortest = Math.min(Dimensions.get("window").width, Dimensions.get("window").height);
  const isTablet = shortest >= 600;
  // Telefon z gestami: zero paddingu. Tablet ma własny pasek systemowy i potrzebuje insets.bottom, żeby ikony nie weszły pod przyciski.
  const bottomPad = Platform.OS === "ios" || isTablet ? insets.bottom : 0;
  const focusedKey = state.routes[state.index]?.key;
  const routes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    return !!options && options.href !== null && !HIDDEN_TAB_NAMES.has(route.name);
  });
  return (
    <View style={{ backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, paddingBottom: bottomPad }}>
      <View style={{ height: 56, flexDirection: "row" }}>
        {routes.map((route) => {
          const options = descriptors[route.key]?.options;
          if (!options) return null;
          const focused = focusedKey === route.key;
          const color = focused ? colors.brandPrimary : colors.muted;
          return (
            <Pressable
              key={route.key}
              testID={options.tabBarButtonTestID}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 4 }}
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color, fontFamily: fonts.display, fontSize: 11, textAlign: "center" }}>{options.title ?? route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  useDuelPresence(!!profile?.duel_mode_enabled);

  if (usesNativeTabs) {
    return (
      <NativeTabs
        tintColor={colors.brandPrimary}
        backgroundColor={colors.surface}
        blurEffect="none"
        iconColor={{ default: colors.muted, selected: colors.brandPrimary }}
        labelStyle={{
          default: { color: colors.muted, fontSize: 11 },
          selected: { color: colors.brandPrimary, fontSize: 11 },
        }}
      >
        {VISIBLE_TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
        {HIDDEN_TABS.map((name) => (
          <NativeTabs.Trigger key={name} name={name} hidden />
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brandPrimary,
      tabBarInactiveTintColor: colors.muted,
    }}>
      {VISIBLE_TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.label,
          tabBarButtonTestID: `tab-${t.name}`,
          tabBarIcon: ({ color }) => <Icon name={t.icon} size={24} color={color as string} />,
        }} />
      ))}
      {HIDDEN_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

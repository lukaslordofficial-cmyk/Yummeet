import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { Icon } from "@/src/components/Icon";
import { useDuelPresence } from "@/src/hooks/useDuelPresence";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, useTheme } from "@/src/theme";

const VISIBLE_TABS = [
  { name: "index", label: "Odkrywaj", icon: "map-search", sf: "map.fill" },
  { name: "tables", label: "Spotkania", icon: "account-group", sf: "person.3.fill" },
  { name: "route", label: "Gastro-Trasa", icon: "map-marker-path", sf: "point.topleft.down.to.point.bottomright.curvepath" },
] as const;

const HIDDEN_TABS = ["food", "challenges"] as const;

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
      screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brandPrimary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: 56,
        paddingTop: 4,
        paddingBottom: 2,
      },
      tabBarItemStyle: { paddingTop: 0, paddingBottom: 0 },
      tabBarLabelStyle: { fontFamily: fonts.display, fontSize: 11 },
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

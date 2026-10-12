import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { Icon } from "@/src/components/Icon";
import { useDuelPresence } from "@/src/hooks/useDuelPresence";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, useTheme } from "@/src/theme";

const TABS = [
  { name: "index", label: "Odkrywaj", icon: "map-search", sf: "map.fill" },
  { name: "tables", label: "Stoły", icon: "table-chair", sf: "fork.knife" },
  { name: "challenges", label: "Wyzwania", icon: "sword-cross", sf: "flag.checkered" },
  { name: "chats", label: "Czaty", icon: "chat-processing", sf: "bubble.left.and.bubble.right.fill" },
  { name: "profile", label: "Profil", icon: "account-circle", sf: "person.crop.circle.fill" },
] as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  useDuelPresence(!!profile?.duel_mode_enabled);

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brandPrimary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
      tabBarItemStyle: { alignSelf: "center" },
      tabBarLabelStyle: { fontFamily: fonts.text, fontSize: 11 },
    }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.label,
          tabBarButtonTestID: `tab-${t.name}`,
          tabBarIcon: ({ color }) => <Icon name={t.icon} size={24} color={color as string} />,
        }} />
      ))}
    </Tabs>
  );
}

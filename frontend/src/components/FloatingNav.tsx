import { usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/chats", icon: "chat-processing", testID: "tab-chats", match: "/chats" },
  { href: "/profile", icon: "account-circle", testID: "tab-profile", match: "/profile" },
] as const;

/** Pływające czat + profil — na każdym zalogowanym ekranie, z boku apki. */
export function FloatingNav() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      pointerEvents="box-none"
      testID="floating-nav"
      style={{
        position: "absolute",
        right: Math.max(insets.right, spacing.sm),
        top: "36%",
        zIndex: 80,
        gap: spacing.md,
      }}
    >
      {ITEMS.map((item) => {
        const active = pathname === item.match || pathname.startsWith(`${item.match}/`);
        return (
          <Pressable
            key={item.href}
            testID={item.testID}
            onPress={() => {
              haptic.tap();
              router.push(item.href as any);
            }}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: active ? colors.brandPrimary : colors.border,
              shadowColor: colors.onSurface,
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 5,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Icon name={item.icon} size={26} color={active ? colors.onBrandPrimary : colors.onSurface} />
          </Pressable>
        );
      })}
    </View>
  );
}

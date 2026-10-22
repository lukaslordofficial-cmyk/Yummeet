import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/scan", icon: "qrcode-scan", testID: "tab-scan", match: "/scan", label: "Skaner" },
  { href: "/chats", icon: "chat-processing", testID: "tab-chats", match: "/chats", label: "Czat" },
  { href: "/profile", icon: "account-circle", testID: "tab-profile", match: "/profile", label: "Profil" },
] as const;

const STORE_KEY = "yummeet.floatingNav.v1";
const BUTTON = 52;

type Spot = { x: number; y: number };

/** Pływające czat + profil. Przeciągnij, jeśli zasłaniają mapę. */
export function FloatingNav() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const frame = useRef({ width, height, top: insets.top });
  frame.current = { width, height, top: insets.top };
  const [spot, setSpot] = useState<Spot | null>(null);
  const spotRef = useRef<Spot>({ x: 0, y: 0 });
  const moved = useRef(false);

  const clamp = (x: number, y: number): Spot => {
    const { width: w, height: h, top } = frame.current;
    return {
      x: Math.min(Math.max(4, x), Math.max(4, w - BUTTON - 4)),
      y: Math.min(Math.max(top + 4, y), Math.max(top + 4, h - BUTTON * 3 - 48)),
    };
  };

  useEffect(() => {
    const fallback = clamp(width - Math.max(insets.right, spacing.sm) - BUTTON, height * 0.36);
    let alive = true;
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (!raw) {
          spotRef.current = fallback;
          setSpot(fallback);
          return;
        }
        const saved = JSON.parse(raw) as { fx?: number; fy?: number };
        const next = clamp((saved.fx ?? 0.9) * width, (saved.fy ?? 0.36) * height);
        spotRef.current = next;
        setSpot(next);
      })
      .catch(() => {
        if (!alive) return;
        spotRef.current = fallback;
        setSpot(fallback);
      });
    return () => {
      alive = false;
    };
  }, [width, height, insets.right, insets.top]);

  const origin = useRef<Spot>({ x: 0, y: 0 });
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 8,
      onPanResponderGrant: () => {
        moved.current = false;
        origin.current = spotRef.current;
      },
      onPanResponderMove: (_, g) => {
        if (Math.hypot(g.dx, g.dy) <= 8) return;
        moved.current = true;
        const next = clamp(origin.current.x + g.dx, origin.current.y + g.dy);
        spotRef.current = next;
        setSpot(next);
      },
      onPanResponderRelease: () => {
        const { width: w, height: h } = frame.current;
        if (w > 0 && h > 0) {
          void AsyncStorage.setItem(STORE_KEY, JSON.stringify({ fx: spotRef.current.x / w, fy: spotRef.current.y / h }));
        }
      },
    }),
  ).current;

  if (!spot) return null;

  return (
    <View
      pointerEvents="box-none"
      testID="floating-nav"
      {...drag.panHandlers}
      style={{ position: "absolute", left: spot.x, top: spot.y, zIndex: 80, gap: spacing.md }}
    >
      {ITEMS.map((item) => {
        const active = pathname === item.match || pathname.startsWith(`${item.match}/`);
        return (
          <Pressable
            key={item.href}
            testID={item.testID}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => {
              if (moved.current) {
                moved.current = false;
                return;
              }
              haptic.tap();
              router.push(item.href as never);
            }}
            style={({ pressed }) => ({
              width: BUTTON,
              height: BUTTON,
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

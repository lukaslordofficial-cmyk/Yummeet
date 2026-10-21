import * as Haptics from "expo-haptics";
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "./Icon";

export const haptic = {
  tap: () => Platform.OS !== "web" && Haptics.selectionAsync(),
  heavy: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  medium: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

export function Title({ children, size = 24, style, testID, numberOfLines }: { children: ReactNode; size?: number; style?: any; testID?: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  return <Text testID={testID} numberOfLines={numberOfLines} style={[{ fontFamily: fonts.display, fontSize: size, lineHeight: Math.round(size * 1.25), letterSpacing: size >= 24 ? -0.4 : 0, color: colors.onSurface }, style]}>{children}</Text>;
}

export function Body({ children, muted, style, numberOfLines, testID }: { children: ReactNode; muted?: boolean; style?: any; numberOfLines?: number; testID?: string }) {
  const { colors } = useTheme();
  return <Text testID={testID} numberOfLines={numberOfLines} style={[{ fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: muted ? colors.muted : colors.onSurfaceSecondary }, style]}>{children}</Text>;
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ title, onPress, variant = "primary", icon, loading, disabled, testID, style }: {
  title: string; onPress: () => void; variant?: BtnVariant; icon?: string; loading?: boolean; disabled?: boolean; testID: string; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, secondary: colors.surfaceSecondary, ghost: colors.surfaceTertiary, danger: colors.error }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onSurface, ghost: colors.onSurface, danger: colors.onError }[variant];
  const borderColor = variant === "primary" || variant === "danger" ? bg : colors.borderStrong;
  return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled || loading} onPress={() => { haptic.tap(); onPress(); }}
      style={({ pressed }) => [{ minHeight: 52, borderRadius: radius.md, backgroundColor: bg, borderWidth: 1, borderColor, paddingHorizontal: spacing.xl, flexDirection: "row",
        alignItems: "center", justifyContent: "center", gap: spacing.sm, opacity: disabled ? 0.45 : pressed ? 0.88 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <>{icon ? <Icon name={icon} size={20} color={fg} /> : null}<Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: fg }}>{title}</Text></>}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, testID, tone = "surface" }: { icon: string; onPress: () => void; testID: string; tone?: "surface" | "brand" }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => { haptic.tap(); onPress(); }} hitSlop={6}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
        backgroundColor: tone === "brand" ? colors.brandPrimary : colors.surfaceSecondary, borderWidth: 1, borderColor: tone === "brand" ? colors.brandPrimary : colors.border,
        opacity: pressed ? 0.88 : 1 })}>
      <Icon name={icon} size={22} color={tone === "brand" ? colors.onBrandPrimary : colors.onSurface} />
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; accent?: string }) {
  const s = useStyles();
  const content = [s.card, accent ? { borderColor: accent, borderWidth: 2 } : null, style];
  if (!onPress) return <View testID={testID} style={content}>{children}</View>;
  return <Pressable testID={testID} accessibilityRole="button" onPress={() => { haptic.tap(); onPress(); }} style={({ pressed }) => [content, { opacity: pressed ? 0.92 : 1 }]}>{children}</Pressable>;
}

export function Chip({ label, selected, onPress, testID, color }: { label: string; selected?: boolean; onPress?: () => void; testID: string; color?: string }) {
  const { colors } = useTheme();
  const active = color ?? colors.brandPrimary;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={() => { haptic.tap(); onPress?.(); }}
      style={{ height: 40, flexShrink: 0, borderRadius: radius.pill, paddingHorizontal: spacing.lg, justifyContent: "center",
        backgroundColor: selected ? active : colors.surfaceSecondary, borderWidth: 1, borderColor: selected ? active : colors.border }}>
      <Text style={{ fontFamily: fonts.text, fontSize: 14, lineHeight: 18, color: selected ? colors.onBrandPrimary : colors.onSurface }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 60 }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

export function Badge({ label, color, textColor, testID }: { label: string; color: string; textColor: string; testID?: string }) {
  return (
    <View testID={testID} style={{ alignSelf: "flex-start", backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 12, color: textColor }}>{label}</Text>
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string; testID: string }) {
  const { colors } = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={{ fontFamily: fonts.text, fontSize: 13, color: colors.muted }}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} {...rest}
        style={[{ minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
          fontFamily: fonts.text, fontSize: 16, lineHeight: 22, color: colors.onSurface, textAlignVertical: rest.multiline ? "top" : "center" }, style]} />
    </View>
  );
}

export function Loading({ testID = "loading" }: { testID?: string }) {
  const { colors } = useTheme();
  return <View testID={testID} style={{ padding: spacing.xxl, alignItems: "center" }}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>;
}

export function EmptyState({ icon, title, text, testID, action }: { icon: string; title: string; text?: string; testID: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: spacing.xxl, gap: spacing.md }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={44} color={colors.onBrandTertiary} />
      </View>
      <Title size={20} style={{ textAlign: "center" }}>{title}</Title>
      {text ? <Body muted style={{ textAlign: "center" }}>{text}</Body> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry, testID = "error-state" }: { message: string; onRetry?: () => void; testID?: string }) {
  return (
    <EmptyState testID={testID} icon="emoticon-sad-outline" title="Ups, coś się przypaliło" text={message}
      action={onRetry ? <Button testID={`${testID}-retry`} title="Spróbuj ponownie" variant="ghost" onPress={onRetry} /> : undefined} />
  );
}

/** Stack screen header (sticky, safe-area aware). */
export function Header({ title, right, back = true, testID = "screen-header" }: { title: string; right?: ReactNode; back?: boolean; testID?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, flexDirection: "row",
      alignItems: "center", gap: spacing.md, backgroundColor: colors.surface }}>
      {back ? <IconButton testID="header-back-button" icon="arrow-left" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : null}
      <Title size={22} style={{ flex: 1 }}>{title}</Title>
      {right}
    </View>
  );
}

// ---------- Toasts (no Alert dialogs) ----------
type Toast = { text: string; tone: "info" | "success" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ text, tone });
    if (tone === "success") haptic.success();
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== "web" }).start(() => setToast(null)), 3200);
  }, [opacity]);
  const bg = toast?.tone === "error" ? colors.error : toast?.tone === "success" ? colors.success : colors.surfaceInverse;
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View testID="toast" style={{ pointerEvents: "none", position: "absolute", left: spacing.lg, right: spacing.lg, top: insets.top + spacing.sm, opacity,
          backgroundColor: bg, borderRadius: radius.md, padding: spacing.lg, zIndex: 1000 }}>
          <Text testID="toast-text" style={{ fontFamily: fonts.text, fontSize: 15, color: colors.onSurfaceInverse }}>{toast.text}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

const useStyles = makeStyles((c) => ({
    card: {
    backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: c.border,
    shadowColor: c.onSurface, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
}));

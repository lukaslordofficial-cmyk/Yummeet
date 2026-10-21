import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, LogBox, Platform, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppTutorial } from "@/src/components/AppTutorial";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { FloatingNav } from "@/src/components/FloatingNav";
import { Loading, ToastProvider } from "@/src/components/ui";
import { AuthProvider, useAuth } from "@/src/providers/AuthProvider";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

void SplashScreen.preventAutoHideAsync().catch(() => {});

// Background route task after first paint — avoids blanking the app on native mismatch.
void import("@/src/lib/routeBg").catch(() => {});

function ShareIntentBridge() {
  const { session } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!session || Platform.OS === "web") return;

    const openNewPinIfShared = async () => {
      try {
        const Sharing = await import("expo-sharing");
        const payloads = Sharing.getSharedPayloads?.() ?? [];
        if (!payloads.length) return;
        const onNewPin = segments[0] === "pin" && segments[1] === "new";
        if (!onNewPin) router.push("/pin/new?fromShare=1");
      } catch {
        /* brak natywnego share */
      }
    };

    void openNewPinIfShared();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void openNewPinIfShared();
    });
    return () => sub.remove();
  }, [session, router, segments]);

  return null;
}

function Gate() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) router.replace("/login");
    else if (session && onLogin) router.replace("/");
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}>
        <Loading testID="app-loading" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ShareIntentBridge />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pin/[id]" />
          <Stack.Screen name="pin/new" />
          <Stack.Screen name="pin/edit/[id]" />
          <Stack.Screen name="mission/[id]" />
          <Stack.Screen name="duel/[id]" />
          <Stack.Screen name="duel/new" />
          <Stack.Screen name="cards" />
          <Stack.Screen name="specializations" />
          <Stack.Screen name="specialization/[code]" />
          <Stack.Screen name="profile/culinary" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="event/new" />
          <Stack.Screen name="meetings" />
          <Stack.Screen name="chats" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="games" />
          <Stack.Screen name="user/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      {session ? <FloatingNav /> : null}
      <AppTutorial autoStart={!!session} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    PlusJakartaSemi: require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: "#FFF7EE" }} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <Gate />
              </ToastProvider>
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

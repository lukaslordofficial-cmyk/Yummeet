import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { Loading, ToastProvider } from "@/src/components/ui";
import "@/src/lib/routeBg";
import { AuthProvider, useAuth } from "@/src/providers/AuthProvider";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function Gate() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><Loading testID="app-loading" /></View>;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pin/[id]" />
        <Stack.Screen name="pin/new" />
        <Stack.Screen name="pin/edit/[id]" />
        <Stack.Screen name="route" />
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
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="games" />
        <Stack.Screen name="user/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka: require("../assets/fonts/Fredoka.ttf"),
    Nunito: require("../assets/fonts/Nunito.ttf"),
  });
  if (!fontsLoaded) return null;
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

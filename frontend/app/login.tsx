import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { openTutorial } from "@/src/components/AppTutorial";
import { BrandMark } from "@/src/components/BrandMark";
import { Body, Button, Field, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

const schema = z.object({ email: z.string().trim().email("Podaj poprawny e-mail"), password: z.string().min(6, "Hasło min. 6 znaków") });

export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast(parsed.error.issues[0].message, "error");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { data: { name: name.trim() || undefined } } });
        if (error) throw error;
        if (!data.session) toast("Sprawdź skrzynkę e-mail, aby potwierdzić konto.", "info");
      }
    } catch (e) {
      toast(e instanceof Error && e.message.includes("Invalid login") ? "Nieprawidłowy e-mail lub hasło" : errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try { await signInWithGoogle(); } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <BrandMark size={84} />
          <Title size={40} testID="login-title" style={{ textAlign: "center" }}>Yummeet</Title>
          <Body muted style={{ textAlign: "center" }}>
            Odkrywaj i oceniaj lokale gastronomiczne. Poznawaj ludzi przy stole. Wyszukuj restauracje podczas podróży.
          </Body>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button testID="login-mode-login" title="Logowanie" variant={mode === "login" ? "primary" : "ghost"} onPress={() => setMode("login")} style={{ flex: 1, paddingHorizontal: spacing.sm }} />
          <Button testID="login-mode-register" title="Rejestracja" variant={mode === "register" ? "primary" : "ghost"} onPress={() => setMode("register")} style={{ flex: 1, paddingHorizontal: spacing.sm }} />
        </View>
        {mode === "register" ? <Field testID="register-name-input" label="Imię / pseudonim" value={name} onChangeText={setName} placeholder="np. Smakosz Ala" /> : null}
        <Field testID="login-email-input" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="ty@przyklad.pl" />
        <Field testID="login-password-input" label="Hasło" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" onSubmitEditing={submit} />
        <Button testID="login-submit-button" title={mode === "login" ? "Zaloguj się" : "Załóż konto"} loading={busy} onPress={submit} />
        <Body muted style={{ textAlign: "center" }}>albo</Body>
        <Button testID="login-google-button" title="Kontynuuj z Google" variant="ghost" icon="google" onPress={google} />
        <Button testID="login-tutorial-button" title="Jak działa Yummeet?" variant="ghost" icon="play-circle-outline" onPress={() => openTutorial()} />
      </KeyboardAwareScrollView>
    </View>
  );
}

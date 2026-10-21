import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Linking, Modal, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { deleteMyAccount, myBlocks, myPreferences, setDuelMode, unblockUser, updateMyProfile, updatePreferences } from "@/src/lib/data";
import { useAuth } from "@/src/providers/AuthProvider";
import { radius, spacing, useTheme } from "@/src/theme";

const DIETS = [["vegetarian", "Wegetariańska"], ["vegan", "Wegańska"], ["meat", "Jem mięso"], ["gluten_free", "Bezglutenowa"]] as const;
const ALLERGENS = [["gluten", "Gluten"], ["nuts", "Orzechy"], ["milk", "Mleko"], ["eggs", "Jaja"], ["fish", "Ryby"], ["soy", "Soja"], ["sesame", "Sezam"]] as const;
const SOCIAL = [["small_groups", "Małe grupy"], ["large_groups", "Duże grupy"], ["spontaneous", "Spontaniczne"], ["planned", "Planowane"], ["quiet", "Spokojne rozmowy"], ["dating", "Randki"]] as const;

function Row({ label, hint, value, onChange, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 }}>
      <View style={{ flex: 1 }}><Body>{label}</Body>{hint ? <Body muted style={{ fontSize: 12 }}>{hint}</Body> : null}</View>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: colors.brandSecondary, false: colors.borderStrong }} />
    </View>
  );
}

export default function Settings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [prefs, setPrefs] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [permSheet, setPermSheet] = useState<null | "ask" | "settings">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { myPreferences().then(setPrefs).catch(() => {}); myBlocks().then((b) => setBlocks(b as any[])).catch(() => {}); }, []);
  const vis = profile?.visibility ?? {};
  const notif = profile?.notification_prefs ?? {};

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await refreshProfile(); if (ok) toast(ok, "success"); } catch (e) { toast(errorMessage(e), "error"); }
  };
  const togglePref = (key: string, val: string) => {
    const arr: string[] = prefs?.[key] ?? [];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    setPrefs({ ...prefs, [key]: next });
    updatePreferences({ [key]: next }).catch((e) => toast(errorMessage(e), "error"));
  };

  // Duel mode: contextual pre-permission explanation, then the OS prompt; fallback to Settings.
  const duelToggle = async (on: boolean) => {
    if (!on) return run(() => setDuelMode(false), "Tryb pojedynków wyłączony — lokalizacja nie jest już wysyłana");
    const cur = await Location.getForegroundPermissionsAsync();
    if (cur.granted) return run(() => setDuelMode(true), "Tryb pojedynków włączony");
    setPermSheet(cur.canAskAgain ? "ask" : "settings");
  };
  const askPermission = async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    if (res.granted) { setPermSheet(null); return run(() => setDuelMode(true), "Tryb pojedynków włączony"); }
    setPermSheet(res.canAskAgain ? null : "settings");
    if (res.canAskAgain) toast("Bez lokalizacji tryb pojedynków z bliskości jest niedostępny. Pojedynki z listy działają nadal.", "info");
  };

  return (
    <View testID="settings-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Ustawienia" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Card>
          <Title size={18}>Profil</Title>
          <Field testID="settings-name-input" label="Nazwa" value={name} onChangeText={setName} />
          <Field testID="settings-bio-input" label="O mnie" value={bio} onChangeText={setBio} multiline style={{ minHeight: 70 }} />
          <Button testID="settings-save-profile" title="Zapisz profil" onPress={() => run(() => updateMyProfile({ display_name: name.trim() || "Yummiteer", bio }), "Zapisano")} />
        </Card>
        <Card>
          <Title size={18}>Prywatność</Title>
          {([["profile", "Profil publiczny"], ["stats", "Statystyki publiczne"], ["cards", "Kolekcja kart publiczna"]] as const).map(([k, l]) => (
            <Row key={k} testID={`settings-vis-${k}`} label={l} value={(vis[k] ?? "public") === "public"}
              onChange={(v) => run(() => updateMyProfile({ visibility: { ...vis, [k]: v ? "public" : "private" } }))} />
          ))}
          <Body muted>Alergie i preferencje randkowe są zawsze prywatne.</Body>
        </Card>
        <Card testID="settings-duel-card">
          <Title size={18}>Tryb pojedynków (bliskość)</Title>
          <Row testID="settings-duel-mode" label="Wykrywaj Yummiteerów w promieniu 100 m" hint="Lokalizacja wysyłana co 30 s tylko gdy aplikacja jest otwarta. Nikt nie widzi Twoich współrzędnych, a historia przemieszczania nie jest zapisywana."
            value={!!profile?.duel_mode_enabled} onChange={duelToggle} />
        </Card>
        <Card>
          <Title size={18}>Powiadomienia</Title>
          {([["duels", "Pojedynki"], ["events", "Spotkania i wydarzenia"], ["messages", "Wiadomości"], ["rewards", "Nagrody"]] as const).map(([k, l]) => (
            <Row key={k} testID={`settings-notif-${k}`} label={l} value={notif[k] !== false} onChange={(v) => run(() => updateMyProfile({ notification_prefs: { ...notif, [k]: v } }))} />
          ))}
        </Card>
        {prefs ? (
          <Card>
            <Title size={18}>Dieta i alergie</Title>
            <Body muted>Dieta</Body>
            <ChipRow>{DIETS.map(([k, l]) => <Chip key={k} testID={`pref-diet-${k}`} label={l} selected={prefs.diet?.includes(k)} onPress={() => togglePref("diet", k)} />)}</ChipRow>
            <Body muted>Alergie (twarde ograniczenia przy wymianie posiłków)</Body>
            <ChipRow>{ALLERGENS.map(([k, l]) => <Chip key={k} testID={`pref-allergy-${k}`} label={l} color={colors.error} selected={prefs.allergies?.includes(k)} onPress={() => togglePref("allergies", k)} />)}</ChipRow>
            <Body muted>Preferowane spotkania</Body>
            <ChipRow>{SOCIAL.map(([k, l]) => <Chip key={k} testID={`pref-social-${k}`} label={l} color={colors.brandSecondary} selected={prefs.social_prefs?.includes(k)} onPress={() => togglePref("social_prefs", k)} />)}</ChipRow>
            <Row testID="pref-dating-enabled" label="Tryb randkowy" hint="Domyślnie wyłączony. Nikt nie zakłada, że szukasz randki." value={!!prefs.dating_enabled}
              onChange={(v) => { setPrefs({ ...prefs, dating_enabled: v }); updatePreferences({ dating_enabled: v }).catch((e) => toast(errorMessage(e), "error")); }} />
          </Card>
        ) : null}
        <Card>
          <Title size={18}>Zablokowani</Title>
          {blocks.length === 0 ? <Body muted>Nikogo nie blokujesz.</Body> : blocks.map((b) => (
            <View key={b.blocked_id} style={{ flexDirection: "row", alignItems: "center" }}>
              <Body style={{ flex: 1 }}>{b.blocked?.display_name ?? "Yummiteer"}</Body>
              <Button testID={`unblock-${b.blocked_id}`} title="Odblokuj" variant="ghost" onPress={async () => { await unblockUser(b.blocked_id); setBlocks(blocks.filter((x) => x.blocked_id !== b.blocked_id)); }} />
            </View>
          ))}
        </Card>
        <Button testID="settings-logout-button" title="Wyloguj się" variant="ghost" icon="logout" onPress={signOut} />
        <Button testID="settings-delete-account" title="Usuń konto i dane" variant="danger" onPress={() => setConfirmDelete(true)} />
      </ScrollView>

      <Modal visible={!!permSheet || confirmDelete} transparent animationType="slide" onRequestClose={() => { setPermSheet(null); setConfirmDelete(false); }}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View testID="settings-sheet" style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
            {confirmDelete ? (
              <>
                <Title size={20}>Usunąć konto?</Title>
                <Body>Profil, karty, misje i wiadomości zostaną trwale usunięte.</Body>
                <Button testID="settings-delete-confirm" title="Tak, usuń" variant="danger" onPress={() => run(async () => { await deleteMyAccount(); await signOut(); })} />
                <Button testID="settings-delete-cancel" title="Anuluj" variant="ghost" onPress={() => setConfirmDelete(false)} />
              </>
            ) : permSheet === "ask" ? (
              <>
                <Title size={20}>Lokalizacja dla pojedynków</Title>
                <Body>Dzięki niej wykryjemy innych Yummiteerów w promieniu 100 m — tylko gdy aplikacja jest otwarta. Nie pokazujemy nikomu Twoich współrzędnych.</Body>
                <Button testID="perm-allow-button" title="Zezwól na lokalizację" onPress={askPermission} />
                <Button testID="perm-later-button" title="Nie teraz" variant="ghost" onPress={() => setPermSheet(null)} />
              </>
            ) : (
              <>
                <Title size={20}>Lokalizacja zablokowana</Title>
                <Body>Włącz dostęp do lokalizacji w ustawieniach telefonu, aby korzystać z pojedynków z bliskości.</Body>
                <Button testID="perm-open-settings" title="Otwórz ustawienia" onPress={() => { setPermSheet(null); Linking.openSettings(); }} />
                <Button testID="perm-close" title="Zamknij" variant="ghost" onPress={() => setPermSheet(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

import * as Location from "expo-location";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Body, Button, Card, Chip, ChipRow, ErrorState, Field, Header, Loading, Title, haptic, useToast } from "@/src/components/ui";
import { MISSION_STATUS_LABEL, missionActions } from "@/src/domain/rules";
import { errorMessage } from "@/src/lib/api";
import { missionAccept, missionBoard, missionCancel, missionStart, missionSubmit, searchPeople } from "@/src/lib/data";
import { pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";
import type { BoardMission } from "@/src/types";

const METHOD_LABEL: Record<string, string> = {
  self: "Samodzielne potwierdzenie", code: "Kod od organizatora / jadłodzielni", peer: "Potwierdzenie drugiej osoby",
  organizer: "Potwierdzenie organizatora", photo: "Dowód + potwierdzenie drugiej osoby", location: "Weryfikacja lokalizacji",
};

export default function MissionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refreshProfile, session } = useAuth();
  const [m, setM] = useState<BoardMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [confirmer, setConfirmer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    try { const b = await missionBoard(); setM(b.find((x) => x.mission_id === id) ?? null); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const needsPeer = m && ["peer", "organizer", "photo"].includes(m.confirmation_method);
  useEffect(() => { if (needsPeer && m?.user_status === "in_progress") searchPeople("").then(setPeople).catch(() => {}); }, [needsPeer, m?.user_status]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok, "success"); await load(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const addPhoto = async (source: "gallery" | "camera") => {
    const uid = session?.user.id;
    if (!uid) return toast("Zaloguj się ponownie", "error");
    setPhotoBusy(true);
    try {
      const url = await pickPinPhoto(uid, source);
      if (url) setPhotoUrl(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (!m?.user_mission_id) return;
    setBusy(true);
    try {
      let content = evidence.trim();
      let kind: string = m.confirmation_method === "code" ? "code" : "text";
      if (m.confirmation_method === "location") {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) throw new Error("Ta misja wymaga jednorazowej weryfikacji lokalizacji.");
        const pos = await Location.getCurrentPositionAsync({});
        content = `${pos.coords.latitude},${pos.coords.longitude}`; kind = "location";
      } else if (photoUrl) {
        kind = "photo_url";
        content = content ? `${content}\n${photoUrl}` : photoUrl;
      }
      if (!content) throw new Error("Dodaj opis wykonania lub zdjęcie dowodu");
      if (content.length > 2000) throw new Error("Dowód jest za długi (max 2000 znaków)");
      const res = await missionSubmit(m.user_mission_id, kind, content, confirmer);
      if (res?.completed) {
        haptic.success();
        const pd = res.pd ?? res.xp;
        toast(`Misja ukończona! +${res.xp} XP${res.specialization ? ` / ${pd} PD` : ""}, kart: ${res.cards?.length ?? 0}`, "success");
        refreshProfile();
      } else if (res?.pending_confirmation) toast("Wysłano prośbę o potwierdzenie", "success");
      else if (res?.already_completed) toast("Nagroda została już przyznana", "info");
      await load();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Misja" /><ErrorState message={error} onRetry={load} /></View>;
  if (!m) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Misja" /><Loading /></View>;
  const actions = missionActions(m.user_status, m.completions, true);

  return (
    <View testID="mission-detail-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Misja" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Card accent={colors.brandPrimary}>
          <Title size={24}>{m.name}</Title>
          <Body>{m.description}</Body>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <Badge label={`+${m.reward_xp} XP/PD`} color={colors.brandPrimary} textColor={colors.onBrandPrimary} />
            {m.specialization_code ? <Badge label={m.specialization_code} color={colors.surfaceTertiary} textColor={colors.onSurfaceTertiary} /> : null}
            {m.card_reward_count ? <Badge label={`Nagroda: ${m.card_reward_count} karta`} color={colors.rarityRare} textColor={colors.onBrand} /> : null}
            <Badge testID="mission-detail-status" label={MISSION_STATUS_LABEL[m.user_status]} color={colors.surfaceTertiary} textColor={colors.onSurfaceTertiary} />
          </View>
          <Body muted>{METHOD_LABEL[m.confirmation_method]} · {m.duration_hours} h · {m.participation === "solo" ? "solo" : m.participation === "pair" ? "w parze" : "grupowa"}</Body>
          {m.completions > 0 ? <Body muted>Ukończono {m.completions}×</Body> : null}
        </Card>
        <Card>
          <Title size={18}>Kroki</Title>
          {(m.steps ?? []).map((s, i) => <Body key={i}>{i + 1}. {s}</Body>)}
          {m.safety_rules ? <Body muted>🛡 {m.safety_rules}</Body> : null}
        </Card>

        {m.user_status === "in_progress" ? (
          <Card testID="mission-submit-card">
            <Title size={18}>Dowód wykonania</Title>
            <Body muted>Dodaj opis tekstowy i/lub zdjęcie. Ponowne wysłanie ukończonej misji nie przyznaje PD drugi raz.</Body>
            {m.confirmation_method !== "location" ? (
              <Field testID="mission-evidence-input" value={evidence} onChangeText={setEvidence} multiline={m.confirmation_method !== "code"}
                autoCapitalize={m.confirmation_method === "code" ? "characters" : "sentences"}
                placeholder={m.confirmation_method === "code" ? "Kod potwierdzenia" : "Opisz, co zrobiłeś"} />
            ) : <Body muted>Sprawdzimy jednorazowo, czy jesteś w lokalu.</Body>}
            {m.confirmation_method !== "location" && m.confirmation_method !== "code" ? (
              <>
                {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: "100%", height: 160, borderRadius: 12 }} contentFit="cover" /> : null}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Button testID="mission-photo-gallery" title="Zdjęcie" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addPhoto("gallery")} />
                  <Button testID="mission-photo-camera" title="Aparat" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addPhoto("camera")} />
                </View>
              </>
            ) : null}
            {needsPeer ? (
              <>
                <Body muted>Kto potwierdzi wykonanie?</Body>
                <ChipRow testID="mission-confirmer-chips">
                  {people.map((p) => <Chip key={p.id} testID={`mission-confirmer-${p.id}`} label={p.display_name} selected={confirmer === p.id} onPress={() => setConfirmer(p.id)} />)}
                </ChipRow>
              </>
            ) : null}
            <Button testID="mission-submit-button" title="Wyślij" loading={busy} onPress={submit} />
          </Card>
        ) : null}
        {m.user_status === "pending_confirmation" ? <Body testID="mission-pending-info" muted>Czekamy na potwierdzenie drugiej osoby.</Body> : null}

        <View style={{ gap: spacing.md }}>
          {actions.includes("accept") ? <Button testID="mission-accept-button" title={m.completions ? "Podejmij ponownie" : "Przyjmij misję"} loading={busy} onPress={() => act(() => missionAccept(m.mission_id), "Misja przyjęta")} /> : null}
          {actions.includes("start") ? <Button testID="mission-start-button" title="Rozpocznij" variant="secondary" loading={busy} onPress={() => act(() => missionStart(m.user_mission_id!), "Do dzieła!")} /> : null}
          {actions.includes("cancel") ? <Button testID="mission-cancel-button" title="Anuluj misję" variant="ghost" onPress={() => act(() => missionCancel(m.user_mission_id!), "Misja anulowana")} /> : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

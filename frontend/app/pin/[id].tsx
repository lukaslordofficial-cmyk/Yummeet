import { Image } from "expo-image";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Stars } from "@/src/components/Stars";
import { Badge, Body, Button, Card, Chip, ErrorState, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { invalidatePins, markVisited, pinDetails, report, saveReview } from "@/src/lib/data";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

const PURPOSES = [["date", "Randka"], ["group", "Grupa"], ["meet", "Poznawanie ludzi"], ["work", "Praca"], ["party", "Impreza"], ["quiet", "Spokojna rozmowa"]] as const;
const AXES = [["food", "Jedzenie"], ["atmosphere", "Atmosfera"], ["service", "Obsługa"], ["price_value", "Cena/jakość"]] as const;

export default function PinDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const [pin, setPin] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [r, setR] = useState({ food: 0, atmosphere: 0, service: 0, price_value: 0, purposes: [] as string[], best_dish: "", tip: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setPin(await pinDetails(id)); setError(null); } catch (e) { setError(errorMessage(e)); } }, [id]);
  useEffect(() => { load(); }, [load]);

  const submitReview = async () => {
    if (!r.food || !r.atmosphere || !r.service || !r.price_value) return toast("Oceń wszystkie 4 kategorie", "error");
    setBusy(true);
    try { await saveReview(id, r); invalidatePins(); toast("Dzięki za recenzję!", "success"); setReviewOpen(false); load(); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const visited = async () => {
    const cur = await Location.getForegroundPermissionsAsync();
    const perm = cur.granted ? cur : cur.canAskAgain ? await Location.requestForegroundPermissionsAsync() : cur;
    if (!perm.granted) return toast("Potwierdzenie wizyty wymaga jednorazowego sprawdzenia lokalizacji.", "info");
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await markVisited(id, pos.coords.latitude, pos.coords.longitude);
      toast("Wizyta potwierdzona! +10 XP", "success"); load();
    } catch (e) { toast(errorMessage(e), "error"); }
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Lokal" /><ErrorState message={error} onRetry={load} /></View>;
  if (!pin) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Lokal" /><Loading /></View>;
  const s = pin.summary;

  return (
    <View testID="pin-detail-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={pin.title} right={<Button testID="pin-report-button" title="Zgłoś" variant="ghost" onPress={async () => { await report("pin", id, "pin_issue"); toast("Zgłoszenie wysłane", "success"); }} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        {pin.cover_url ? (
          <Image source={{ uri: pin.cover_url }} style={{ width: "100%", height: 200, borderRadius: radius.lg }} contentFit="cover" testID="pin-cover-image" />
        ) : null}
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            {pin.is_official ? <Badge label="OFICJALNY LOKAL" color={colors.rarityLegendary} textColor={colors.onSurface} /> : null}
            {pin.cuisine ? <Badge label={pin.cuisine} color={colors.brandTertiary} textColor={colors.onBrandTertiary} /> : null}
            {(pin.tags ?? []).map((t: string) => <Badge key={t} label={t} color={colors.surfaceTertiary} textColor={colors.onSurfaceTertiary} />)}
            {pin.visited ? <Badge testID="pin-visited-badge" label="Odwiedzone ✓" color={colors.success} textColor={colors.onSuccess} /> : null}
          </View>
          {pin.description ? <Body>{pin.description}</Body> : null}
          {pin.price_min != null || pin.price_max != null ? (
            <Body testID="pin-price-range">Ceny dań: {pin.price_min ?? "?"}–{pin.price_max ?? "?"} zł</Body>
          ) : null}
          <Body muted>{pin.address || pin.city || ""}</Body>
          {pin.lat != null && pin.lng != null ? (
            <Body muted testID="pin-coords-locked">📍 Współrzędne (stałe): {Number(pin.lat).toFixed(5)}, {Number(pin.lng).toFixed(5)}</Body>
          ) : null}
        </Card>
        {(pin.menu_text || pin.menu_photo_url || pin.menu_pdf_url) ? (
          <Card testID="pin-menu-card">
            <Title size={18}>Menu</Title>
            {pin.menu_text ? <Body>{pin.menu_text}</Body> : null}
            {pin.menu_photo_url ? (
              <Image source={{ uri: pin.menu_photo_url }} style={{ width: "100%", height: 180, borderRadius: radius.lg }} contentFit="cover" />
            ) : null}
            {pin.menu_pdf_url ? (
              <Button testID="pin-menu-pdf" title="Otwórz PDF menu" variant="secondary" onPress={() => void Linking.openURL(pin.menu_pdf_url)} />
            ) : null}
          </Card>
        ) : null}
        <Button testID="pin-edit-button" title="Edytuj lokal" icon="pencil" variant="secondary" onPress={() => router.push(`/pin/edit/${id}`)} />
        <Card testID="pin-score-card">
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
            <Text testID="pin-yummeet-score" style={{ fontFamily: fonts.display, fontSize: 44, color: colors.brandPrimary }}>{s?.yummeet_score ?? "–"}</Text>
            <Body muted style={{ paddingBottom: 10 }}>Yummeet Score · {s?.review_count ?? 0} ocen{s?.verified_count ? ` (${s.verified_count} zweryfikowanych)` : ""}</Body>
          </View>
          {s && s.review_count < 3 ? <Body muted>Mało ocen — wynik może być mało wiarygodny.</Body> : null}
          {s ? AXES.map(([k, label]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}><Body>{label}</Body><Body>{s[k]}</Body></View>
          )) : null}
          {s ? <Body muted>Na randkę: {s.date_votes} · Grupa: {s.group_votes} · Poznawanie: {s.meet_votes} · Spokój: {s.quiet_votes}</Body> : null}
        </Card>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Button testID="pin-review-button" title={reviewOpen ? "Zamknij" : "Oceń lokal"} icon="star" style={{ flex: 1 }} onPress={() => setReviewOpen((v) => !v)} />
          <Button testID="pin-visited-button" title="Jestem tu" icon="map-marker-check" variant="secondary" onPress={visited} />
        </View>
        {reviewOpen ? (
          <Card testID="review-form">
            {AXES.map(([k, label]) => (
              <View key={k} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Body>{label}</Body><Stars testID={`review-${k}`} value={(r as any)[k]} onChange={(v) => setR({ ...r, [k]: v })} />
              </View>
            ))}
            <Body muted>Dobre miejsce na:</Body>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {PURPOSES.map(([k, label]) => <Chip key={k} testID={`review-purpose-${k}`} label={label} selected={r.purposes.includes(k)}
                onPress={() => setR({ ...r, purposes: r.purposes.includes(k) ? r.purposes.filter((x) => x !== k) : [...r.purposes, k] })} />)}
            </ScrollView>
            <Field testID="review-best-dish-input" label="Najlepsze danie" value={r.best_dish} onChangeText={(t) => setR({ ...r, best_dish: t })} />
            <Field testID="review-tip-input" label="Wskazówka dla społeczności" value={r.tip} onChangeText={(t) => setR({ ...r, tip: t })} placeholder="np. duże porcje w rozsądnej cenie" />
            <Button testID="review-submit-button" title="Zapisz ocenę" loading={busy} onPress={submitReview} />
          </Card>
        ) : null}
        {(pin.edit_history ?? []).length > 0 ? (
          <>
            <Title size={20}>Historia edycji</Title>
            {(pin.edit_history as any[]).map((e) => (
              <Card key={e.id} testID={`pin-edit-${e.id}`}>
                <Pressable onPress={() => e.editor_id && router.push(`/user/${e.editor_id}`)}>
                  <Title size={15}>{e.editor_name ?? "Yummiter"}</Title>
                </Pressable>
                <Body muted>{e.created_at ? new Date(e.created_at).toLocaleString("pl-PL") : ""}</Body>
                <Body muted>{Object.keys(e.changes ?? {}).join(", ") || "aktualizacja"}</Body>
              </Card>
            ))}
          </>
        ) : null}
        <Title size={20}>Recenzje</Title>
        {pin.reviews.length === 0 ? <Body muted testID="pin-no-reviews">Brak recenzji — bądź pierwszy!</Body> : pin.reviews.map((rv: any) => (
          <Card key={rv.id} testID={`review-${rv.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable onPress={() => router.push(`/user/${rv.user_id}`)}><Title size={16}>{rv.author ?? "Yummiteer"}</Title></Pressable>
              {rv.visit_verified ? <Badge label="Zweryfikowana wizyta" color={colors.success} textColor={colors.onSuccess} /> : null}
            </View>
            <Body muted>J {rv.food} · A {rv.atmosphere} · O {rv.service} · C {rv.price_value}</Body>
            {rv.best_dish ? <Body>🍽 Najlepsze: {rv.best_dish}</Body> : null}
            {rv.tip ? <Body>{rv.tip}</Body> : null}
          </Card>
        ))}
      </KeyboardAwareScrollView>
    </View>
  );
}

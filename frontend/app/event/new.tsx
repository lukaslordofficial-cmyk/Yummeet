import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { eventCreate } from "@/src/lib/data";
import { geocode, type GeocodeResult } from "@/src/lib/routing";
import { spacing, useTheme } from "@/src/theme";

const KINDS = [["open_table", "Otwarty stół"], ["speed_friending", "Speed Friending"], ["dinner", "Kolacja tematyczna"], ["food_exchange", "Wymiana potraw"], ["volunteer", "Wolontariat"]] as const;
const DAYS = [["0", "Dziś"], ["1", "Jutro"], ["3", "Za 3 dni"], ["7", "Za tydzień"]] as const;

export default function NewEvent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [placeHits, setPlaceHits] = useState<GeocodeResult[]>([]);
  const [venue, setVenue] = useState<GeocodeResult | null>(null);
  const [kind, setKind] = useState<string>("open_table");
  const [day, setDay] = useState("1");
  const [time, setTime] = useState("19:00");
  const [capacity, setCapacity] = useState(4);
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const searchPlace = async () => {
    if (place.trim().length < 3) return;
    setBusy(true);
    try {
      setPlaceHits(await geocode(place, "pl"));
    } catch {
      setPlaceHits([]);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const m = time.match(/^(\d{1,2}):(\d{2})$/);
    if (title.trim().length < 3 || !place.trim()) return toast("Podaj tytuł i miejsce publiczne", "error");
    if (!venue) return toast("Wybierz lokalizację z podpowiedzi (potrzebne GPS do kodu obecności).", "error");
    if (!m) return toast("Godzina w formacie GG:MM", "error");
    const d = new Date(); d.setDate(d.getDate() + Number(day)); d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    setBusy(true);
    try {
      const id = await eventCreate({
        title, place: venue.title || place, startsAt: d.toISOString(), capacity, kind, theme, description,
        rules: "Spotkanie w miejscu publicznym.", placeLat: venue.lat, placeLng: venue.lng,
      });
      toast("Stół utworzony!", "success"); router.replace(`/event/${id}`);
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <View testID="new-event-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Nowy stół" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <ChipRow>{KINDS.map(([k, l]) => <Chip key={k} testID={`new-event-kind-${k}`} label={l} selected={kind === k} onPress={() => setKind(k)} />)}</ChipRow>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-event-title-input" label="Tytuł" value={title} onChangeText={setTitle} placeholder="np. Ramen dla nieznajomych" />
          <Field testID="new-event-place-input" label="Miejsce (publiczne)" value={place} onChangeText={(t) => { setPlace(t); setVenue(null); }} placeholder="np. Warszawa Dworzec PKP" onSubmitEditing={() => void searchPlace()} />
          <Button testID="new-event-place-search" title="Szukaj lokalizacji" variant="ghost" loading={busy} onPress={() => void searchPlace()} />
          {venue ? <Body muted>✓ {venue.title} · {venue.lat.toFixed(5)}, {venue.lng.toFixed(5)}</Body> : null}
          {placeHits.map((h, i) => (
            <Card key={`${h.lat}-${i}`} testID={`new-event-place-hit-${i}`} onPress={() => { setVenue(h); setPlace(h.title); setPlaceHits([]); }}>
              <Body numberOfLines={3}>{h.title}</Body>
            </Card>
          ))}
          <Field testID="new-event-theme-input" label="Temat (opcjonalnie)" value={theme} onChangeText={setTheme} />
          <Field testID="new-event-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 80 }} />
        </View>
        <ChipRow>{DAYS.map(([k, l]) => <Chip key={k} testID={`new-event-day-${k}`} label={l} selected={day === k} onPress={() => setDay(k)} />)}</ChipRow>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-event-time-input" label="Godzina" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
          <Body muted>Liczba miejsc (z Tobą)</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            <Button testID="new-event-capacity-minus" title="−" variant="ghost" onPress={() => setCapacity(Math.max(2, capacity - 1))} />
            <Title size={28} testID="new-event-capacity">{capacity}</Title>
            <Button testID="new-event-capacity-plus" title="+" variant="ghost" onPress={() => setCapacity(Math.min(50, capacity + 1))} />
          </View>
          <Button testID="new-event-save-button" title="Utwórz stół" loading={busy} onPress={() => void save()} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

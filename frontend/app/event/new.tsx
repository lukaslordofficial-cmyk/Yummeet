import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AttractionPicker, type DraftAttraction } from "@/src/components/AttractionPicker";
import { PlaceSearch } from "@/src/components/PlaceSearch";
import { Body, Button, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { addEventAttraction, eventCreate } from "@/src/lib/data";
import { EVENT_DAYS, EVENT_KINDS, resolveEventStart, todayIso } from "@/src/lib/eventKinds";
import type { GeocodeResult } from "@/src/lib/routing";
import { spacing, useTheme } from "@/src/theme";

export default function NewEvent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ missionUm?: string }>();
  const fromMission = !!params.missionUm;
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState<GeocodeResult | null>(null);
  const [kind, setKind] = useState("open_table");
  const [day, setDay] = useState("1");
  const [customDate, setCustomDate] = useState(todayIso());
  const [time, setTime] = useState("19:00");
  const [capacity, setCapacity] = useState(4);
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<DraftAttraction[]>([]);

  const kindMeta = useMemo(() => EVENT_KINDS.find((k) => k.key === kind), [kind]);

  const save = async () => {
    if (title.trim().length < 3) return toast("Podaj tytuł", "error");
    if (!venue) return toast("Wybierz lokalizację z podpowiedzi (potrzebne GPS do kodu obecności).", "error");
    const d = resolveEventStart(day, customDate, time);
    if (!d) return toast(day === "custom" ? "Data RRRR-MM-DD i godzina GG:MM" : "Godzina w formacie GG:MM", "error");
    if (d.getTime() < Date.now() - 60_000) return toast("Termin musi być w przyszłości", "error");
    setBusy(true);
    try {
      const id = await eventCreate({
        title, place: venue.title, startsAt: d.toISOString(), capacity, kind, theme, description,
        rules: "Spotkanie w miejscu publicznym.", placeLat: venue.lat, placeLng: venue.lng,
      });
      for (const a of picked) {
        try { await addEventAttraction(id, a.category, a.title, a.body); } catch { /* ignore */ }
      }
      toast(
        fromMission
          ? "Spotkanie utworzone! Misja zaliczy się, gdy ktoś się zapisze i wpisze kod check-in."
          : "Spotkanie utworzone!",
        "success",
      );
      router.replace(`/event/${id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="new-event-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={fromMission ? "Spotkanie do misji" : "Nowe spotkanie"} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {fromMission ? (
          <Body style={{ paddingHorizontal: spacing.lg }}>
            Sugerowane 4 miejsca. Misja zaliczy się automatycznie, gdy co najmniej 1 gość się zapisze i wpisze kod check-in.
          </Body>
        ) : null}
        <ChipRow>
          {EVENT_KINDS.map((k) => (
            <Chip key={k.key} testID={`new-event-kind-${k.key}`} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </ChipRow>
        {kindMeta ? <Body muted style={{ paddingHorizontal: spacing.lg }} testID="new-event-kind-hint">{kindMeta.hint}</Body> : null}

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-event-title-input" label="Tytuł" value={title} onChangeText={setTitle} placeholder="np. Ramen dla nieznajomych" />
          <PlaceSearch testID="new-event-place" label="Miejsce (publiczne)" value={venue} onPick={setVenue} placeholder="np. War… / Jag… / Dworzec PKP" />
          <Field testID="new-event-theme-input" label="Temat (opcjonalnie)" value={theme} onChangeText={setTheme} />
          <Field testID="new-event-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 80 }} />
        </View>

        <ChipRow>
          {EVENT_DAYS.map(([k, l]) => (
            <Chip key={k} testID={`new-event-day-${k}`} label={l} selected={day === k} onPress={() => setDay(k)} />
          ))}
        </ChipRow>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {day === "custom" ? (
            <Field testID="new-event-custom-date" label="Data (RRRR-MM-DD)" value={customDate} onChangeText={setCustomDate} placeholder="2026-10-20" keyboardType="numbers-and-punctuation" />
          ) : null}
          <Field testID="new-event-time-input" label="Godzina" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
          <Body muted>Liczba miejsc (z Tobą)</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            <Button testID="new-event-capacity-minus" title="−" variant="ghost" onPress={() => setCapacity(Math.max(2, capacity - 1))} />
            <Title size={28} testID="new-event-capacity">{capacity}</Title>
            <Button testID="new-event-capacity-plus" title="+" variant="ghost" onPress={() => setCapacity(Math.min(50, capacity + 1))} />
          </View>
          <AttractionPicker picked={picked} onChange={setPicked} />
          <Button testID="new-event-save-button" title="Utwórz stół" loading={busy} onPress={() => void save()} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

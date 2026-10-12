import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlaceSearch } from "@/src/components/PlaceSearch";
import { Body, Button, Card, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  addEventAttraction,
  attractionSuggestions,
  eventCreate,
  type AttractionCategory,
} from "@/src/lib/data";
import type { GeocodeResult } from "@/src/lib/routing";
import { spacing, useTheme } from "@/src/theme";

const KINDS: { key: string; label: string; hint: string }[] = [
  { key: "open_table", label: "Otwarty stół", hint: "Luźne spotkanie przy wspólnym stole — każdy może dołączyć." },
  { key: "speed_friending", label: "Speed Friending", hint: "Krótkie rundy rozmów — poznajesz kilka osób po kolei." },
  { key: "dinner", label: "Kolacja tematyczna", hint: "Wspólna kolacja wokół tematu (kuchnia, kultura, hobby)." },
  { key: "food_exchange", label: "Wymiana potraw", hint: "Każdy przynosi danie — wymiana smaków i przepisów." },
  { key: "volunteer", label: "Wolontariat", hint: "Spotkanie z celem społecznym / pomocą innym." },
];

const DAYS = [
  ["0", "Dziś"],
  ["1", "Jutro"],
  ["3", "Za 3 dni"],
  ["7", "Za tydzień"],
  ["custom", "Własna data"],
] as const;

const ATTR_TABS: { key: AttractionCategory; label: string }[] = [
  { key: "questions", label: "Pytania" },
  { key: "games", label: "Gry" },
  { key: "challenges", label: "Wyzwania" },
];

type DraftAttraction = { key: string; category: AttractionCategory; title: string; body: string };

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function NewEvent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
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
  const [attrTab, setAttrTab] = useState<AttractionCategory>("questions");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [picked, setPicked] = useState<DraftAttraction[]>([]);
  const [customAttrTitle, setCustomAttrTitle] = useState("");
  const [customAttrBody, setCustomAttrBody] = useState("");

  const kindMeta = useMemo(() => KINDS.find((k) => k.key === kind), [kind]);

  useEffect(() => {
    attractionSuggestions(attrTab).then((rows) => setSuggestions((rows as any[]) || [])).catch(() => setSuggestions([]));
  }, [attrTab]);

  const toggleSuggestion = (s: any) => {
    const key = `sug:${s.id}`;
    setPicked((prev) => {
      if (prev.some((p) => p.key === key)) return prev.filter((p) => p.key !== key);
      return [...prev, { key, category: attrTab, title: s.title, body: s.body || "" }];
    });
  };

  const addCustomAttraction = () => {
    if (customAttrTitle.trim().length < 2) return toast("Podaj tytuł atrakcji", "error");
    const key = `custom:${Date.now()}`;
    setPicked((prev) => [...prev, { key, category: attrTab, title: customAttrTitle.trim(), body: customAttrBody.trim() }]);
    setCustomAttrTitle("");
    setCustomAttrBody("");
  };

  const save = async () => {
    const m = time.match(/^(\d{1,2}):(\d{2})$/);
    if (title.trim().length < 3) return toast("Podaj tytuł", "error");
    if (!venue) return toast("Wybierz lokalizację z podpowiedzi (potrzebne GPS do kodu obecności).", "error");
    if (!m) return toast("Godzina w formacie GG:MM", "error");
    let d: Date;
    if (day === "custom") {
      const dm = customDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dm) return toast("Data w formacie RRRR-MM-DD", "error");
      d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(m[1]), Number(m[2]), 0, 0);
    } else {
      d = new Date();
      d.setDate(d.getDate() + Number(day));
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    }
    if (d.getTime() < Date.now() - 60_000) return toast("Termin musi być w przyszłości", "error");
    setBusy(true);
    try {
      const id = await eventCreate({
        title,
        place: venue.title,
        startsAt: d.toISOString(),
        capacity,
        kind,
        theme,
        description,
        rules: "Spotkanie w miejscu publicznym.",
        placeLat: venue.lat,
        placeLng: venue.lng,
      });
      for (const a of picked) {
        try {
          await addEventAttraction(id, a.category, a.title, a.body);
        } catch {
          /* ignore single attraction failure */
        }
      }
      toast("Stół utworzony!", "success");
      router.replace(`/event/${id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="new-event-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Nowy stół" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <ChipRow>
          {KINDS.map((k) => (
            <Chip key={k.key} testID={`new-event-kind-${k.key}`} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </ChipRow>
        {kindMeta ? (
          <Body muted style={{ paddingHorizontal: spacing.lg }} testID="new-event-kind-hint">
            {kindMeta.hint}
          </Body>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-event-title-input" label="Tytuł" value={title} onChangeText={setTitle} placeholder="np. Ramen dla nieznajomych" />
          <PlaceSearch testID="new-event-place" label="Miejsce (publiczne)" value={venue} onPick={setVenue} placeholder="np. War… / Jag… / Dworzec PKP" />
          <Field testID="new-event-theme-input" label="Temat (opcjonalnie)" value={theme} onChangeText={setTheme} />
          <Field testID="new-event-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 80 }} />
        </View>

        <ChipRow>
          {DAYS.map(([k, l]) => (
            <Chip key={k} testID={`new-event-day-${k}`} label={l} selected={day === k} onPress={() => setDay(k)} />
          ))}
        </ChipRow>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {day === "custom" ? (
            <Field
              testID="new-event-custom-date"
              label="Data (RRRR-MM-DD)"
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="2026-10-20"
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
          <Field testID="new-event-time-input" label="Godzina" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
          <Body muted>Liczba miejsc (z Tobą)</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            <Button testID="new-event-capacity-minus" title="−" variant="ghost" onPress={() => setCapacity(Math.max(2, capacity - 1))} />
            <Title size={28} testID="new-event-capacity">{capacity}</Title>
            <Button testID="new-event-capacity-plus" title="+" variant="ghost" onPress={() => setCapacity(Math.min(50, capacity + 1))} />
          </View>
        </View>

        <Title size={18} style={{ paddingHorizontal: spacing.lg }}>Atrakcje (opcjonalnie)</Title>
        <Body muted style={{ paddingHorizontal: spacing.lg }}>Wybierz propozycje lub dodaj własne — trafią na stół po utworzeniu.</Body>
        <ChipRow testID="new-event-attr-tabs">
          {ATTR_TABS.map((t) => (
            <Chip key={t.key} testID={`new-event-attr-tab-${t.key}`} label={t.label} selected={attrTab === t.key} onPress={() => setAttrTab(t.key)} />
          ))}
        </ChipRow>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {suggestions.map((s) => {
            const selected = picked.some((p) => p.key === `sug:${s.id}`);
            return (
              <Card key={s.id} testID={`new-event-sug-${s.id}`} onPress={() => toggleSuggestion(s)}>
                <Title size={16}>{selected ? "✓ " : ""}{s.title}</Title>
                {s.body ? <Body muted>{s.body}</Body> : null}
              </Card>
            );
          })}
          <Field testID="new-event-attr-title" label="Własna atrakcja" value={customAttrTitle} onChangeText={setCustomAttrTitle} placeholder="np. 20 pompek" />
          <Field testID="new-event-attr-body" label="Opis" value={customAttrBody} onChangeText={setCustomAttrBody} />
          <Button testID="new-event-attr-add" title="Dodaj własną" variant="ghost" onPress={addCustomAttraction} />
          {picked.length ? (
            <Body muted testID="new-event-attr-count">Wybrane: {picked.length}</Body>
          ) : null}
        </View>

        <Button testID="new-event-save-button" title="Utwórz stół" loading={busy} onPress={() => void save()} style={{ marginHorizontal: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

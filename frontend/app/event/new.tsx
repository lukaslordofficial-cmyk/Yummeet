import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AttractionPicker, type DraftAttraction } from "@/src/components/AttractionPicker";
import { DishDraftEditor, type DishDraft } from "@/src/components/meetings/DishDraftEditor";
import { MeetingPickList } from "@/src/components/meetings/MeetingPickList";
import { PlaceSearch } from "@/src/components/PlaceSearch";
import { Body, Button, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { addEventAttraction, eventCreate, findNearbyPin } from "@/src/lib/data";
import { EVENT_DAYS, resolveEventStart, todayIso } from "@/src/lib/eventKinds";
import { eventAddDish, eventSetMeeting } from "@/src/lib/meetingData";
import { MEETING_CATEGORIES, categoryByKey, isTastingFormat, subcategoryByKey, type MeetingTemplate } from "@/src/lib/meetingCatalog";
import type { GeocodeResult } from "@/src/lib/routing";
import { spacing, useTheme } from "@/src/theme";

type Step = "category" | "sub" | "idea" | "form";

export default function NewEvent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ missionUm?: string; category?: string }>();
  const fromMission = !!params.missionUm;
  const preset = !fromMission && typeof params.category === "string" ? categoryByKey(params.category) : null;

  const [step, setStep] = useState<Step>(fromMission ? "form" : preset ? "sub" : "category");
  const [category, setCategory] = useState(fromMission ? "poznaj" : preset?.key ?? null);
  const [subKey, setSubKey] = useState<string | null>(fromMission ? "otwarty_stol" : null);
  const [templateKey, setTemplateKey] = useState<string | null>(fromMission ? "blank" : null);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState<GeocodeResult | null>(null);
  const [day, setDay] = useState("1");
  const [customDate, setCustomDate] = useState(todayIso());
  const [time, setTime] = useState("19:00");
  const [capacity, setCapacity] = useState(fromMission ? 4 : 4);
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [dishes, setDishes] = useState<DishDraft[]>([]);
  const [picked, setPicked] = useState<DraftAttraction[]>([]);
  const [busy, setBusy] = useState(false);

  const cat = categoryByKey(category);
  const sub = subcategoryByKey(category, subKey);
  const tasting = isTastingFormat(sub?.format);
  const template: MeetingTemplate | null = useMemo(
    () => sub?.templates.find((t) => t.key === templateKey) ?? null,
    [sub, templateKey],
  );

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const next = sub?.templates.find((t) => t.key === key);
    if (next) {
      setTitle(next.name);
      setDescription(next.agenda.map((line, i) => `${i + 1}. ${line}`).join("\n"));
      setCapacity(next.capacity);
      setTheme(sub?.label ?? "");
    } else {
      setTitle("");
      setDescription("");
      setCapacity(4);
      setTheme(sub?.label ?? "");
    }
    if (sub?.format === "one_dish") setDishes([{ name: "", description: "" }]);
    if (sub?.format === "shared_dishes") setDishes([{ name: "", description: "" }, { name: "", description: "" }, { name: "", description: "" }]);
    setStep("form");
  };

  const save = async () => {
    if (!sub) return;
    if (title.trim().length < 3) return toast("Podaj tytuł", "error");
    if (!venue) return toast("Wybierz lokalizację z podpowiedzi (potrzebne GPS do kodu obecności).", "error");
    const d = resolveEventStart(day, customDate, time);
    if (!d) return toast(day === "custom" ? "Data RRRR-MM-DD i godzina GG:MM" : "Godzina w formacie GG:MM", "error");
    if (d.getTime() < Date.now() - 60_000) return toast("Termin musi być w przyszłości", "error");
    const budgetN = budget.trim() ? Number(budget) : null;
    if (budgetN != null && (!Number.isFinite(budgetN) || budgetN < 0)) return toast("Budżet na osobę podaj liczbą", "error");
    setBusy(true);
    try {
      const pin = tasting ? await findNearbyPin(venue.lat, venue.lng, 80) : null;
      const payload = {
        title, place: venue.title, startsAt: d.toISOString(), capacity, description, theme,
        rules: "Spotkanie w miejscu publicznym.", placeLat: venue.lat, placeLng: venue.lng, pinId: pin?.id ?? null,
      };
      let id: string;
      try {
        id = await eventCreate({ ...payload, kind: sub.kind });
      } catch (e) {
        if (sub.kind !== "tasting") throw e;
        id = await eventCreate({ ...payload, kind: "dinner" });
      }
      try {
        await eventSetMeeting({
          eventId: id, category: category ?? "", subcategory: sub.key, template: templateKey ?? "blank",
          kind: sub.kind, durationMin: template?.durationMin ?? null, budget: budgetN,
        });
        for (const dish of dishes) {
          if (dish.name.trim()) await eventAddDish(id, dish.name.trim(), dish.description.trim());
        }
      } catch (e) {
        toast(errorMessage(e), "error");
        router.replace(`/event/${id}`);
        return;
      }
      for (const a of picked) {
        try { await addEventAttraction(id, a.category, a.title, a.body); } catch { /* ignore */ }
      }
      toast(fromMission ? "Spotkanie utworzone. Misja zaliczy się, gdy gość zrobi check-in." : "Spotkanie utworzone!", "success");
      router.replace(`/event/${id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const header = step === "category" ? "Nowe spotkanie" : step === "sub" ? cat?.label ?? "Kategoria" : step === "idea" ? sub?.label ?? "Pomysł" : "Ustawienia spotkania";

  return (
    <View testID="new-event-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={header} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {step === "category" ? (
          <MeetingPickList testID="meeting-category" items={MEETING_CATEGORIES.map((c) => ({ key: c.key, title: c.label, text: c.blurb }))} onPick={(key) => { setCategory(key); setSubKey(null); setStep("sub"); }} />
        ) : null}
        {step === "sub" && cat ? (
          <>
            <Button testID="meeting-back-category" title="Wróć do kategorii" variant="ghost" onPress={() => setStep("category")} style={{ marginHorizontal: spacing.lg }} />
            <MeetingPickList testID="meeting-sub" items={cat.subs.map((s) => ({ key: s.key, title: s.label, text: s.blurb }))} onPick={(key) => { setSubKey(key); setTemplateKey(null); setDishes([]); setStep("idea"); }} />
          </>
        ) : null}
        {step === "idea" && sub ? (
          <>
            <Button testID="meeting-back-sub" title="Wróć do podkategorii" variant="ghost" onPress={() => setStep("sub")} style={{ marginHorizontal: spacing.lg }} />
            <MeetingPickList
              testID="meeting-idea"
              items={[
                ...sub.templates.map((t) => ({ key: t.key, title: t.name, text: t.blurb })),
                { key: "blank", title: "Puste spotkanie", text: "Tylko tytuł, miejsce i godzina. Resztę dopiszesz później." },
              ]}
              onPick={applyTemplate}
            />
          </>
        ) : null}
        {step === "form" && sub ? (
          <>
            {!fromMission ? <Button testID="meeting-back-idea" title="Wróć do pomysłów" variant="ghost" onPress={() => setStep("idea")} style={{ marginHorizontal: spacing.lg }} /> : null}
            <Body muted style={{ paddingHorizontal: spacing.lg }} testID="new-event-kind-hint">{cat?.label} · {sub.label}. {sub.blurb}</Body>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Field testID="new-event-title-input" label="Tytuł" value={title} onChangeText={setTitle} placeholder="np. Ramen dla nieznajomych" />
              <PlaceSearch testID="new-event-place" label="Miejsce (publiczne)" value={venue} onPick={setVenue} placeholder="np. War… / Jag… / Dworzec PKP" />
              <Field testID="new-event-theme-input" label="Temat (opcjonalnie)" value={theme} onChangeText={setTheme} />
              <Field testID="new-event-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 80 }} />
              {tasting ? <Field testID="new-event-budget" label="Budżet na osobę, zł (opcjonalnie)" value={budget} onChangeText={setBudget} keyboardType="number-pad" /> : null}
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
              {tasting ? (
                <DishDraftEditor
                  dishes={dishes}
                  onChange={setDishes}
                  hint={sub.format === "one_dish" ? "Wszyscy oceniacie to samo danie. Opis zobaczą później ludzie na pinie." : "Różne dania, porcje do dzielenia. Każdy ocenia to, czego spróbował."}
                />
              ) : <AttractionPicker picked={picked} onChange={setPicked} />}
              <Button testID="new-event-save-button" title="Utwórz spotkanie" loading={busy} onPress={() => void save()} />
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

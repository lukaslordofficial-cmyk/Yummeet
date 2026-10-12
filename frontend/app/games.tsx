import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Chip, ChipRow, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { ATTR_CATEGORY_HINTS, type AttractionCategory } from "@/src/lib/attractionsCatalog";
import {
  addEventAttraction, attractionSuggestions, eventAttractions, removeEventAttraction,
} from "@/src/lib/data";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

const TABS: { key: AttractionCategory; label: string }[] = [
  { key: "questions", label: "Pytania" },
  { key: "games", label: "Gry" },
  { key: "challenges", label: "Wyzwania" },
];

export default function Attractions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useAuth();
  const { event } = useLocalSearchParams<{ event?: string }>();
  const [tab, setTab] = useState<AttractionCategory>("questions");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [organizerId, setOrganizerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sug, rows] = await Promise.all([
        attractionSuggestions(tab),
        event ? eventAttractions(event) : Promise.resolve([]),
      ]);
      setSuggestions((sug as any[]) || []);
      setMine(((rows as any[]) || []).filter((r) => r.category === tab));
      if (event) {
        const { getEvent } = await import("@/src/lib/data");
        setOrganizerId((await getEvent(event))?.organizer_id ?? null);
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, [tab, event, toast]);

  useEffect(() => { load(); }, [load]);

  const isOrganizer = !!event && organizerId === session?.user.id;

  const addCustom = async () => {
    if (!event || !isOrganizer) return toast("Tylko organizator dodaje atrakcje do stołu.", "info");
    if (title.trim().length < 2) return toast("Podaj tytuł", "error");
    setBusy(true);
    try {
      await addEventAttraction(event, tab, title, body);
      setTitle(""); setBody(""); toast("Dodano!", "success"); load();
    } catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(false); }
  };

  const addFromSuggestion = async (s: any) => {
    if (!event || !isOrganizer) return toast("Otwórz Atrakcje ze stołu jako organizator.", "info");
    setBusy(true);
    try {
      await addEventAttraction(event, tab, s.title, s.body);
      toast("Dodano propozycję do stołu", "success"); load();
    } catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(false); }
  };

  return (
    <View testID="games-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Atrakcje" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <ChipRow testID="attractions-tabs">
          {TABS.map((t) => (
            <Chip key={t.key} testID={`attractions-tab-${t.key}`} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ChipRow>
        <Body muted style={{ paddingHorizontal: spacing.lg }} testID="attractions-hint">{ATTR_CATEGORY_HINTS[tab]}</Body>

        {event && isOrganizer ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <Title size={18}>Twoje kafelki przy stole</Title>
            {mine.length === 0 ? <Body muted>Brak — dodaj z propozycji lub stwórz własne.</Body> : null}
            {mine.map((m) => (
              <Card key={m.id} testID={`attraction-mine-${m.id}`}>
                <Title size={16}>{m.title}</Title>
                {m.body ? <Body muted>{m.body}</Body> : null}
                <Button testID={`attraction-delete-${m.id}`} title="Usuń" variant="ghost" onPress={async () => { await removeEventAttraction(m.id); load(); }} />
              </Card>
            ))}
            <Title size={18}>Stwórz własne</Title>
            <Field testID="attraction-title" label="Tytuł" value={title} onChangeText={setTitle} placeholder="np. 20 pompek" />
            <Field testID="attraction-body" label="Opis" value={body} onChangeText={setBody} multiline style={{ minHeight: 70 }} />
            <Button testID="attraction-add" title="Dodaj do stołu" loading={busy} onPress={() => void addCustom()} />
          </View>
        ) : event ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <Title size={18}>Atrakcje tego stołu</Title>
            {mine.length === 0 ? <Body muted>Organizator jeszcze nic nie dodał.</Body> : null}
            {mine.map((m) => (
              <Card key={m.id}><Title size={16}>{m.title}</Title>{m.body ? <Body muted>{m.body}</Body> : null}</Card>
            ))}
          </View>
        ) : (
          <Body muted style={{ paddingHorizontal: spacing.lg }}>Otwórz Atrakcje ze szczegółów stołu, żeby przypisać je do wydarzenia.</Body>
        )}

        <Title size={18} style={{ paddingHorizontal: spacing.lg }}>Propozycje pomocnicze</Title>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {suggestions.length === 0 ? <Body muted>Brak propozycji.</Body> : null}
          {suggestions.map((s) => (
            <Card key={s.id} testID={`attraction-sug-${s.id}`}>
              <Title size={16}>{s.title}</Title>
              <Body muted>{s.body}</Body>
              {event && isOrganizer ? (
                <Button testID={`attraction-use-${s.id}`} title="Dodaj do stołu" variant="secondary" loading={busy} onPress={() => void addFromSuggestion(s)} />
              ) : null}
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

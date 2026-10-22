import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlanEditor } from "@/src/components/meetings/PlanEditor";
import { StoryTable } from "@/src/components/meetings/StoryTable";
import { Body, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import type { AttractionCategory } from "@/src/lib/attractionsCatalog";
import { addEventAttraction, eventAttractions, getEvent, myEventStatus, removeEventAttraction } from "@/src/lib/data";
import { SOCIAL_GAMES, type PlanItem } from "@/src/lib/meetingPlan";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MeetingPlan() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useAuth();
  const { event } = useLocalSearchParams<{ event?: string }>();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const saving = useRef(false);

  const load = useCallback(async () => {
    if (!event) return;
    try {
      const [rows, status, ev] = await Promise.all([
        eventAttractions(event),
        myEventStatus(event).catch(() => undefined),
        getEvent(event),
      ]);
      setItems(((rows as Array<{ id: string; category: string; title: string; body: string | null }>) || [])
        .filter((r) => r.category === "questions" || r.category === "games")
        .map((r) => ({ key: r.id, category: r.category as AttractionCategory, title: r.title, body: r.body ?? "" })));
      setJoined(status === "joined" || status === "attended" || ev?.organizer_id === session?.user.id);
      setOrganizerId(ev?.organizer_id ?? null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, [event, toast, session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  const isOrganizer = !!event && organizerId === session?.user.id;
  const storyOn = items.some((i) => i.title === SOCIAL_GAMES.find((g) => g.id === "runaway-story")?.title);

  const persist = async (next: PlanItem[]) => {
    if (!event || !isOrganizer || saving.current) return;
    saving.current = true;
    const removed = items.filter((c) => !next.some((n) => n.key === c.key));
    const added = next.filter((n) => !items.some((c) => c.key === n.key));
    const edited = next.filter((n) => {
      const prev = items.find((c) => c.key === n.key);
      return prev && (prev.body !== n.body || prev.title !== n.title);
    });
    try {
      for (const row of removed) if (UUID.test(row.key)) await removeEventAttraction(row.key);
      for (const row of edited) {
        if (!UUID.test(row.key)) continue;
        await removeEventAttraction(row.key);
        await addEventAttraction(event, row.category === "challenges" ? "games" : row.category, row.title, row.body);
      }
      for (const row of added) {
        await addEventAttraction(event, row.category === "challenges" ? "games" : row.category, row.title, row.body);
      }
      await load();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      saving.current = false;
    }
  };

  return (
    <View testID="games-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Plan spotkania" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {!event ? (
          <Body muted>Plan ustawia organizator przy tworzeniu spotkania albo tutaj, po otwarciu go ze szczegółów spotkania. Goście widzą pulę pytań przed dołączeniem.</Body>
        ) : null}
        <PlanEditor
          items={items}
          canEdit={isOrganizer}
          browse={!event}
          play={isOrganizer || joined}
          noteCommit="button"
          onChange={isOrganizer ? (next) => void persist(next) : undefined}
        />
        {event && storyOn && (isOrganizer || joined) ? <StoryTable eventId={event} canClose={isOrganizer} /> : null}
        {event && storyOn && !isOrganizer && !joined ? <Body muted>Dołącz do spotkania, żeby dopisywać wspólną historię.</Body> : null}
      </ScrollView>
    </View>
  );
}

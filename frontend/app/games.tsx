import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MeetingPlay } from "@/src/components/meetings/MeetingPlay";
import { PlanEditor } from "@/src/components/meetings/PlanEditor";
import { Body, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import type { AttractionCategory } from "@/src/lib/attractionsCatalog";
import { eventAttractions, getEvent, myEventStatus } from "@/src/lib/data";
import { type PlanItem } from "@/src/lib/meetingPlan";
import { hasScannedEvent, rememberScannedEvent } from "@/src/lib/scannedEvents";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

export default function MeetingPlan() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useAuth();
  const { event, scanned: scannedParam } = useLocalSearchParams<{ event?: string; scanned?: string }>();
  const [scanned, setScanned] = useState(scannedParam === "1");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

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
  useEffect(() => {
    if (!event) return;
    if (scannedParam === "1") {
      setScanned(true);
      void rememberScannedEvent(event);
      return;
    }
    void hasScannedEvent(event).then(setScanned);
  }, [event, scannedParam]);

  const isOrganizer = !!event && organizerId === session?.user.id;

  return (
    <View testID="games-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Panel spotkania" centerTitle />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.xxl }}>
        {!event ? (
          <Body muted>Panel otwiera się ze spotkania. Organizator układa plan przy tworzeniu, a zabawy startuje tutaj.</Body>
        ) : (
          <MeetingPlay eventId={event} items={items} isOrganizer={isOrganizer} scanned={scanned || isOrganizer} />
        )}
        {!event ? (
          <PlanEditor items={items} canEdit={false} browse play={false} />
        ) : null}
        {event && !joined && !isOrganizer ? <Body muted>Dołącz do spotkania, żeby grać po zeskanowaniu kodu.</Body> : null}
      </ScrollView>
    </View>
  );
}

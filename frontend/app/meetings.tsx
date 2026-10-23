import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KIND_LABEL, formatDate } from "@/src/components/EventCard";
import { Icon } from "@/src/components/Icon";
import { Body, Button, EmptyState, ErrorState, Header, Loading, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { myMeetingJournal, type MeetingJournalEntry } from "@/src/lib/data";
import { PlanNoteView } from "@/src/components/meetings/PlanNoteView";
import { splitPlan, storyColorKey } from "@/src/lib/meetingPlan";
import { radius, spacing, useTheme } from "@/src/theme";

export default function MeetingsJournal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<MeetingJournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await myMeetingJournal());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View testID="meetings-journal-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Dziennik Spotkań" />
      {error ? <ErrorState message={error} onRetry={load} /> : rows === null ? <Loading /> : (
        <FlatList
          data={rows}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="meetings-empty" icon="notebook-outline" title="Brak spotkań" text="Dołącz do spotkania albo zorganizuj własne — tu zobaczysz historię." />}
          renderItem={({ item }) => {
            const open = openId === item.id;
            const plan = splitPlan(item.attractions ?? []);
            return (
              <View testID={`meeting-${item.id}`} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.md, gap: spacing.sm }}>
                <Pressable
                  testID={`meeting-toggle-${item.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenId(open ? null : item.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                >
                  <Title size={18} style={{ flex: 1 }}>{item.title}</Title>
                  <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.muted} />
                </Pressable>
                {open ? (
                  <View style={{ gap: spacing.sm }}>
                    <Body muted>{KIND_LABEL[item.kind] ?? item.kind} · {formatDate(item.starts_at)} · {item.place_name}</Body>
                    {item.description ? <Body>{item.description}</Body> : null}
                    {item.theme ? <Body muted>Temat: {item.theme}</Body> : null}
                    {plan.note?.body ? <PlanNoteView body={plan.note.body} /> : null}
                    {plan.questions.length ? (
                      <View style={{ gap: 4 }}>
                        <Body muted>Pula pytań · {plan.limit} na osobę</Body>
                        {plan.questions.map((q) => <Body key={q.id ?? q.title}>• {q.title}</Body>)}
                      </View>
                    ) : null}
                    {plan.games.length ? (
                      <View style={{ gap: 4 }}>
                        <Body muted>Gry</Body>
                        {plan.games.map((g) => <Body key={g.id ?? g.title}>• {g.title}</Body>)}
                      </View>
                    ) : null}
                    {plan.legacy.length ? plan.legacy.map((g) => <Body key={g.id ?? g.title}>• {g.title}</Body>) : null}
                    {item.question_draws?.length ? (
                      <View style={{ gap: 4 }}>
                        <Body muted>Zabawa w pytania</Body>
                        {item.question_draws.map((row, index) => (
                          <Body key={`${row.name}-${index}`}>{row.name}: {row.question}</Body>
                        ))}
                      </View>
                    ) : null}
                    {item.truths?.length ? (
                      <View style={{ gap: 4 }}>
                        <Body muted>Prawda czy kłamstwo</Body>
                        {item.truths.map((row) => (
                          <Body key={row.name}>{row.name}: prawdy — {row.truths.filter(Boolean).join("; ")}. Kłamstwo — {row.lie}.</Body>
                        ))}
                      </View>
                    ) : null}
                    {item.find_answers?.length || item.find_scores?.length ? (
                      <View style={{ gap: 4 }}>
                        <Body muted>Znajdź kogoś, kto…</Body>
                        {item.find_scores?.map((row) => (
                          <Body key={`score-${row.name}`}>{row.name}: {row.score} pkt</Body>
                        ))}
                        {item.find_answers?.map((row, index) => (
                          <Body key={`${row.prompt}-${row.name}-${index}`}>{row.name} na „{row.prompt}”: {row.yes ? "tak" : "nie"}</Body>
                        ))}
                      </View>
                    ) : null}
                    {item.story?.length ? (
                      <View style={{ gap: 4 }}>
                        <Body muted>Historia</Body>
                        {item.story.map((line) => (
                          <Body key={line.id} style={{ color: colors[storyColorKey(line.author_id)] }}>{line.author}: {line.body}</Body>
                        ))}
                      </View>
                    ) : null}
                    {item.photos?.length ? (
                      <View style={{ gap: spacing.sm }}>
                        <Body muted>Wspólne zdjęcia</Body>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                          {item.photos.slice(0, 6).map((p) => (
                            <Image key={p.id} source={{ uri: p.photo_url }} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
                          ))}
                        </View>
                      </View>
                    ) : null}
                    <Button testID={`meeting-open-${item.id}`} title="Otwórz spotkanie" variant="secondary" onPress={() => router.push(`/event/${item.id}`)} />
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KIND_LABEL, formatDate } from "@/src/components/EventCard";
import { Body, EmptyState, ErrorState, Header, Loading, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { myMeetingJournal, type MeetingJournalEntry } from "@/src/lib/data";
import { radius, spacing, useTheme } from "@/src/theme";

const CAT: Record<string, string> = {
  questions: "Pytania",
  games: "Gry",
  challenges: "Wyzwania",
};

export default function MeetingsJournal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<MeetingJournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="meetings-empty" icon="notebook-outline" title="Brak spotkań" text="Dołącz do spotkania albo zorganizuj własne — tu zobaczysz historię." />}
          renderItem={({ item }) => (
            <Pressable
              testID={`meeting-${item.id}`}
              onPress={() => router.push(`/event/${item.id}`)}
              style={{ gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Title size={18}>{item.title}</Title>
              <Body muted>{KIND_LABEL[item.kind] ?? item.kind} · {formatDate(item.starts_at)} · {item.place_name}</Body>
              {item.description ? <Body numberOfLines={4}>{item.description}</Body> : null}
              {item.theme ? <Body muted>Temat: {item.theme}</Body> : null}
              {item.attractions?.length ? (
                <View style={{ gap: 4 }}>
                  <Body muted>Atrakcje / pytania</Body>
                  {item.attractions.slice(0, 6).map((a) => (
                    <Body key={a.id}>• [{CAT[a.category] ?? a.category}] {a.title}{a.body ? ` — ${a.body}` : ""}</Body>
                  ))}
                </View>
              ) : null}
              {item.photos?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {item.photos.slice(0, 6).map((p) => (
                    <Image key={p.id} source={{ uri: p.photo_url }} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
                  ))}
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

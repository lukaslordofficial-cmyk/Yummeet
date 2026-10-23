import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Card, Chip, ChipRow, Field, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  STORY_HOOKS, STORY_STARTERS, STORY_WORDS, drawIndex, drawStoryStarter, storyColorKey, type StoryPickMode,
} from "@/src/lib/meetingPlan";
import { eventStoryAdd, eventStoryBoard, eventStoryClose, eventStoryDrawLine, type StoryBoard } from "@/src/lib/story";
import { useTheme, fonts, radius, spacing } from "@/src/theme";

export function StoryTable({
  eventId,
  canClose,
  planned = [],
  mode = "wybierz",
}: {
  eventId: string;
  canClose: boolean;
  planned?: { title: string; text: string }[];
  mode?: StoryPickMode;
}) {
  const { colors } = useTheme();
  const [board, setBoard] = useState<StoryBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [word, setWord] = useState("");
  const [hooks, setHooks] = useState(false);
  const [openStarter, setOpenStarter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await eventStoryBoard(eventId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [load]);

  const send = async (line: string) => {
    const clean = line.trim();
    if (clean.length < 1) return;
    setBusy(true);
    try {
      await eventStoryAdd(eventId, clean);
      setText("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const roll = (kind: keyof typeof STORY_WORDS | "losowe") => {
    const bag = kind === "losowe" ? Object.values(STORY_WORDS).flat() : STORY_WORDS[kind];
    setWord(bag[drawIndex(bag.length)] ?? "");
  };

  const yourTurn = !!board?.your_turn && !board.closed;
  const waiting = board && !board.closed;
  const storyOpen = canClose && !board?.closed;
  const usedLines = (board?.lines ?? []).map((line) => line.body);
  const proposals = planned.length ? planned : STORY_STARTERS;
  const drawNext = () => {
    const pick = drawStoryStarter(usedLines, planned);
    if (!pick) {
      setError("Nie ma już kolejnego zdania w puli.");
      return;
    }
    void sendDrawn(pick.text);
  };
  const sendDrawn = async (line: string) => {
    const clean = line.trim();
    if (clean.length < 1) return;
    setBusy(true);
    try {
      await eventStoryDrawLine(eventId, clean);
      setError(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }} testID="story-table">
      <Title size={18}>Historia przy stole</Title>
      <Body muted>Rozwiń to, co właśnie się wydarzyło, a na końcu zostaw haczyk dla kolejnej osoby. Nie zamykaj wszystkich wątków. Kolor zdania zostaje przy autorze.</Body>
      {error ? <Body testID="story-error">{error}</Body> : null}
      {waiting ? <Title size={18} testID="story-turn" style={{ textAlign: "center" }}>Teraz mówi i wpisuje: {board.turn_name ?? "uczestnik"}</Title> : null}
      {board?.closed ? <Body testID="story-turn">Historia zamknięta i zapisana.</Body> : null}
      <View testID="story-window" style={{ minHeight: 180, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.lg }}>
        {(board?.lines.length ?? 0) === 0 ? <Body muted>Pierwsze zdanie pojawi się tutaj, gdy organizator je wybierze albo wylosuje.</Body> : null}
        {(board?.lines ?? []).map((line) => (
          <View key={line.id} testID={`story-line-${line.id}`}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: colors[storyColorKey(line.author_id)] }}>{line.body}</Text>
            <Body muted>{line.author}</Body>
          </View>
        ))}
      </View>
      {storyOpen ? (
        <Button
          testID="story-draw-starter"
          title={(board?.lines.length ?? 0) === 0 ? "Wylosuj pierwsze zdanie" : "Wylosuj kolejne zdanie"}
          disabled={busy}
          onPress={drawNext}
        />
      ) : null}
      <ChipRow testID="story-word-kinds">
        <Chip testID="story-word-noun" label="Rzeczownik" onPress={() => roll("rzeczownik")} />
        <Chip testID="story-word-verb" label="Czasownik" onPress={() => roll("czasownik")} />
        <Chip testID="story-word-name" label="Nazwa" onPress={() => roll("nazwa")} />
        <Chip testID="story-word-any" label="Losowe" onPress={() => roll("losowe")} />
      </ChipRow>
      {word ? <Body testID="story-word">Wpleć słowo: {word}. Haczyk na końcu zostaje obowiązkowy.</Body> : null}
      <Button testID="story-hooks" title={hooks ? "Ukryj podpowiedzi" : "Jak zakończyć?"} variant="ghost" onPress={() => setHooks((v) => !v)} />
      {hooks ? STORY_HOOKS.map((h) => <Body key={h}>{h}</Body>) : null}
      {storyOpen ? (
        <Body muted style={{ textAlign: "center" }}>{mode === "losowo" ? "Losowo bierze zdanie spośród zaznaczonych propozycji. Gdy zaznaczone się skończą, dobiera kolejne z całej listy." : "Wybierz zdanie startowe albo wylosuj kolejne, gdy grupa chce więcej."}</Body>
      ) : null}
      {storyOpen ? proposals.map((s) => {
        const open = openStarter === s.title;
        return (
          <Card key={s.title} testID={`story-starter-${s.title}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Title size={16} style={{ flex: 1 }}>{s.title}</Title>
              <Pressable
                testID={`story-starter-expand-${s.title}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenStarter(open ? null : s.title)}
                hitSlop={8}
              >
                <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.brandPrimary} />
              </Pressable>
            </View>
            {open ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <Body>{s.text}</Body>
                <Button testID={`story-use-${s.title}`} title="Użyj tego początku" variant="secondary" disabled={busy} onPress={() => void sendDrawn(s.text)} />
              </View>
            ) : null}
          </Card>
        );
      }) : null}
      <Field testID="story-input" label="Twoje zdanie" value={text} onChangeText={setText} multiline style={{ minHeight: 160 }} editable={yourTurn && !busy} placeholder="Rozwiń sytuację i zostaw haczyk" />
      <Button testID="story-send" title="Dopisz zdanie" disabled={!yourTurn || busy || text.trim().length < 1} loading={busy} onPress={() => void send(text)} />
      {canClose && board && !board.closed ? (
        <Button testID="story-close" title="Zakończ historię" variant="ghost" onPress={() => void eventStoryClose(eventId).then(load).catch((e) => setError(errorMessage(e)))} />
      ) : null}
    </View>
  );
}

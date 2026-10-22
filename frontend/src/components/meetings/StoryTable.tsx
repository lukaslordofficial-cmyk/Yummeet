import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Chip, ChipRow, Field, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  STORY_HOOKS, STORY_STARTERS, STORY_WORDS, drawIndex, storyColorKey,
} from "@/src/lib/meetingPlan";
import { eventStoryAdd, eventStoryBoard, eventStoryClose, type StoryBoard } from "@/src/lib/story";
import { useTheme, spacing } from "@/src/theme";

export function StoryTable({ eventId, canClose }: { eventId: string; canClose: boolean }) {
  const { colors } = useTheme();
  const [board, setBoard] = useState<StoryBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [word, setWord] = useState("");
  const [hooks, setHooks] = useState(false);
  const [starters, setStarters] = useState(false);
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
  const lastId = board?.lines[board.lines.length - 1]?.id;

  return (
    <View style={{ gap: spacing.sm }} testID="story-table">
      <Title size={18}>Historia przy stole</Title>
      <Body muted>Rozwiń to, co właśnie się wydarzyło, a na końcu zostaw haczyk dla kolejnej osoby. Nie zamykaj wszystkich wątków. Kolor zdania zostaje przy autorze.</Body>
      {error ? <Body testID="story-error">{error}</Body> : null}
      {board ? <Body testID="story-turn">{board.closed ? "Historia zamknięta i zapisana." : `Teraz kolej: ${board.turn_name ?? "uczestnik"}`}</Body> : null}
      {(board?.lines ?? []).map((line) => (
        <Card key={line.id} accent={colors[storyColorKey(line.author_id)]} testID={`story-line-${line.id}`}>
          <Body muted>{line.author}{line.id === lastId ? " · ostatnie zdanie" : ""}</Body>
          <Body>{line.body}</Body>
        </Card>
      ))}
      <ChipRow testID="story-word-kinds">
        <Chip testID="story-word-noun" label="Rzeczownik" onPress={() => roll("rzeczownik")} />
        <Chip testID="story-word-verb" label="Czasownik" onPress={() => roll("czasownik")} />
        <Chip testID="story-word-name" label="Nazwa" onPress={() => roll("nazwa")} />
        <Chip testID="story-word-any" label="Losowe" onPress={() => roll("losowe")} />
      </ChipRow>
      {word ? <Body testID="story-word">Wpleć słowo: {word}. Haczyk na końcu zostaje obowiązkowy.</Body> : null}
      <Button testID="story-hooks" title={hooks ? "Ukryj podpowiedzi" : "Jak zakończyć?"} variant="ghost" onPress={() => setHooks((v) => !v)} />
      {hooks ? STORY_HOOKS.map((h) => <Body key={h}>{h}</Body>) : null}
      <Button testID="story-starters" title={starters ? "Ukryj początki" : "Początki historii"} variant="ghost" onPress={() => setStarters((v) => !v)} />
      {starters ? STORY_STARTERS.map((s) => (
        <Card key={s.title} testID={`story-starter-${s.title}`}>
          <Title size={16}>{s.title}</Title>
          <Body>{s.text}</Body>
          <Button testID={`story-use-${s.title}`} title="Użyj tego początku" variant="secondary" disabled={!yourTurn || busy || (board?.lines.length ?? 0) > 0} onPress={() => void send(s.text)} />
        </Card>
      )) : null}
      <Field testID="story-input" label="Twoje zdanie" value={text} onChangeText={setText} multiline style={{ minHeight: 90 }} editable={yourTurn && !busy} placeholder="Rozwiń sytuację i zostaw haczyk" />
      <Button testID="story-send" title="Dopisz zdanie" disabled={!yourTurn || busy || text.trim().length < 1} loading={busy} onPress={() => void send(text)} />
      {canClose && board && !board.closed ? (
        <Button testID="story-close" title="Zakończ historię" variant="ghost" onPress={() => void eventStoryClose(eventId).then(load).catch((e) => setError(errorMessage(e)))} />
      ) : null}
    </View>
  );
}

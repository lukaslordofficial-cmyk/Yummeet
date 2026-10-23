import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { SOCIAL_GAMES, isQuestionPoolItem, isStoryStarterTitle, type PlanItem } from "@/src/lib/meetingPlan";
import { eventPlayAnswered, eventPlayBoard, eventPlayDraw, eventPlayStart, type PlayBoard } from "@/src/lib/play";
import { spacing } from "@/src/theme";

import { FindRound } from "./FindRound";
import { StoryTable } from "./StoryTable";
import { TwoTruthsPlay } from "./TwoTruthsPlay";

const LABELS: Record<string, string> = {
  questions: "Zabawa w pytania",
  "two-truths": "Dwie prawdy i jedno kłamstwo",
  "find-someone": "Znajdź kogoś, kto…",
  "runaway-story": "Historia, która wymknęła się spod kontroli",
};

function selectedKeys(items: PlanItem[]) {
  const keys: string[] = [];
  if (items.some((item) => isQuestionPoolItem(item))) keys.push("questions");
  for (const game of SOCIAL_GAMES) {
    const picked = items.some((item) => item.title === game.title || (game.id === "runaway-story" && isStoryStarterTitle(item.title)));
    if (picked) keys.push(game.id);
  }
  return keys;
}

/** Panel zabaw: gość widzi grę po skanie QR, organizator ją startuje. */
export function MeetingPlay({
  eventId,
  items,
  isOrganizer,
  scanned,
}: {
  eventId: string;
  items: PlanItem[];
  isOrganizer: boolean;
  scanned: boolean;
}) {
  const [board, setBoard] = useState<PlayBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = selectedKeys(items);
  const labels = keys.map((key) => LABELS[key] ?? key);

  const load = useCallback(async () => {
    if (!isOrganizer && !scanned) return;
    try {
      setBoard(await eventPlayBoard(eventId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [eventId, isOrganizer, scanned]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (action: () => Promise<PlayBoard>) => {
    setBusy(true);
    try {
      setBoard(await action());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!isOrganizer && !scanned) {
    return (
      <View style={{ gap: spacing.lg }} testID="meeting-play-locked">
        <Title size={18} style={{ textAlign: "center" }}>Wybrane zabawy</Title>
        {labels.length ? labels.map((label) => (
          <Card key={label}><Title size={16} style={{ textAlign: "center" }}>{label}</Title></Card>
        )) : <Body muted style={{ textAlign: "center" }}>Organizator nie wybrał jeszcze zabaw.</Body>}
        <Body muted style={{ textAlign: "center" }}>Zeskanuj kod QR albo wpisz go w skanerze, żeby wejść do zabawy.</Body>
      </View>
    );
  }

  const live = board?.status === "live" ? board.game_key : null;

  return (
    <View style={{ gap: spacing.lg }} testID="meeting-play">
      {error ? <Body testID="meeting-play-error">{error}</Body> : null}
      {board?.notice ? <Card><Title size={16} style={{ textAlign: "center" }} testID="meeting-play-notice">{board.notice}</Title></Card> : null}

      {isOrganizer ? (
        <View style={{ gap: spacing.md }}>
          <Title size={18} style={{ textAlign: "center" }}>Przełącz zabawę</Title>
          {keys.map((key) => (
            <Button
              key={key}
              testID={`meeting-play-start-${key}`}
              title={LABELS[key] ?? key}
              variant={live === key ? "primary" : "secondary"}
              onPress={() => { if (live !== key) void run(() => eventPlayStart(eventId, key)); }}
              loading={busy}
            />
          ))}
        </View>
      ) : null}

      {live == null && !isOrganizer ? (
        <View style={{ gap: spacing.md }}>
          {labels.map((label) => <Card key={label}><Title size={16} style={{ textAlign: "center" }}>{label}</Title></Card>)}
          <Body muted style={{ textAlign: "center" }}>Czekamy, aż organizator rozpocznie zabawę.</Body>
        </View>
      ) : null}

      {live === "questions" ? (
        <View style={{ gap: spacing.md }} testID="meeting-play-questions">
          <Title size={22} style={{ textAlign: "center" }}>Zabawa w pytania</Title>
          <Body style={{ textAlign: "center" }}>Seria {board?.round_no ?? 1} z {board?.limit ?? 1}. Odpowiadacie po kolei.</Body>
          {board?.my_question ? <Card><Title size={18} style={{ textAlign: "center" }} testID="meeting-play-question">{board.my_question}</Title></Card> : null}
          {board?.your_turn && !board.my_question ? (
            <Button testID="meeting-play-draw" title="Wylosuj pytanie" loading={busy} onPress={() => void run(() => eventPlayDraw(eventId))} />
          ) : null}
          {board?.your_turn && board.my_question && !board.my_answered ? (
            <Button testID="meeting-play-answered" title="Odpowiedziałem/am" loading={busy} onPress={() => void run(() => eventPlayAnswered(eventId))} />
          ) : null}
          {!board?.your_turn ? <Body testID="meeting-play-turn" style={{ textAlign: "center" }}>Teraz kolej: {board?.turn_name ?? "kolejna osoba"}</Body> : null}
          {board?.your_turn && board.my_answered ? <Body style={{ textAlign: "center" }}>Twoja odpowiedź w tej serii jest już zapisana.</Body> : null}
        </View>
      ) : null}

      {live === "two-truths" ? (
        <View style={{ gap: spacing.md }} testID="meeting-play-truths">
          <Title size={22} style={{ textAlign: "center" }}>Dwie prawdy i jedno kłamstwo</Title>
          <Body style={{ textAlign: "center" }}>{SOCIAL_GAMES.find((game) => game.id === "two-truths")?.blurb}</Body>
          <TwoTruthsPlay
            eventId={eventId}
            truths={board?.truths}
            onBoard={(next) => { setBoard(next); setError(null); }}
          />
        </View>
      ) : null}

      {live === "find-someone" ? (
        <View style={{ gap: spacing.md }} testID="meeting-play-find">
          <Title size={22} style={{ textAlign: "center" }}>Znajdź kogoś, kto…</Title>
          {(board?.prompts ?? []).length === 0 ? <Body style={{ textAlign: "center" }}>Organizator nie dodał zdań do tej zabawy.</Body> : (
            <FindRound
              eventId={eventId}
              prompts={board?.prompts ?? []}
              participants={board?.participants ?? []}
              find={board?.find}
              onBoard={(next) => { setBoard(next); setError(null); }}
            />
          )}
        </View>
      ) : null}

      {live === "runaway-story" ? (
        <View style={{ gap: spacing.md }} testID="meeting-play-story">
          <Title size={22} style={{ textAlign: "center" }}>Historia, która wymknęła się spod kontroli</Title>
          <Body style={{ textAlign: "center" }}>Organizator wybiera albo losuje pierwsze zdanie. Potem każdy dopisuje swoje, w swoim kolorze.</Body>
          <StoryTable eventId={eventId} canClose={isOrganizer} />
        </View>
      ) : null}
    </View>
  );
}

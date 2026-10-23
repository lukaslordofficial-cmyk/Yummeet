import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  QUESTION_PLAY_INSTRUCTION, RUNAWAY_STORY_PLAY_GUEST, RUNAWAY_STORY_PLAY_ORGANIZER, STORY_STARTERS,
  plannedGameKeys, splitPlan, storyPickMode, storyStarterLabel, type PlanItem,
} from "@/src/lib/meetingPlan";
import { eventFinishMeeting, eventPlayAnswered, eventPlayBoard, eventPlayDraw, eventPlayNext, eventPlayStart, type PlayBoard } from "@/src/lib/play";
import { spacing } from "@/src/theme";

import { ActivityName } from "./PlanNoteView";
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
  return plannedGameKeys(items);
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
  const [closing, setClosing] = useState(false);
  const advanced = useRef<string | null>(null);
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

  const live = board?.status === "live" ? board.game_key : null;
  useEffect(() => {
    if (!isOrganizer || !board) return;
    const done = (live === "two-truths" && (board.truths?.phase ?? 0) >= 3) || (live === "find-someone" && (board.find?.phase ?? 0) >= 3);
    if (!done) return;
    const stamp = `${live}:${board.round_no}`;
    if (advanced.current === stamp) return;
    const timer = setTimeout(() => {
      advanced.current = stamp;
      void run(() => eventPlayNext(eventId));
    }, 10000);
    return () => clearTimeout(timer);
  }, [board, isOrganizer, live, eventId]);

  if (!isOrganizer && !scanned) {
    return (
      <View style={{ gap: spacing.xl }} testID="meeting-play-locked">
        <Title size={18} style={{ textAlign: "center" }}>Wybrane zabawy</Title>
        {labels.length ? labels.map((label) => (
          <Card key={label}><Title size={16} style={{ textAlign: "center" }}>{label}</Title></Card>
        )) : <Body muted style={{ textAlign: "center" }}>Organizator nie wybrał jeszcze zabaw.</Body>}
        <Body muted style={{ textAlign: "center" }}>Zeskanuj kod QR albo wpisz go w skanerze, żeby wejść do zabawy.</Body>
      </View>
    );
  }

  if (!board && !error) {
    return (
      <View style={{ gap: spacing.xl }} testID="meeting-play-joining">
        <Title size={18} style={{ textAlign: "center" }}>Dołączanie do panelu spotkania, proszę czekać...</Title>
      </View>
    );
  }

  const storyPlan = splitPlan(items);
  const plannedStarters = storyPlan.starters.map((row) => {
    const title = storyStarterLabel(row.title);
    const known = STORY_STARTERS.find((starter) => starter.title === title);
    const text = (row.body || known?.text || "").trim();
    return { title, text };
  }).filter((starter) => starter.text.length > 0);

  return (
    <View style={{ gap: spacing.xxl }} testID="meeting-play">
      {error ? <Body testID="meeting-play-error">{error}</Body> : null}
      {board?.notice ? <Card><Title size={16} style={{ textAlign: "center" }} testID="meeting-play-notice">{board.notice}</Title></Card> : null}

      {isOrganizer ? (
        <View style={{ gap: spacing.xl }}>
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
          <Button
            testID="meeting-play-finish"
            title="Zakończ spotkanie"
            variant="ghost"
            loading={closing}
            onPress={() => {
              setClosing(true);
              void eventFinishMeeting(eventId).then(() => load()).catch((e) => setError(errorMessage(e))).finally(() => setClosing(false));
            }}
          />
        </View>
      ) : null}

      {live == null && !isOrganizer ? (
        <View style={{ gap: spacing.xl }}>
          {labels.map((label) => <Card key={label}><Title size={16} style={{ textAlign: "center" }}>{label}</Title></Card>)}
          <Body muted style={{ textAlign: "center" }}>Czekamy, aż organizator rozpocznie zabawę.</Body>
        </View>
      ) : null}

      {live === "questions" ? (
        <View style={{ gap: spacing.xl }} testID="meeting-play-questions">
          <Title size={22} style={{ textAlign: "center" }}>Zabawa w pytania</Title>
          <Body style={{ textAlign: "center" }}>Seria {board?.round_no ?? 1} z {board?.limit ?? 1}. Odpowiadacie po kolei.</Body>
          {board?.my_question ? (
            <View style={{ gap: spacing.md }}>
              <Body style={{ textAlign: "center" }}>{QUESTION_PLAY_INSTRUCTION}</Body>
              <Card><Title size={18} style={{ textAlign: "center" }} testID="meeting-play-question">{board.my_question}</Title></Card>
            </View>
          ) : null}
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
        <View style={{ gap: spacing.xl }} testID="meeting-play-truths">
          <ActivityName>Dwie prawdy i jedno kłamstwo</ActivityName>
          <TwoTruthsPlay
            eventId={eventId}
            truths={board?.truths}
            onBoard={(next) => { setBoard(next); setError(null); }}
          />
        </View>
      ) : null}

      {live === "find-someone" ? (
        <View style={{ gap: spacing.xl }} testID="meeting-play-find">
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
        <View style={{ gap: spacing.xl }} testID="meeting-play-story">
          <Title size={22} style={{ textAlign: "center" }}>Historia, która wymknęła się spod kontroli</Title>
          <Body style={{ textAlign: "center" }}>{isOrganizer ? RUNAWAY_STORY_PLAY_ORGANIZER : RUNAWAY_STORY_PLAY_GUEST}</Body>
          <StoryTable eventId={eventId} canClose={isOrganizer} planned={plannedStarters} mode={storyPickMode(items)} />
        </View>
      ) : null}
    </View>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Body, Button, Card, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { SOCIAL_GAMES, type PlanItem } from "@/src/lib/meetingPlan";
import { eventFindSave, eventPlayAnswered, eventPlayBoard, eventPlayDraw, eventPlayStart, type PlayBoard } from "@/src/lib/play";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { StoryTable } from "./StoryTable";
import { TableRounds } from "./TableRounds";

const LABELS: Record<string, string> = {
  questions: "Zabawa w pytania",
  "two-truths": "Dwie prawdy i jedno kłamstwo",
  "find-someone": "Znajdź kogoś, kto…",
  "runaway-story": "Historia, która wymknęła się spod kontroli",
};

function selectedKeys(items: PlanItem[]) {
  const keys: string[] = [];
  if (items.some((item) => item.category === "questions" && item.title !== "Notatka organizatora" && item.title !== "Pytania na osobę")) keys.push("questions");
  for (const game of SOCIAL_GAMES) {
    if (items.some((item) => item.title === game.title)) keys.push(game.id);
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
  const { colors } = useTheme();
  const [board, setBoard] = useState<PlayBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
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
        <Body muted style={{ textAlign: "center" }}>Zeskanuj kod QR wydarzenia, żeby wejść do zabawy.</Body>
      </View>
    );
  }

  const live = board?.status === "live" ? board.game_key : null;
  const namesFor = (prompt: string) => board?.my_picks.find((pick) => pick.prompt === prompt)?.names ?? [];

  return (
    <View style={{ gap: spacing.lg }} testID="meeting-play">
      {error ? <Body testID="meeting-play-error">{error}</Body> : null}
      {board?.notice ? <Card><Title size={16} style={{ textAlign: "center" }} testID="meeting-play-notice">{board.notice}</Title></Card> : null}

      {isOrganizer && live == null ? (
        <View style={{ gap: spacing.md }}>
          <Title size={18} style={{ textAlign: "center" }}>Wystartuj zabawę</Title>
          {keys.map((key) => (
            <Button key={key} testID={`meeting-play-start-${key}`} title={LABELS[key] ?? key} onPress={() => void run(() => eventPlayStart(eventId, key))} loading={busy} />
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
            <Button testID="meeting-play-answered" title="Odpowiedziałem" loading={busy} onPress={() => void run(() => eventPlayAnswered(eventId))} />
          ) : null}
          {!board?.your_turn ? <Body testID="meeting-play-turn" style={{ textAlign: "center" }}>Teraz kolej: {board?.turn_name ?? "kolejna osoba"}</Body> : null}
          {board?.your_turn && board.my_answered ? <Body style={{ textAlign: "center" }}>Twoja odpowiedź w tej serii jest już zapisana.</Body> : null}
        </View>
      ) : null}

      {live === "two-truths" ? (
        <View style={{ gap: spacing.md }}>
          <Title size={22} style={{ textAlign: "center" }}>Dwie prawdy i jedno kłamstwo</Title>
          <TableRounds gameId="two-truths" prompts={[]} />
        </View>
      ) : null}

      {live === "find-someone" ? (
        <View style={{ gap: spacing.md }} testID="meeting-play-find">
          <Title size={22} style={{ textAlign: "center" }}>Znajdź kogoś, kto…</Title>
          <Body style={{ textAlign: "center" }}>Do każdego zdania dodaj imię innego Yummitera. Przy jednym zdaniu możesz dopisać kilka osób.</Body>
          {(board?.prompts ?? []).map((prompt) => {
            const names = namesFor(prompt);
            const open = openPrompt === prompt;
            return (
              <Card key={prompt}>
                <Title size={16}>{prompt}</Title>
                {names.map((name) => (
                  <View key={name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                    <Body>{name}</Body>
                    <Button
                      testID={`find-remove-${name}`}
                      title="−"
                      variant="ghost"
                      style={{ minWidth: 48, paddingHorizontal: spacing.md }}
                      onPress={() => void run(() => eventFindSave(eventId, prompt, names.filter((item) => item !== name)))}
                    />
                  </View>
                ))}
                <Button testID={`find-add-${prompt.slice(0, 16)}`} title="+" onPress={() => setOpenPrompt(open ? null : prompt)} />
                {open ? (board?.participants ?? []).filter((person) => !names.includes(person.name)).map((person) => (
                  <Pressable
                    key={person.id}
                    testID={`find-person-${person.id}`}
                    onPress={() => void run(() => eventFindSave(eventId, prompt, [...names, person.name]))}
                    style={{ backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md }}
                  >
                    <Title size={16} style={{ color: colors.onBrandPrimary, textAlign: "center", fontFamily: fonts.display }}>{person.name}</Title>
                  </Pressable>
                )) : null}
              </Card>
            );
          })}
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

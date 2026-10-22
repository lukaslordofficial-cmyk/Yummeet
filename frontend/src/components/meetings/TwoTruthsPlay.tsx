import { useEffect, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Field, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { TWO_TRUTHS_INSTRUCTION } from "@/src/lib/meetingPlan";
import { eventTruthGuess, eventTruthStake, eventTruthSubmit, type PlayBoard, type TruthState } from "@/src/lib/play";
import { spacing } from "@/src/theme";

const STAKE = "Czy chcesz aby zwycięzca wygrał napój/drinka/przekąskę do 20 zł, ufundowaną przez pozostałych uczestników? Stanie się tak, jeśli wszyscy uczestnicy odpowiedzą Tak.";
const PRIZE = "Wszyscy uczestnicy zgodzili się na ufundowanie nagrody dla zwycięzcy.";
const SAVED = "Zapisano odpowiedzi";
const WAIT = "Czekaj na pozostałych";

export function TwoTruthsPlay({
  eventId,
  truths,
  onBoard,
}: {
  eventId: string;
  truths: TruthState | null | undefined;
  onBoard: (next: PlayBoard) => void;
}) {
  const toast = useToast();
  const [lines, setLines] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<Record<string, Array<boolean | null>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const phase = truths?.phase ?? 1;

  useEffect(() => {
    if (truths?.mine?.lines?.length === 3) {
      setLines(truths.mine.lines);
      setLie(truths.mine.lie ?? 0);
    }
  }, [truths?.lines_saved, truths?.mine?.lie]);

  useEffect(() => {
    if (phase < 2) return;
    setBanner((cur) => (cur && cur.includes(WAIT) ? SAVED : cur));
  }, [phase]);

  useEffect(() => {
    const next: Record<string, Array<boolean | null>> = {};
    for (const person of truths?.others ?? []) {
      next[person.id] = [0, 1, 2].map((index) => person.guesses?.[index] ?? null);
    }
    setGuesses(next);
  }, [truths?.phase, truths?.guesses_saved, (truths?.others ?? []).map((person) => person.id).join("|")]);

  if (!truths) {
    return <Body style={{ textAlign: "center" }}>Dwie prawdy na kilku telefonach wymagają migracji 048 w Supabase.</Body>;
  }

  const run = async (action: () => Promise<PlayBoard>, message: (board: PlayBoard) => string) => {
    setBusy(true);
    try {
      const next = await action();
      onBoard(next);
      const text = message(next);
      setError(null);
      setBanner(text);
      toast(text, "success");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveLines = () => {
    if (lie == null) {
      setError("Oznacz, które zdanie jest kłamstwem.");
      return;
    }
    if (lines.some((line) => line.trim().length < 2)) {
      setError("Wpisz trzy zdania.");
      return;
    }
    void run(
      () => eventTruthSubmit(eventId, lines.map((line) => line.trim()), lie),
      (board) => (board.truths?.phase ?? 1) <= 1 ? `${SAVED}. ${WAIT}` : SAVED,
    );
  };

  const saveGuesses = () => {
    const rows = (truths.others ?? []).map((person) => ({
      target: person.id,
      marks: (guesses[person.id] ?? []).map((mark) => mark === true),
    }));
    if ((truths.others ?? []).some((person) => (guesses[person.id] ?? []).length < 3 || (guesses[person.id] ?? []).some((mark) => mark == null))) {
      setError("Przy każdym zdaniu zaznacz prawdę albo fałsz.");
      return;
    }
    void run(
      () => eventTruthGuess(eventId, rows),
      (board) => (board.truths?.phase ?? 2) >= 3 ? SAVED : `${SAVED}. ${WAIT}`,
    );
  };

  const lockedLines = truths.lines_saved && phase === 1;
  const showGuesses = phase >= 2 && (truths.others ?? []).length > 0;
  const reveal = phase >= 3;

  return (
    <View style={{ gap: spacing.md }} testID="two-truths-play">
      <Body style={{ textAlign: "center" }}>{STAKE}</Body>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button testID="truth-stake-yes" title="Tak" style={{ flex: 1 }} variant={truths.stake.mine === true ? "primary" : "secondary"} loading={busy} onPress={() => void run(() => eventTruthStake(eventId, true), () => "Zapisano zgodę")} />
        <Button testID="truth-stake-no" title="Nie" style={{ flex: 1 }} variant={truths.stake.mine === false ? "primary" : "secondary"} loading={busy} onPress={() => void run(() => eventTruthStake(eventId, false), () => "Zapisano odpowiedź")} />
      </View>
      <Body testID="truth-stake-count" style={{ textAlign: "center" }}>Zgodziło się {truths.stake.yes} z {truths.stake.total}.</Body>
      {truths.stake.unanimous ? <Title size={16} style={{ textAlign: "center" }} testID="truth-stake-unanimous">{PRIZE}</Title> : null}
      {banner ? <Title size={16} style={{ textAlign: "center" }} testID="truth-banner">{banner}</Title> : null}
      {error ? <Body testID="truth-error">{error}</Body> : null}

      {!showGuesses ? (
        <View style={{ gap: spacing.md }}>
          <Body style={{ textAlign: "center" }}>{TWO_TRUTHS_INSTRUCTION}</Body>
          {lines.map((line, index) => (
            <View key={index} style={{ gap: spacing.sm }}>
              <Field testID={`truth-line-${index}`} label={`Zdanie ${index + 1}`} value={line} onChangeText={(text) => setLines(lines.map((item, n) => n === index ? text : item))} editable={!lockedLines} />
              <Button
                testID={`truth-lie-${index}`}
                title={lie == null ? "Oznacz jako kłamstwo" : lie === index ? "To jest kłamstwo" : "To jest prawda"}
                variant={lie === index ? "primary" : "secondary"}
                disabled={lockedLines}
                onPress={() => setLie(index)}
              />
            </View>
          ))}
          {lockedLines ? <Body style={{ textAlign: "center" }}>{WAIT}</Body> : null}
          <Button testID="truth-save-lines" title="Zapisz odpowiedzi" style={{ marginTop: spacing.xxl }} disabled={lockedLines} loading={busy} onPress={saveLines} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {(truths.others ?? []).map((person) => (
            <Card key={person.id} testID={`truth-person-${person.id}`}>
              <Title size={18} style={{ textAlign: "center" }}>{person.name}</Title>
              {person.lines.map((line, index) => (
                <View key={`${person.id}-${index}`} style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  <Body>{line}</Body>
                  {reveal ? (
                    <Body testID={`truth-reveal-${person.id}-${index}`}>
                      {person.truth?.[index] ? "Prawda" : "Fałsz"} · {(person.line_points?.[index] ?? 0) > 0 ? `+${person.line_points?.[index]}` : person.line_points?.[index]} pkt
                    </Body>
                  ) : (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Button
                        testID={`truth-guess-true-${person.id}-${index}`}
                        title="Prawda"
                        style={{ flex: 1 }}
                        variant={guesses[person.id]?.[index] === true ? "primary" : "secondary"}
                        disabled={truths.guesses_saved}
                        onPress={() => setGuesses((cur) => ({ ...cur, [person.id]: [0, 1, 2].map((n) => n === index ? true : (cur[person.id]?.[n] ?? null)) }))}
                      />
                      <Button
                        testID={`truth-guess-false-${person.id}-${index}`}
                        title="Fałsz"
                        style={{ flex: 1 }}
                        variant={guesses[person.id]?.[index] === false ? "primary" : "secondary"}
                        disabled={truths.guesses_saved}
                        onPress={() => setGuesses((cur) => ({ ...cur, [person.id]: [0, 1, 2].map((n) => n === index ? false : (cur[person.id]?.[n] ?? null)) }))}
                      />
                    </View>
                  )}
                </View>
              ))}
              {reveal ? <Body>Punkty przy tej osobie: {person.points ?? 0}</Body> : null}
            </Card>
          ))}
          {reveal ? <Title size={22} style={{ textAlign: "center" }} testID="truth-score">Wynik: {truths.score ?? 0} pkt</Title> : null}
          {!reveal && truths.guesses_saved ? <Body style={{ textAlign: "center" }}>{WAIT}</Body> : null}
          {!reveal ? (
            <Button testID="truth-save-guesses" title="Zapisz odpowiedzi" style={{ marginTop: spacing.lg }} disabled={truths.guesses_saved} loading={busy} onPress={saveGuesses} />
          ) : null}
        </View>
      )}
    </View>
  );
}

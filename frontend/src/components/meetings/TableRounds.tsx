import { useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Field, Title } from "@/src/components/ui";
import { FIND_PACKS, GUESS_PROMPTS, TRUTH_HINTS, drawIndex } from "@/src/lib/meetingPlan";
import { spacing } from "@/src/theme";

/** Runda na jednym telefonie: prowadzący podaje aparat dalej. Tajne głosy z wielu aparatów to kolejny etap. */
export function TableRounds({ gameId, prompts }: { gameId: string; prompts: string[] }) {
  if (gameId === "two-truths") return <TwoTruths />;
  if (gameId === "find-someone") return <FindSomeone extra={prompts} />;
  if (gameId === "guess") return <GuessRound />;
  return null;
}

function TwoTruths() {
  const [lines, setLines] = useState(["", "", ""]);
  const [lie, setLie] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [votes, setVotes] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [points, setPoints] = useState(false);
  const [score, setScore] = useState(0);
  const [hint, setHint] = useState("");
  const ready = lines.every((l) => l.trim().length > 1);

  const reveal = () => {
    if (!revealed && points) setScore((s) => s + votes.filter((v) => v === lie).length);
    setRevealed(true);
    setHidden(false);
  };

  return (
    <View style={{ gap: spacing.sm }} testID="round-two-truths">
      <Title size={16}>Runda na tym telefonie</Title>
      <Button testID="round-points" title={points ? "Gracie na punkty" : "Bez punktów"} variant="ghost" onPress={() => setPoints((v) => !v)} />
      <Button testID="round-hint" title="Losuj inspirację" variant="ghost" onPress={() => setHint(TRUTH_HINTS[drawIndex(TRUTH_HINTS.length)] ?? "")} />
      {hint ? <Body muted>Inspiracja, nie gotowa odpowiedź: {hint}</Body> : null}
      {lines.map((line, i) => (
        <View key={i} style={{ gap: spacing.xs }}>
          <Field testID={`round-line-${i}`} label={`Zdanie ${i + 1}`} value={hidden ? line : line} onChangeText={(t) => setLines(lines.map((x, n) => n === i ? t : x))} editable={!hidden} />
          {!hidden ? <Button testID={`round-lie-${i}`} title={lie === i ? "To jest kłamstwo" : "Oznacz jako kłamstwo"} variant={lie === i ? "primary" : "ghost"} onPress={() => setLie(i)} /> : null}
        </View>
      ))}
      {!hidden ? <Button testID="round-hide" title="Ukryj kłamstwo i pokaż grupie" disabled={!ready} onPress={() => { setVotes([]); setHidden(true); }} /> : (
        <View style={{ gap: spacing.sm }}>
          <Body>Które zdanie jest kłamstwem?</Body>
          {[0, 1, 2].map((i) => (
            <Button key={i} testID={`round-vote-${i}`} title={`Typ: zdanie ${i + 1}`} variant="secondary" onPress={() => setVotes([...votes, i])} />
          ))}
          <Body muted>Typów: {votes.length}</Body>
          <Button testID="round-reveal" title="Ujawnij" onPress={reveal} />
        </View>
      )}
      {!hidden && votes.length ? <Body testID="round-reveal-text">Kłamstwem było zdanie {lie + 1}. Trafień: {votes.filter((v) => v === lie).length}.{points ? ` Punkty autora typów w tej sesji telefonu: ${score}.` : ""}</Body> : null}
      <Button testID="round-next" title="Następna osoba" variant="ghost" onPress={() => { setLines(["", "", ""]); setLie(0); setHidden(false); setVotes([]); setRevealed(false); }} />
    </View>
  );
}

function FindSomeone({ extra }: { extra: string[] }) {
  const bank = [...FIND_PACKS.flatMap((p) => p.prompts), ...extra.filter(Boolean)];
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [score, setScore] = useState(0);
  const prompt = bank[index] ?? "";

  const answer = (delta: number) => {
    setScore((s) => s + delta);
    setName("");
    setIndex((i) => (bank.length ? (i + 1) % bank.length : 0));
  };

  return (
    <View style={{ gap: spacing.sm }} testID="round-find-someone">
      <Title size={16}>Prowadzący trzyma telefon</Title>
      <Card><Title size={16}>Znajdź kogoś, kto {prompt.replace(/^…\s*/, "")}</Title></Card>
      <Field testID="round-pick-name" label="Kogo typujesz?" value={name} onChangeText={setName} />
      <Button testID="round-true" title="To prawda (+1)" onPress={() => answer(1)} />
      <Button testID="round-false" title="To nieprawda (−1)" variant="secondary" onPress={() => answer(-1)} />
      <Button testID="round-pass" title="Pasuję (0)" variant="ghost" onPress={() => answer(0)} />
      <Body testID="round-find-score">Wynik na tym telefonie: {score}</Body>
    </View>
  );
}

function GuessRound() {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: spacing.sm }} testID="round-guess">
      <Title size={16}>{GUESS_PROMPTS[index]}</Title>
      <Field testID="round-guess-input" label="Zgadywana odpowiedź" value={guess} onChangeText={setGuess} editable={!shown} />
      {shown ? <Field testID="round-answer-input" label="Prawdziwa odpowiedź i krótkie dlaczego" value={answer} onChangeText={setAnswer} multiline style={{ minHeight: 70 }} /> : (
        <Button testID="round-guess-lock" title="Najpierw zgadywanie, potem prawda" disabled={guess.trim().length < 1} onPress={() => setShown(true)} />
      )}
      <Button testID="round-guess-next" title="Następne pytanie" variant="ghost" onPress={() => { setIndex((i) => (i + 1) % GUESS_PROMPTS.length); setGuess(""); setAnswer(""); setShown(false); }} />
    </View>
  );
}

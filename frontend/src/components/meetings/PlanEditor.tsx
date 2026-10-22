import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Field, Title } from "@/src/components/ui";
import {
  BUILTIN_QUESTIONS, FIND_PACKS, QUESTION_RULES, SOCIAL_GAMES,
  addCustomPrompt, addCustomQuestion, catalogGame, setPlanLimit, setPlanNote, splitPlan, toggleGame, toggleQuestion,
  type PlanItem,
} from "@/src/lib/meetingPlan";
import { spacing } from "@/src/theme";

import { TableRounds } from "./TableRounds";

export function PlanEditor({
  items,
  onChange,
  canEdit,
  play,
  browse = false,
  testID = "plan-editor",
  noteCommit = "instant",
}: {
  items: PlanItem[];
  onChange?: (next: PlanItem[]) => void;
  canEdit: boolean;
  play: boolean;
  browse?: boolean;
  testID?: string;
  noteCommit?: "instant" | "button";
}) {
  const plan = splitPlan(items);
  const [note, setNote] = useState(plan.note?.body ?? "");
  const noteDirty = useRef(false);
  const [customQ, setCustomQ] = useState("");
  const [customP, setCustomP] = useState("");
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [openPacks, setOpenPacks] = useState(false);

  useEffect(() => {
    if (noteDirty.current) return;
    setNote(plan.note?.body ?? "");
  }, [plan.note?.body]);

  const commit = (next: PlanItem[]) => onChange?.(next);
  const selectedGame = (title: string) => plan.games.some((g) => g.title === title);
  const showCatalog = canEdit || browse;
  const questionList = showCatalog ? BUILTIN_QUESTIONS : BUILTIN_QUESTIONS.filter((q) => plan.questions.some((row) => row.title === q));
  const gameList = showCatalog ? SOCIAL_GAMES : SOCIAL_GAMES.filter((g) => selectedGame(g.title));

  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <Title size={18}>Plan spotkania</Title>
      {browse ? null : (
        <Field
          testID={`${testID}-note`}
          label="Notatka do planu"
          value={note}
          onChangeText={(text) => {
            noteDirty.current = noteCommit === "button";
            setNote(text);
            if (noteCommit === "instant" && canEdit) commit(setPlanNote(items, text));
          }}
          placeholder="Co warto wiedzieć, zanim usiądziecie do stołu"
          multiline
          style={{ minHeight: 80 }}
          editable={canEdit}
        />
      )}
      {canEdit && noteCommit === "button" ? (
        <Button testID={`${testID}-note-save`} title="Zapisz notatkę" variant="secondary" onPress={() => { noteDirty.current = false; commit(setPlanNote(items, note)); }} />
      ) : null}

      <Title size={18}>Pytania</Title>
      <Body muted testID={`${testID}-question-rules`}>{QUESTION_RULES}</Body>
      {browse ? <Body muted>Przy konkretnym spotkaniu organizator ustala, ile pytań losuje każda osoba.</Body> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Body>Pytań na osobę: {plan.limit}</Body>
          {canEdit ? (
            <>
              <Button testID={`${testID}-limit-minus`} title="−" variant="ghost" onPress={() => commit(setPlanLimit(items, plan.limit - 1))} />
              <Button testID={`${testID}-limit-plus`} title="+" variant="ghost" onPress={() => commit(setPlanLimit(items, plan.limit + 1))} />
            </>
          ) : null}
        </View>
      )}
      {canEdit ? (
        <>
          <Field testID={`${testID}-custom-question`} label="Własne pytanie" value={customQ} onChangeText={setCustomQ} placeholder="Wpisz pytanie ponad propozycjami" />
          <Button testID={`${testID}-custom-question-add`} title="Dodaj własne pytanie" variant="ghost" onPress={() => { commit(addCustomQuestion(items, customQ)); setCustomQ(""); }} />
        </>
      ) : null}
      {questionList.map((q) => {
        const on = plan.questions.some((row) => row.title === q);
        return (
          <Card key={q} testID={`${testID}-q-${BUILTIN_QUESTIONS.indexOf(q)}`} onPress={canEdit ? () => commit(toggleQuestion(items, q)) : undefined}>
            <Title size={16}>{on ? "✓ " : ""}{q}</Title>
          </Card>
        );
      })}
      {plan.questions.filter((q) => !BUILTIN_QUESTIONS.some((builtin) => builtin === q.title)).map((q) => (
        <Card key={q.key} testID={`${testID}-own-${q.key}`} onPress={canEdit ? () => commit(toggleQuestion(items, q.title)) : undefined}>
          <Title size={16}>{canEdit ? "✓ " : ""}{q.title}</Title>
          <Body muted>Własne pytanie</Body>
        </Card>
      ))}

      <Title size={18}>Gry i zabawy towarzyskie</Title>
      <Body muted>Gry towarzyskie, które można rozegrać podczas speed friendingu.</Body>
      {gameList.map((g) => {
        const on = selectedGame(g.title);
        const open = openGame === g.id;
        return (
          <View key={g.id} style={{ gap: spacing.sm }}>
            <Card testID={`${testID}-game-${g.id}`} onPress={() => setOpenGame(open ? null : g.id)}>
              <Title size={16}>{on ? "✓ " : ""}{g.title}</Title>
              <Body muted>{g.blurb}</Body>
            </Card>
            {open ? (
              <View style={{ gap: spacing.sm, paddingHorizontal: spacing.sm }}>
                <Body>{g.rules}</Body>
                {canEdit ? (
                  <Button testID={`${testID}-game-toggle-${g.id}`} title={on ? "Usuń z planu" : "Dodaj do planu"} variant="secondary" onPress={() => commit(toggleGame(items, g))} />
                ) : null}
                {g.id === "find-someone" ? (
                  <>
                    <Button testID={`${testID}-packs`} title={openPacks ? "Ukryj zestawy" : "Pokaż zestawy zdań"} variant="ghost" onPress={() => setOpenPacks((v) => !v)} />
                    {openPacks ? FIND_PACKS.map((pack) => (
                      <View key={pack.id} style={{ gap: 4 }}>
                        <Title size={16}>{pack.title}</Title>
                        {pack.prompts.map((p) => <Body key={p}>Znajdź kogoś, kto {p.replace(/^…\s*/, "")}</Body>)}
                      </View>
                    )) : null}
                    <Body muted>Osoba wskazana może odpowiedzieć „to prawda”, „to nieprawda” albo „pasuję”. Nie musi ujawniać sekretu.</Body>
                    {canEdit ? (
                      <>
                        <Field testID={`${testID}-custom-prompt`} label="Własne zdanie do tej gry" value={customP} onChangeText={setCustomP} placeholder="…najprędzej zamówi deser przed daniem" />
                        <Button testID={`${testID}-custom-prompt-add`} title="Dodaj własne zdanie" variant="ghost" onPress={() => { commit(addCustomPrompt(items, customP)); setCustomP(""); }} />
                      </>
                    ) : null}
                    {plan.prompts.map((p) => <Body key={p.key}>• {p.body || p.title}</Body>)}
                  </>
                ) : null}
                {play && on ? <TableRounds gameId={g.id} prompts={plan.prompts.map((p) => p.body || p.title.replace(/^Znajdź kogoś: /, ""))} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {plan.legacy.length ? (
        <Body muted>Starsze wyzwania zostają w zapisie tego spotkania, ale nie dodajemy już nowych.</Body>
      ) : null}
      {plan.games.some((g) => catalogGame(g.title)?.id === "runaway-story") ? (
        <Body muted>Wspólna historia jest pod tym planem. Zdania zapisują się kolorem autora i trafiają do dziennika.</Body>
      ) : null}
    </View>
  );
}

import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Body, Button, Card, Field, Title } from "@/src/components/ui";
import {
  BUILTIN_QUESTIONS, FIND_PACKS, QUESTION_RULES, SOCIAL_GAMES,
  addCustomPrompt, addCustomQuestion, catalogGame, setPlanLimit, setPlanNote, splitPlan, syncPlanNote, toggleGame, togglePrompt, toggleQuestion,
  type PlanItem,
} from "@/src/lib/meetingPlan";
import { loadOwnQuestions, rememberOwnQuestion } from "@/src/lib/ownQuestions";
import { spacing, useTheme } from "@/src/theme";

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
  const { colors } = useTheme();
  const plan = splitPlan(items);
  const [note, setNote] = useState(plan.note?.body ?? "");
  const noteDirty = useRef(false);
  const [customQ, setCustomQ] = useState("");
  const [customP, setCustomP] = useState("");
  const [ownQuestions, setOwnQuestions] = useState<string[]>([]);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [openGame, setOpenGame] = useState<string | null>(null);
  const center = { textAlign: "center" as const };
  const picked = (on: boolean) => (on ? colors.brandPrimary : undefined);

  useEffect(() => { void loadOwnQuestions().then(setOwnQuestions); }, []);

  useEffect(() => {
    if (noteDirty.current) return;
    setNote(plan.note?.body ?? "");
  }, [plan.note?.body]);

  const commit = (next: PlanItem[]) => onChange?.(next);
  const applySelection = (next: PlanItem[]) => {
    const synced = syncPlanNote(setPlanNote(next, note));
    const body = splitPlan(synced).note?.body ?? "";
    noteDirty.current = false;
    setNote(body);
    commit(synced);
  };
  const selectedGame = (title: string) => plan.games.some((g) => g.title === title);
  const showCatalog = canEdit || browse;
  const questionList = showCatalog ? BUILTIN_QUESTIONS : BUILTIN_QUESTIONS.filter((q) => plan.questions.some((row) => row.title === q));
  const gameList = showCatalog ? SOCIAL_GAMES : SOCIAL_GAMES.filter((g) => selectedGame(g.title));

  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <Title size={18} style={center}>Plan spotkania</Title>
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
        <Button testID={`${testID}-note-save`} title="Zapisz notatkę" onPress={() => { noteDirty.current = false; commit(setPlanNote(items, note)); }} />
      ) : null}

      <Title size={18} style={center}>Proponowane aktywności</Title>
      <Card
        testID={`${testID}-questions-toggle`}
        onPress={() => setQuestionsOpen((open) => !open)}
        style={{ marginTop: spacing.xl }}
      >
        <Title size={18} style={center}>Zabawa w pytania</Title>
      </Card>
      {questionsOpen ? (
        <View style={{ gap: spacing.sm }}>
          <Body muted testID={`${testID}-question-rules`}>{QUESTION_RULES}</Body>
          {browse ? <Body muted>Przy konkretnym spotkaniu organizator ustala, ile pytań losuje każda osoba.</Body> : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Body>Pytań na osobę: {plan.limit}</Body>
              {canEdit ? (
                <>
                  <Button testID={`${testID}-limit-minus`} title="−" onPress={() => applySelection(setPlanLimit(items, plan.limit - 1))} />
                  <Button testID={`${testID}-limit-plus`} title="+" onPress={() => applySelection(setPlanLimit(items, plan.limit + 1))} />
                </>
              ) : null}
            </View>
          )}
          {canEdit ? (
            <>
              <Field testID={`${testID}-custom-question`} label="Własne pytanie" value={customQ} onChangeText={setCustomQ} placeholder="Wpisz swoje pytanie" />
              <Button testID={`${testID}-custom-question-add`} title="Dodaj własne pytanie" onPress={() => {
                void rememberOwnQuestion(customQ).then(setOwnQuestions);
                applySelection(addCustomQuestion(items, customQ));
                setCustomQ("");
              }} />
            </>
          ) : null}
          {questionList.map((q) => {
            const on = plan.questions.some((row) => row.title === q);
            return (
              <Card key={q} testID={`${testID}-q-${BUILTIN_QUESTIONS.indexOf(q)}`} accent={picked(on)} onPress={canEdit ? () => applySelection(toggleQuestion(items, q)) : undefined}>
                <Title size={16} style={center}>{q}</Title>
              </Card>
            );
          })}
          {ownQuestions.filter((q) => !BUILTIN_QUESTIONS.some((builtin) => builtin === q)).map((q) => {
            const on = plan.questions.some((row) => row.title === q);
            return (
              <Card key={`local-${q}`} testID={`${testID}-local-${q}`} accent={picked(on)} onPress={canEdit ? () => applySelection(on ? toggleQuestion(items, q) : addCustomQuestion(items, q)) : undefined}>
                <Title size={16} style={center}>{q}</Title>
                <Body muted style={center}>Twoje pytanie, tylko na tym telefonie</Body>
              </Card>
            );
          })}
          {plan.questions.filter((q) => !BUILTIN_QUESTIONS.some((builtin) => builtin === q.title) && !ownQuestions.includes(q.title)).map((q) => (
            <Card key={q.key} testID={`${testID}-own-${q.key}`} accent={picked(plan.questions.some((row) => row.title === q.title))} onPress={canEdit ? () => applySelection(toggleQuestion(items, q.title)) : undefined}>
              <Title size={16} style={center}>{q.title}</Title>
              <Body muted style={center}>Własne pytanie tego spotkania</Body>
            </Card>
          ))}
        </View>
      ) : null}

      <Card testID={`${testID}-games-toggle`} onPress={() => setGamesOpen((open) => !open)}>
        <Title size={18} style={center}>Gry i zabawy towarzyskie</Title>
      </Card>
      {gamesOpen ? <Body muted style={center}>Gry towarzyskie, które można rozegrać podczas speed friendingu.</Body> : null}
      {gamesOpen ? gameList.map((g) => {
        const on = selectedGame(g.title);
        const open = openGame === g.id;
        return (
          <View key={g.id} style={{ gap: spacing.sm }}>
            <Card testID={`${testID}-game-${g.id}`} accent={picked(on)} onPress={() => setOpenGame(open ? null : g.id)}>
              <Title size={16} style={center}>{g.title}</Title>
              <Body muted style={center}>{g.blurb}</Body>
            </Card>
            {open ? (
              <View style={{ gap: spacing.sm, paddingHorizontal: spacing.sm }}>
                <Body>{g.rules}</Body>
                {canEdit ? (
                  <Button testID={`${testID}-game-toggle-${g.id}`} title={on ? "Usuń z planu" : "Dodaj do planu"} onPress={() => applySelection(toggleGame(items, g))} />
                ) : null}
                {g.id === "find-someone" ? (
                  <>
                    <Body muted style={center}>Osoba wskazana może odpowiedzieć „to prawda”, „to nieprawda” albo „pasuję”. Nie musi ujawniać sekretu.</Body>
                    {FIND_PACKS.flatMap((pack) => pack.prompts).map((prompt) => {
                      const chosen = plan.prompts.some((row) => row.body === prompt);
                      return (
                        <Card key={prompt} testID={`${testID}-prompt-${prompt.slice(0, 24)}`} accent={picked(chosen)} onPress={canEdit ? () => applySelection(togglePrompt(items, prompt)) : undefined}>
                          <Title size={16} style={center}>{prompt}</Title>
                        </Card>
                      );
                    })}
                    {canEdit ? (
                      <>
                        <Field testID={`${testID}-custom-prompt`} label="Własne zdanie do tej gry" value={customP} onChangeText={setCustomP} placeholder="…najprędzej zamówi deser przed daniem" />
                        <Button testID={`${testID}-custom-prompt-add`} title="Dodaj własne zdanie" onPress={() => { applySelection(addCustomPrompt(items, customP)); setCustomP(""); }} />
                      </>
                    ) : null}
                    {plan.prompts.filter((row) => !FIND_PACKS.some((pack) => pack.prompts.some((prompt) => prompt === row.body))).map((row) => (
                      <Card key={row.key} accent={colors.brandPrimary} onPress={canEdit ? () => applySelection(togglePrompt(items, row.body || row.title)) : undefined}>
                        <Title size={16} style={center}>{row.body || row.title}</Title>
                      </Card>
                    ))}
                  </>
                ) : null}
                {play && on ? <TableRounds gameId={g.id} prompts={plan.prompts.map((p) => p.body || p.title.replace(/^Znajdź kogoś: /, ""))} /> : null}
              </View>
            ) : null}
          </View>
        );
      }) : null}
      {plan.legacy.length ? (
        <Body muted>Starsze wyzwania zostają w zapisie tego spotkania, ale nie dodajemy już nowych.</Body>
      ) : null}
      {plan.games.some((g) => catalogGame(g.title)?.id === "runaway-story") ? (
        <Body muted>Wspólna historia jest pod tym planem. Zdania zapisują się kolorem autora i trafiają do dziennika.</Body>
      ) : null}
    </View>
  );
}

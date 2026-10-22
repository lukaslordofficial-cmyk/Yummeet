import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Card, Field, Title, haptic } from "@/src/components/ui";
import {
  BUILTIN_QUESTIONS, FIND_PACKS, QUESTION_RULES, SOCIAL_GAMES,
  addCustomPrompt, addCustomQuestion, catalogGame, freeNoteText, setPlanLimit, setPlanNote, splitPlan, syncPlanNote, toggleGame, togglePrompt, toggleQuestion,
  type PlanItem,
} from "@/src/lib/meetingPlan";
import { loadOwnQuestions, rememberOwnQuestion } from "@/src/lib/ownQuestions";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { PlanNoteView } from "./PlanNoteView";
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
  const [note, setNote] = useState(() => freeNoteText(plan.note?.body ?? ""));
  const noteDirty = useRef(false);
  const [customQ, setCustomQ] = useState("");
  const [customP, setCustomP] = useState("");
  const [ownQuestions, setOwnQuestions] = useState<string[]>([]);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [openGame, setOpenGame] = useState<string | null>(null);
  const center = { textAlign: "center" as const, width: "100%" as const };
  const picked = (on: boolean) => (on ? colors.brandPrimary : undefined);
  const generated = plan.note?.body ?? "";

  useEffect(() => { void loadOwnQuestions().then(setOwnQuestions); }, []);

  useEffect(() => {
    if (noteDirty.current) return;
    setNote(freeNoteText(plan.note?.body ?? ""));
  }, [plan.note?.body]);

  const commit = (next: PlanItem[]) => onChange?.(next);
  const applySelection = (next: PlanItem[]) => {
    noteDirty.current = false;
    commit(syncPlanNote(setPlanNote(next, note)));
  };
  const selectedGame = (title: string) => plan.games.some((g) => g.title === title);
  const showCatalog = canEdit || browse;
  const questionList = showCatalog ? BUILTIN_QUESTIONS : BUILTIN_QUESTIONS.filter((q) => plan.questions.some((row) => row.title === q));
  const gameList = showCatalog ? SOCIAL_GAMES : SOCIAL_GAMES.filter((g) => selectedGame(g.title));

  return (
    <View style={{ gap: spacing.xl }} testID={testID}>
      <Title size={18} style={{ ...center, marginTop: spacing.lg }}>Plan spotkania</Title>
      {browse ? null : (
        <Field
          testID={`${testID}-note`}
          label="Notatka do planu"
          value={note}
          onChangeText={(text) => {
            noteDirty.current = noteCommit === "button";
            setNote(text);
            if (noteCommit === "instant" && canEdit) commit(syncPlanNote(setPlanNote(items, text)));
          }}
          placeholder="Co warto wiedzieć, zanim usiądziecie do stołu"
          multiline
          style={{ minHeight: 80 }}
          editable={canEdit}
        />
      )}
      {canEdit && noteCommit === "button" ? (
        <Button testID={`${testID}-note-save`} title="Zapisz notatkę" onPress={() => { noteDirty.current = false; commit(syncPlanNote(setPlanNote(items, note))); }} />
      ) : null}

      <Title size={18} style={{ ...center, marginTop: spacing.md }}>Proponowane aktywności</Title>
      <ExpandTile testID={`${testID}-questions-toggle`} title="Zabawa w pytania" open={questionsOpen} onPress={() => setQuestionsOpen((open) => !open)} style={{ marginTop: spacing.xl }} />
      {questionsOpen ? (
        <View style={{ gap: spacing.sm }}>
          <Body muted testID={`${testID}-question-rules`}>{QUESTION_RULES}</Body>
          {browse ? <Body muted>Przy konkretnym spotkaniu organizator ustala, ile pytań losuje każda osoba.</Body> : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md }}>
              <Body style={{ textAlign: "center" }}>Pytań na osobę: {plan.limit}</Body>
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

      <ExpandTile testID={`${testID}-games-toggle`} title="Gry i zabawy towarzyskie" open={gamesOpen} onPress={() => setGamesOpen((open) => !open)} />
      {gamesOpen ? <Body muted style={center}>Gry towarzyskie, które można rozegrać podczas speed friendingu.</Body> : null}
      {gamesOpen ? gameList.map((g) => {
        const on = selectedGame(g.title);
        const open = openGame === g.id;
        return (
          <View key={g.id} style={{ gap: spacing.sm }}>
            <Card
              testID={`${testID}-game-${g.id}`}
              accent={on ? colors.onBrandPrimary : undefined}
              onPress={() => setOpenGame(open ? null : g.id)}
              style={{ backgroundColor: colors.brandPrimary, borderColor: on ? colors.onBrandPrimary : colors.brandPrimary }}
            >
              <Title size={16} style={{ ...center, color: colors.onBrandPrimary }}>{g.title}</Title>
              <Body style={{ ...center, color: colors.onBrandPrimary }}>{g.blurb}</Body>
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
      {generated ? <PlanNoteView testID={`${testID}-generated`} body={generated} /> : null}
    </View>
  );
}

function ExpandTile({ title, open, onPress, testID, style }: { title: string; open: boolean; onPress: () => void; testID: string; style?: object }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => { haptic.tap(); onPress(); }}
      style={[{ minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.onBrandPrimary, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, style]}
    >
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.brandPrimary, textAlign: "center" }}>{title}</Text>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.brandPrimary} />
    </Pressable>
  );
}

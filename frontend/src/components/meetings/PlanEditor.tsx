import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Card, Field, Title, haptic } from "@/src/components/ui";
import {
  BUILTIN_QUESTIONS, FIND_PACKS, QUESTION_RULES, RUNAWAY_STORY_INSTRUCTION, SOCIAL_GAMES, STORY_STARTERS,
  addCustomPrompt, addCustomQuestion, gameInstruction, isQuestionPlanActive, questionPoolWarning, setPlanLimit, setStoryMode, splitPlan, storyPickMode, storyStarterLabel, syncPlanNote, toggleGame, togglePrompt, toggleQuestion, toggleStoryStarter,
  type PlanItem,
} from "@/src/lib/meetingPlan";
import { loadOwnQuestions, rememberOwnQuestion } from "@/src/lib/ownQuestions";
import { forgetSavedFindPrompt, loadSavedFindPrompts, rememberSavedFindPrompt } from "@/src/lib/savedLines";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { PlanNoteView } from "./PlanNoteView";

const FIND_HEADER = "Dodaj lub stwórz pytania, na które uczestnicy, będą odpowiadać";

export function PlanEditor({
  items,
  onChange,
  canEdit,
  browse = false,
  seats,
  onScrollHold,
  onScrollShift,
  testID = "plan-editor",
}: {
  items: PlanItem[];
  onChange?: (next: PlanItem[]) => void;
  canEdit: boolean;
  play: boolean;
  browse?: boolean;
  seats?: number;
  onScrollHold?: () => void;
  onScrollShift?: (delta: number) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const plan = splitPlan(items);
  const [customQ, setCustomQ] = useState("");
  const [customP, setCustomP] = useState("");
  const [ownQuestions, setOwnQuestions] = useState<string[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [openGame, setOpenGame] = useState<string | null>(null);
  const noteHeight = useRef(0);
  const center = { textAlign: "center" as const, width: "100%" as const };
  const picked = (on: boolean) => (on ? colors.brandPrimary : undefined);
  const generated = plan.note?.body ?? "";
  const packPrompts = FIND_PACKS.flatMap((pack) => pack.prompts);
  const poolOn = isQuestionPlanActive(items);
  const poolWarning = typeof seats === "number" && poolOn ? questionPoolWarning(seats, plan.limit, plan.questions.length) : null;
  const mode = storyPickMode(items);

  useEffect(() => { void loadOwnQuestions().then(setOwnQuestions); }, []);
  useEffect(() => { void loadSavedFindPrompts().then(setSavedPrompts); }, []);

  const hold = () => onScrollHold?.();
  const commit = (next: PlanItem[]) => onChange?.(next);
  const applySelection = (next: PlanItem[]) => {
    hold();
    commit(syncPlanNote(next));
  };
  const selectedGame = (title: string) => plan.games.some((g) => g.title === title);
  const showCatalog = canEdit || browse;
  const questionList = showCatalog ? BUILTIN_QUESTIONS : BUILTIN_QUESTIONS.filter((q) => plan.questions.some((row) => row.title === q));
  const gameList = showCatalog ? SOCIAL_GAMES : SOCIAL_GAMES.filter((g) => selectedGame(g.title));
  const meetingOnlyPrompts = plan.prompts
    .map((row) => (row.body || row.title).trim())
    .filter((body) => body.length >= 5 && !packPrompts.includes(body) && !savedPrompts.includes(body));
  const customPrompts = [...meetingOnlyPrompts, ...savedPrompts.filter((body) => !packPrompts.includes(body))];

  const addOwnPrompt = () => {
    const clean = customP.trim();
    if (clean.length < 5) return;
    hold();
    if (packPrompts.includes(clean)) {
      if (!plan.prompts.some((row) => row.body === clean)) applySelection(togglePrompt(items, clean));
      setCustomP("");
      return;
    }
    setSavedPrompts((current) => [...current.filter((line) => line !== clean), clean].slice(-40));
    void rememberSavedFindPrompt(clean).then(setSavedPrompts);
    applySelection(addCustomPrompt(items, clean));
    setCustomP("");
  };

  const removeOwnPrompt = (body: string) => {
    hold();
    setSavedPrompts((current) => current.filter((line) => line !== body));
    void forgetSavedFindPrompt(body).then(setSavedPrompts);
    if (plan.prompts.some((row) => row.body === body || row.title.includes(body))) applySelection(togglePrompt(items, body));
  };

  return (
    <View style={{ gap: spacing.xl }} testID={testID}>
      <View
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          const delta = noteHeight.current === 0 ? 0 : height - noteHeight.current;
          noteHeight.current = height;
          if (Math.abs(delta) > 1) onScrollShift?.(delta);
        }}
      >
        <Title size={18} style={{ ...center, marginTop: spacing.lg }}>Plan spotkania</Title>
        <Body muted style={center}>Planowane aktywności</Body>
        {generated ? <PlanNoteView testID={`${testID}-generated`} body={generated} /> : null}
      </View>

      <Title size={18} style={{ ...center, marginTop: spacing.md }}>Proponowane aktywności</Title>
      <ExpandTile testID={`${testID}-questions-toggle`} title="Zabawa w pytania" open={questionsOpen} onPress={() => { hold(); setQuestionsOpen((open) => !open); }} style={{ marginTop: spacing.xl }} />
      {questionsOpen ? (
        <View style={{ gap: spacing.xl, marginTop: spacing.md }}>
          <Body muted testID={`${testID}-question-rules`}>{QUESTION_RULES}</Body>
          {browse ? <Body muted>Przy konkretnym spotkaniu organizator ustala, ile pytań losuje każda osoba.</Body> : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
              <Body style={{ textAlign: "center" }}>Pytań na osobę: {plan.limit}</Body>
              {canEdit ? (
                <>
                  <Button testID={`${testID}-limit-minus`} title="−" onPress={() => applySelection(setPlanLimit(items, plan.limit - 1))} />
                  <Button testID={`${testID}-limit-plus`} title="+" onPress={() => applySelection(setPlanLimit(items, plan.limit + 1))} />
                </>
              ) : null}
            </View>
          )}
          {poolWarning ? (
            <Text testID={`${testID}-pool-warning`} style={{ color: colors.error, fontFamily: fonts.text, fontSize: 15, lineHeight: 22, textAlign: "center" }}>{poolWarning}</Text>
          ) : null}
          {canEdit ? (
            <View style={{ gap: spacing.lg }}>
              <Field testID={`${testID}-custom-question`} label="Własne pytanie" value={customQ} onChangeText={setCustomQ} placeholder="Wpisz swoje pytanie" />
              <Button testID={`${testID}-custom-question-add`} title="Dodaj własne pytanie" onPress={() => {
                hold();
                void rememberOwnQuestion(customQ).then(setOwnQuestions);
                applySelection(addCustomQuestion(items, customQ));
                setCustomQ("");
              }} />
            </View>
          ) : null}
          <View style={{ gap: spacing.md }}>
          {questionList.map((q) => {
            const on = plan.questions.some((row) => row.title === q);
            return (
              <Card key={q} testID={`${testID}-q-${BUILTIN_QUESTIONS.indexOf(q)}`} accent={picked(on)} onPress={canEdit ? () => applySelection(toggleQuestion(items, q)) : undefined}>
                <Title size={16} style={center}>{q}</Title>
              </Card>
            );
          })}
          {ownQuestions.filter((q) => !BUILTIN_QUESTIONS.some((builtin) => builtin === q) && !STORY_STARTERS.some((starter) => starter.title === q)).map((q) => {
            const on = plan.questions.some((row) => row.title === q);
            return (
              <Card key={`local-${q}`} testID={`${testID}-local-${q}`} accent={picked(on)} onPress={canEdit ? () => applySelection(on ? toggleQuestion(items, q) : addCustomQuestion(items, q)) : undefined}>
                <Title size={16} style={center}>{q}</Title>
                <Body muted style={center}>Twoje pytanie, tylko na tym telefonie</Body>
              </Card>
            );
          })}
          {plan.questions.filter((q) => !BUILTIN_QUESTIONS.some((builtin) => builtin === q.title) && !ownQuestions.includes(q.title) && !STORY_STARTERS.some((starter) => starter.title === q.title)).map((q) => (
            <Card key={q.key} testID={`${testID}-own-${q.key}`} accent={picked(plan.questions.some((row) => row.title === q.title))} onPress={canEdit ? () => applySelection(toggleQuestion(items, q.title)) : undefined}>
              <Title size={16} style={center}>{q.title}</Title>
              <Body muted style={center}>Własne pytanie tego spotkania</Body>
            </Card>
          ))}
          </View>
        </View>
      ) : null}

      <ExpandTile testID={`${testID}-games-toggle`} title="Gry i zabawy towarzyskie" open={gamesOpen} onPress={() => { hold(); setGamesOpen((open) => !open); }} />
      {gamesOpen ? <Body muted style={center}>Gry towarzyskie, które można rozegrać podczas speed friendingu.</Body> : null}
      {gamesOpen ? gameList.map((g) => {
        const on = selectedGame(g.title);
        const open = openGame === g.id;
        return (
          <View key={g.id} style={{ gap: spacing.lg }}>
            <Card
              testID={`${testID}-game-${g.id}`}
              onPress={() => { hold(); setOpenGame(open ? null : g.id); }}
              style={{ backgroundColor: colors.onBrandPrimary, borderColor: on ? colors.brandPrimary : colors.onBrandPrimary, borderWidth: on ? 2 : 1 }}
            >
              <Title size={16} style={{ ...center, color: colors.onBrandSecondary }}>{g.title}</Title>
            </Card>
            {open ? (
              <View style={{ gap: spacing.lg, paddingHorizontal: spacing.sm }}>
                <Body style={center}>{g.id === "runaway-story" ? `Instrukcja: ${RUNAWAY_STORY_INSTRUCTION}` : (gameInstruction(g.title) || g.blurb)}</Body>
                {canEdit ? (
                  <Button testID={`${testID}-game-toggle-${g.id}`} title={on ? "Usuń z planu" : "Dodaj do planu"} onPress={() => { hold(); applySelection(toggleGame(items, g)); }} />
                ) : null}
                {g.id === "find-someone" && on ? (
                  <View style={{ gap: spacing.md }}>
                    <Title size={16} testID={`${testID}-find-header`} style={center}>{FIND_HEADER}</Title>
                    {packPrompts.map((prompt) => {
                      const chosen = plan.prompts.some((row) => row.body === prompt);
                      return (
                        <Card key={prompt} testID={`${testID}-prompt-${prompt.slice(0, 24)}`} accent={picked(chosen)} onPress={canEdit ? () => applySelection(togglePrompt(items, prompt)) : undefined}>
                          <Title size={16} style={center}>{prompt}</Title>
                        </Card>
                      );
                    })}
                    {customPrompts.map((prompt) => {
                      const chosen = plan.prompts.some((row) => row.body === prompt);
                      return (
                        <Card key={`saved-${prompt}`} testID={`${testID}-saved-prompt-${prompt.slice(0, 24)}`} accent={picked(chosen)}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                            <Pressable
                              accessibilityRole="button"
                              disabled={!canEdit}
                              onPress={canEdit ? () => applySelection(togglePrompt(items, prompt)) : undefined}
                              style={{ flex: 1 }}
                            >
                              <Title size={16} style={center}>{prompt}</Title>
                            </Pressable>
                            {canEdit ? (
                              <Pressable
                                testID={`${testID}-prompt-remove-${prompt.slice(0, 24)}`}
                                accessibilityRole="button"
                                accessibilityLabel="Usuń to pytanie"
                                hitSlop={8}
                                onPress={() => removeOwnPrompt(prompt)}
                                style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
                              >
                                <Text style={{ color: colors.error, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 }}>−</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </Card>
                      );
                    })}
                    {canEdit ? (
                      <View style={{ gap: spacing.lg, marginTop: spacing.sm }}>
                        <Field testID={`${testID}-custom-prompt`} label="Własne zdanie do tej gry" value={customP} onChangeText={setCustomP} placeholder="…najprędzej zamówi deser przed daniem" />
                        <Button testID={`${testID}-custom-prompt-add`} title="Dodaj własne zdanie" onPress={addOwnPrompt} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {g.id === "runaway-story" ? (
                  <View style={{ gap: spacing.md }}>
                    {canEdit ? (
                      <View style={{ flexDirection: "row", gap: spacing.md }}>
                        <Button testID={`${testID}-story-mode-wybierz`} title="Wybierz" variant={mode === "wybierz" ? "primary" : "secondary"} onPress={() => applySelection(setStoryMode(items, "wybierz"))} style={{ flex: 1 }} />
                        <Button testID={`${testID}-story-mode-losowo`} title="Losowo" variant={mode === "losowo" ? "primary" : "secondary"} onPress={() => applySelection(setStoryMode(items, "losowo"))} style={{ flex: 1 }} />
                      </View>
                    ) : null}
                    {STORY_STARTERS.map((starter) => (
                      <StoryProposal
                        key={starter.title}
                        testID={`${testID}-story-${starter.title}`}
                        title={starter.title}
                        text={starter.text}
                        chosen={plan.starters.some((row) => storyStarterLabel(row.title) === starter.title)}
                        onPress={canEdit ? () => applySelection(toggleStoryStarter(items, starter)) : undefined}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      }) : null}
      {plan.legacy.length ? (
        <Body muted>Starsze wyzwania zostają w zapisie tego spotkania, ale nie dodajemy już nowych.</Body>
      ) : null}
    </View>
  );
}

function StoryProposal({ title, text, chosen, onPress, testID }: { title: string; text: string; chosen: boolean; onPress?: () => void; testID: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const center = { textAlign: "center" as const, width: "100%" as const };
  return (
    <Card testID={testID} accent={chosen ? colors.brandPrimary : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable accessibilityRole="button" onPress={onPress ?? (() => setOpen((value) => !value))} style={{ flex: 1 }}>
          <Title size={16} style={center}>{title}</Title>
        </Pressable>
        <Pressable
          testID={`${testID}-expand`}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? "Zwiń opis" : "Pokaż opis"}
          hitSlop={8}
          onPress={() => setOpen((value) => !value)}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.brandPrimary} />
        </Pressable>
      </View>
      {open ? <Body style={{ ...center, marginTop: spacing.sm }}>{text}</Body> : null}
    </Card>
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

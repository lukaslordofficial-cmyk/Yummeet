import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Card, Field, Title, haptic, useToast } from "@/src/components/ui";
import {
  BUILTIN_QUESTIONS, FIND_PACKS, QUESTION_RULES, SOCIAL_GAMES, STORY_STARTERS,
  addCustomActivity, addCustomPrompt, addCustomQuestion, catalogGame, customActivities, gameInstruction, isQuestionPlanActive, questionPoolWarning, removeCustomActivity, setPlanLimit, setTruthLimit, splitPlan, storyStarterLabel, syncPlanNote, toggleGame, togglePrompt, toggleQuestion, toggleStoryStarter,
  type PlanItem,
} from "@/src/lib/meetingPlan";
import { forgetSavedLine, loadSavedLines, rememberSavedLine } from "@/src/lib/savedLines";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { ActivityBody, ActivityName, PlanNoteView } from "./PlanNoteView";

const FIND_HEADER = "Dodaj lub stwórz pytania, na które uczestnicy, będą odpowiadać";
const ACCOUNT_LINE = "Twoje pytanie widoczne jedynie na twoim koncie.";

type PlanScroll = { scrollTo: (options: { y: number; animated?: boolean }) => void };

export function PlanEditor({
  items,
  onChange,
  canEdit,
  browse = false,
  seats,
  scrollRef,
  scrollOffsetRef,
  testID = "plan-editor",
}: {
  items: PlanItem[];
  onChange?: (next: PlanItem[]) => void;
  canEdit: boolean;
  play: boolean;
  browse?: boolean;
  seats?: number;
  scrollRef?: { current: PlanScroll | null };
  scrollOffsetRef?: { current: number };
  testID?: string;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const plan = splitPlan(items);
  const homemade = customActivities(items);
  const [customQ, setCustomQ] = useState("");
  const [customP, setCustomP] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [ownQuestions, setOwnQuestions] = useState<string[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [ownStarters, setOwnStarters] = useState<{ title: string; text: string }[]>([]);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [headingDraft, setHeadingDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const droppedQuestions = useRef<Set<string>>(new Set());
  const titleNodes = useRef<Record<string, View | null>>({});
  const planAnchor = useRef<View | null>(null);
  const center = { textAlign: "center" as const, width: "100%" as const };
  const picked = (on: boolean) => (on ? colors.brandPrimary : undefined);
  const generated = plan.note?.body ?? "";
  const packPrompts = FIND_PACKS.flatMap((pack) => pack.prompts);
  const poolOn = isQuestionPlanActive(items);
  const poolWarning = typeof seats === "number" && poolOn ? questionPoolWarning(seats, plan.limit, plan.questions.length) : null;

  useEffect(() => {
    void loadSavedLines("question").then((rows) => setOwnQuestions(rows.map((row) => row.body)));
    void loadSavedLines("find_prompt").then((rows) => setSavedPrompts(rows.map((row) => row.body)));
    void loadSavedLines("story_starter").then((rows) => setOwnStarters(rows.map((row) => ({ title: row.label || row.body.slice(0, 42), text: row.body }))));
  }, []);

  const commit = (next: PlanItem[]) => onChange?.(next);
  const applySelection = (next: PlanItem[]) => commit(syncPlanNote(next));
  const selectedGame = (id: string) => plan.games.some((g) => catalogGame(g.title)?.id === id);
  const showCatalog = canEdit || browse;
  const questionList = showCatalog ? BUILTIN_QUESTIONS : BUILTIN_QUESTIONS.filter((q) => plan.questions.some((row) => row.title === q));
  const gameList = showCatalog ? SOCIAL_GAMES : SOCIAL_GAMES.filter((g) => selectedGame(g.id));
  const savedQuestionSet = new Set(ownQuestions);
  const meetingQuestions = plan.questions
    .map((row) => row.title)
    .filter((title) => !BUILTIN_QUESTIONS.some((builtin) => builtin === title) && !savedQuestionSet.has(title) && !STORY_STARTERS.some((starter) => starter.title === title) && !droppedQuestions.current.has(title));
  const visibleOwnQuestions = [...ownQuestions.filter((q) => !BUILTIN_QUESTIONS.some((builtin) => builtin === q) && !STORY_STARTERS.some((starter) => starter.title === q) && !droppedQuestions.current.has(q)), ...meetingQuestions];
  const meetingOnlyPrompts = plan.prompts
    .map((row) => (row.body || row.title).trim())
    .filter((body) => body.length >= 5 && !packPrompts.includes(body) && !savedPrompts.includes(body));
  const customPrompts = [...savedPrompts.filter((body) => !packPrompts.includes(body)), ...meetingOnlyPrompts];
  const catalogTitles = new Set(STORY_STARTERS.map((starter) => starter.title));
  const meetingStarters = plan.starters
    .map((row) => ({ title: storyStarterLabel(row.title), text: (row.body || "").trim() }))
    .filter((starter) => starter.title.length > 1 && starter.text.length > 4 && !catalogTitles.has(starter.title) && !ownStarters.some((row) => row.title === starter.title));
  const customStarters = [...ownStarters.filter((starter) => !catalogTitles.has(starter.title)), ...meetingStarters];

  const keepTileInPlace = (id: string, yBefore: number) => {
    const card = titleNodes.current[id];
    if (!card || !scrollRef?.current) return;
    card.measureInWindow((_cx, yAfter) => {
      const delta = yAfter - yBefore;
      if (Math.abs(delta) < 4) return;
      const current = scrollOffsetRef?.current ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, current + delta), animated: false });
    });
  };

  const openGameTile = (id: string) => {
    if (openGame === id) {
      setOpenGame(null);
      return;
    }
    const card = titleNodes.current[id];
    if (!card) {
      setOpenGame(id);
      return;
    }
    card.measureInWindow((_cx, yBefore) => {
      setOpenGame(id);
      const keep = () => keepTileInPlace(id, yBefore);
      requestAnimationFrame(keep);
      setTimeout(keep, 50);
      setTimeout(keep, 200);
    });
  };

  const addOwnQuestion = () => {
    const clean = customQ.trim();
    if (clean.length < 5) return;
    droppedQuestions.current.delete(clean);
    setOwnQuestions((current) => [clean, ...current.filter((line) => line !== clean)].slice(0, 40));
    void rememberSavedLine("question", clean).then((rows) => {
      if (droppedQuestions.current.has(clean)) return;
      setOwnQuestions([clean, ...rows.map((row) => row.body).filter((body) => body !== clean && !droppedQuestions.current.has(body))]);
    });
    applySelection(addCustomQuestion(items, clean));
    setCustomQ("");
    toast("Dodano nowe pytanie.", "success");
  };

  const removeOwnQuestion = (body: string) => {
    droppedQuestions.current.add(body);
    setOwnQuestions((current) => current.filter((line) => line !== body));
    void forgetSavedLine("question", body);
    applySelection(items.filter((item) => item.title !== body));
  };

  const addOwnPrompt = () => {
    const clean = customP.trim();
    if (clean.length < 5) return;
    if (packPrompts.includes(clean)) {
      if (!plan.prompts.some((row) => row.body === clean)) applySelection(togglePrompt(items, clean));
      setCustomP("");
      return;
    }
    setSavedPrompts((current) => [clean, ...current.filter((line) => line !== clean)].slice(0, 40));
    void rememberSavedLine("find_prompt", clean).then((rows) => setSavedPrompts(rows.map((row) => row.body)));
    applySelection(addCustomPrompt(items, clean));
    setCustomP("");
  };

  const removeOwnPrompt = (body: string) => {
    setSavedPrompts((current) => current.filter((line) => line !== body));
    void forgetSavedLine("find_prompt", body);
    applySelection(togglePrompt(items, body));
  };

  const addOwnStarter = () => {
    const title = storyTitle.trim();
    const text = storyText.trim();
    if (title.length < 2 || text.length < 5) return;
    setOwnStarters((current) => [{ title, text }, ...current.filter((row) => row.title !== title)].slice(0, 40));
    void rememberSavedLine("story_starter", text, title).then((rows) => setOwnStarters(rows.map((row) => ({ title: row.label || row.body.slice(0, 42), text: row.body }))));
    if (!plan.starters.some((row) => storyStarterLabel(row.title) === title)) applySelection(toggleStoryStarter(items, { title, text }));
    setStoryTitle("");
    setStoryText("");
  };

  const removeOwnStarter = (title: string, text: string) => {
    setOwnStarters((current) => current.filter((row) => row.title !== title));
    void forgetSavedLine("story_starter", text).then((rows) => setOwnStarters(rows.map((row) => ({ title: row.label || row.body.slice(0, 42), text: row.body }))));
    if (plan.starters.some((row) => storyStarterLabel(row.title) === title)) applySelection(toggleStoryStarter(items, { title, text }));
  };

  return (
    <View ref={planAnchor} collapsable={false} style={{ gap: spacing.xl }} testID={testID}>
      <Title size={18} style={{ ...center, marginTop: spacing.lg }}>Plan spotkania</Title>
      <Body muted style={center}>Planowane aktywności</Body>
      <Card testID={`${testID}-plan-window`} style={{ backgroundColor: colors.surfaceTertiary, gap: spacing.lg }}>
        {homemade.map((activity) => (
          <View key={activity.key} testID={`${testID}-custom-${activity.key}`} style={{ gap: spacing.md }}>
            {activity.title ? <ActivityName>{activity.title}</ActivityName> : null}
            {activity.body ? <ActivityBody>{activity.body}</ActivityBody> : null}
            {canEdit ? (
              <Button
                testID={`${testID}-custom-remove-${activity.key}`}
                title="Usuń z planu"
                variant="ghost"
                onPress={() => applySelection(removeCustomActivity(items, activity.keys))}
              />
            ) : null}
          </View>
        ))}
        {generated ? (
          <PlanNoteView testID={`${testID}-generated`} body={generated} />
        ) : homemade.length ? null : (
          <Body muted style={center}>Tu pojawią się nagłówki, opisy i zabawy dodane do planu.</Body>
        )}
      </Card>
      {canEdit ? (
        <View style={{ gap: spacing.lg }}>
          {activityOpen ? (
            <>
              <Field testID={`${testID}-custom-heading`} label="Tytuł aktywności" value={headingDraft} onChangeText={setHeadingDraft} placeholder="np. Przywitanie przy stole" />
              <Field testID={`${testID}-custom-body`} label="Opis aktywności" value={bodyDraft} onChangeText={setBodyDraft} placeholder="Opis, który zobaczą goście" multiline style={{ minHeight: 80 }} />
              <Button
                testID={`${testID}-custom-activity-save`}
                title="Zapisz"
                onPress={() => {
                  applySelection(addCustomActivity(items, headingDraft, bodyDraft));
                  setHeadingDraft("");
                  setBodyDraft("");
                  setActivityOpen(false);
                }}
              />
            </>
          ) : (
            <Button testID={`${testID}-custom-activity-add`} title="Dodaj tytuł i opis aktywności" onPress={() => setActivityOpen(true)} />
          )}
        </View>
      ) : null}

      <Title size={18} style={{ ...center, marginTop: spacing.md }}>Proponowane aktywności</Title>
      <ExpandTile testID={`${testID}-questions-toggle`} title="Zabawa w pytania" open={questionsOpen} onPress={() => setQuestionsOpen((open) => !open)} style={{ marginTop: spacing.xl }} />
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
              <Button testID={`${testID}-custom-question-add`} title="Dodaj własne pytanie" onPress={addOwnQuestion} />
            </View>
          ) : null}
          <View style={{ gap: spacing.md }}>
          {visibleOwnQuestions.map((q) => (
            <OwnLine
              key={`own-q-${q}`}
              testID={`${testID}-local-${q}`}
              text={q}
              chosen={plan.questions.some((row) => row.title === q)}
              onPress={canEdit ? () => applySelection(plan.questions.some((row) => row.title === q) ? toggleQuestion(items, q) : addCustomQuestion(items, q)) : undefined}
              onRemove={canEdit ? () => removeOwnQuestion(q) : undefined}
            />
          ))}
          {questionList.map((q) => {
            const on = plan.questions.some((row) => row.title === q);
            return (
              <Card key={q} testID={`${testID}-q-${BUILTIN_QUESTIONS.indexOf(q)}`} accent={picked(on)} onPress={canEdit ? () => applySelection(toggleQuestion(items, q)) : undefined}>
                <Title size={16} style={center}>{q}</Title>
              </Card>
            );
          })}
          </View>
        </View>
      ) : null}

      <ExpandTile testID={`${testID}-games-toggle`} title="Gry i zabawy towarzyskie" open={gamesOpen} onPress={() => setGamesOpen((open) => !open)} />
      {gamesOpen ? <Body muted style={center}>Gry towarzyskie, które można rozegrać podczas speed friendingu.</Body> : null}
      {gamesOpen ? gameList.map((g) => {
        const on = selectedGame(g.id);
        const open = openGame === g.id;
        return (
          <View key={g.id} style={{ gap: spacing.lg }}>
            <View ref={(node) => { titleNodes.current[g.id] = node; }} collapsable={false}>
              <Card
                testID={`${testID}-game-${g.id}`}
                onPress={() => openGameTile(g.id)}
                style={{ backgroundColor: colors.onBrandPrimary, borderColor: on ? colors.brandPrimary : colors.onBrandPrimary, borderWidth: on ? 2 : 1 }}
              >
                <Title size={16} style={{ ...center, color: colors.onBrandSecondary }}>{g.title}</Title>
              </Card>
            </View>
            {open ? (
              <View style={{ gap: g.id === "runaway-story" ? spacing.xxl : spacing.xl, paddingHorizontal: spacing.sm }}>
                <Body style={center}>{gameInstruction(g.title) || g.blurb}</Body>
                {canEdit && g.id !== "find-someone" ? (
                  <Button testID={`${testID}-game-toggle-${g.id}`} title={on ? "Usuń z planu" : "Dodaj do planu"} onPress={() => applySelection(toggleGame(items, g))} />
                ) : null}
                {canEdit && g.id === "two-truths" && on ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
                    <Body style={{ textAlign: "center" }}>Zdań na osobę: {plan.truthLimit}</Body>
                    <Button testID={`${testID}-truth-limit-minus`} title="−" onPress={() => applySelection(setTruthLimit(items, plan.truthLimit - 1))} />
                    <Button testID={`${testID}-truth-limit-plus`} title="+" onPress={() => applySelection(setTruthLimit(items, plan.truthLimit + 1))} />
                  </View>
                ) : null}
                {canEdit && g.id === "find-someone" && on ? (
                  <Button testID={`${testID}-game-toggle-${g.id}`} title="Usuń z planu" onPress={() => applySelection(toggleGame(items, g))} />
                ) : null}
                {g.id === "find-someone" ? (
                  <View style={{ gap: spacing.xl }}>
                    <Title size={16} testID={`${testID}-find-header`} style={center}>{FIND_HEADER}</Title>
                    {canEdit ? (
                      <View style={{ gap: spacing.lg }}>
                        <Field testID={`${testID}-custom-prompt`} label="Własne pytanie" value={customP} onChangeText={setCustomP} placeholder="Zamówiłbyś/łabyś deser przed daniem?" />
                        <Button testID={`${testID}-custom-prompt-add`} title="Dodaj własne pytanie" onPress={addOwnPrompt} />
                      </View>
                    ) : null}
                    <View style={{ gap: spacing.md }}>
                      {customPrompts.map((prompt) => {
                        const chosen = plan.prompts.some((row) => row.body === prompt);
                        return (
                          <OwnLine
                            key={`saved-${prompt}`}
                            testID={`${testID}-saved-prompt-${prompt.slice(0, 24)}`}
                            text={prompt}
                            chosen={chosen}
                            onPress={canEdit ? () => applySelection(togglePrompt(items, prompt)) : undefined}
                            onRemove={canEdit ? () => removeOwnPrompt(prompt) : undefined}
                          />
                        );
                      })}
                      {packPrompts.map((prompt) => {
                        const chosen = plan.prompts.some((row) => row.body === prompt);
                        return (
                          <Card key={prompt} testID={`${testID}-prompt-${prompt.slice(0, 24)}`} accent={picked(chosen)} onPress={canEdit ? () => applySelection(togglePrompt(items, prompt)) : undefined}>
                            <Title size={16} style={center}>{prompt}</Title>
                          </Card>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                {g.id === "runaway-story" ? (
                  <View style={{ gap: spacing.xxl }}>
                    <View style={{ gap: spacing.md }}>
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
                      {customStarters.map((starter) => (
                        <StoryProposal
                          key={`own-${starter.title}`}
                          testID={`${testID}-story-own-${starter.title}`}
                          title={starter.title}
                          text={starter.text}
                          own
                          chosen={plan.starters.some((row) => storyStarterLabel(row.title) === starter.title)}
                          onPress={canEdit ? () => applySelection(toggleStoryStarter(items, starter)) : undefined}
                          onRemove={canEdit ? () => removeOwnStarter(starter.title, starter.text) : undefined}
                        />
                      ))}
                    </View>
                    {canEdit ? (
                      <View style={{ gap: spacing.lg }}>
                        <Field testID={`${testID}-custom-story-title`} label="Tytuł własnego początku" value={storyTitle} onChangeText={setStoryTitle} placeholder="Krótki tytuł" />
                        <Field testID={`${testID}-custom-story-text`} label="Początek historii z haczykiem" value={storyText} onChangeText={setStoryText} placeholder="Zdanie startowe, które zostawia haczyk…" multiline style={{ minHeight: 100 }} />
                        <Button testID={`${testID}-custom-story-add`} title="Dodaj własny początek" onPress={addOwnStarter} />
                      </View>
                    ) : null}
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

function OwnLine({ text, chosen, onPress, onRemove, testID }: { text: string; chosen: boolean; onPress?: () => void; onRemove?: () => void; testID: string }) {
  const { colors } = useTheme();
  const center = { textAlign: "center" as const, width: "100%" as const };
  return (
    <Card testID={testID} accent={chosen ? colors.brandPrimary : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={{ flex: 1, gap: spacing.sm }}>
          <Title size={16} style={center}>{text}</Title>
          <Body muted style={center}>{ACCOUNT_LINE}</Body>
        </Pressable>
        {onRemove ? (
          <Pressable testID={`${testID}-remove`} accessibilityRole="button" accessibilityLabel="Usuń to pytanie" hitSlop={8} onPress={onRemove} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.error, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 }}>−</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function StoryProposal({ title, text, chosen, own, onPress, onRemove, testID }: { title: string; text: string; chosen: boolean; own?: boolean; onPress?: () => void; onRemove?: () => void; testID: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const center = { textAlign: "center" as const, width: "100%" as const };
  return (
    <Card testID={testID} accent={chosen ? colors.brandPrimary : undefined}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <Pressable accessibilityRole="button" onPress={onPress ?? (() => setOpen((value) => !value))} style={{ flex: 1, gap: spacing.sm }}>
          <Title size={16} style={center}>{title}</Title>
          {open ? <Body style={center}>{text}</Body> : null}
          {own ? <Body muted style={center}>{ACCOUNT_LINE}</Body> : null}
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
        {onRemove ? (
          <Pressable testID={`${testID}-remove`} accessibilityRole="button" accessibilityLabel="Usuń to pytanie" hitSlop={8} onPress={onRemove} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.error, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 }}>−</Text>
          </Pressable>
        ) : null}
      </View>
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
      style={[{ minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, style]}
    >
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.onBrandPrimary, textAlign: "center" }}>{title}</Text>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.onBrandPrimary} />
    </Pressable>
  );
}

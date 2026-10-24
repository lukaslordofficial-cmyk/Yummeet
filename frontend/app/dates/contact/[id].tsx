import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Body, Button, Card, Chip, ChipRow, ErrorState, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { blockUser, report } from "@/src/lib/data";
import {
  DATING_GAMES,
  DATING_QUESTIONS,
  FOOD_FORMATS,
  FOOD_MISSIONS,
  SPLITS,
  answerDating,
  askDating,
  contactStatusLabel,
  datingContact,
  decideDating,
  endDating,
  formatLabel,
  respondDating,
  saveDatingPlan,
  type DatingContact,
} from "@/src/lib/dating";
import { spacing, useTheme } from "@/src/theme";

export default function DatingContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const [row, setRow] = useState<DatingContact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, { answer: string; skipped: boolean }>>({});
  const [meetDate, setMeetDate] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [place, setPlace] = useState("dinner");
  const [budget, setBudget] = useState("");
  const [split, setSplit] = useState("later");
  const [games, setGames] = useState<string[]>([]);
  const [missions, setMissions] = useState<string[]>([]);
  const [rules, setRules] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await datingContact(id);
      setRow(next);
      setError(null);
      if (next.plan) {
        setMeetDate(next.plan.meet_date ? String(next.plan.meet_date).slice(0, 10) : "");
        setMeetTime(next.plan.meet_time ?? "");
        setPlace(next.plan.place_kind ?? "dinner");
        setBudget(next.plan.budget_note ?? "");
        setSplit(next.plan.split ?? "later");
        setGames(next.plan.game_ids ?? []);
        setMissions(next.plan.mission_ids ?? []);
      }
      const seed: Record<string, { answer: string; skipped: boolean }> = {};
      for (const q of next.questions ?? []) seed[q.id] = { answer: q.answer ?? "", skipped: q.skipped };
      setAnswers(seed);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await action();
      toast(ok, "success");
      await load();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], value: string, max: number) => {
    if (list.includes(value)) return list.filter((item) => item !== value);
    if (list.length >= max) return list;
    return [...list, value];
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Kontakt" /><ErrorState message={error} onRetry={load} /></View>;
  if (!row) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Kontakt" /><Loading /></View>;

  return (
    <View testID="dating-contact-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={row.person.display_name} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}>
        <Body muted>{contactStatusLabel[row.status] ?? row.status} · {formatLabel(row.listing.format)}</Body>
        <Body>{row.person.bio}</Body>
        <Card testID="dating-contact-invite"><Body>{row.listing.blurb}</Body></Card>

        {row.status === "pending" && row.role === "host" ? (
          <>
            <Button testID="dating-accept" title="Przyjmij zgłoszenie" loading={busy} onPress={() => run(() => respondDating(row.id, true), "Możecie zacząć od pytań")} />
            <Button testID="dating-reject" title="Odrzuć" variant="danger" loading={busy} onPress={() => run(() => respondDating(row.id, false), "Zgłoszenie odrzucone")} />
          </>
        ) : null}
        {row.status === "pending" && row.role === "guest" ? <Body muted>Czekamy, aż druga osoba przyjmie zgłoszenie.</Body> : null}

        {row.status === "questions" && row.role === "guest" && row.questions.length === 0 ? (
          <>
            <Title size={20}>Wybierz 3–5 pytań</Title>
            <Body muted>Chcesz lepiej poznać tę osobę? Własne pytania i pełna biblioteka będą w Yummeet+.</Body>
            {DATING_QUESTIONS.map((q) => (
              <Chip key={q.id} testID={`dating-q-${q.id}`} label={q.prompt} selected={picked.includes(q.id)} onPress={() => setPicked((cur) => toggle(cur, q.id, 5))} />
            ))}
            <Button testID="dating-send-questions" title={`Wyślij pytania (${picked.length})`} loading={busy} disabled={picked.length < 3} onPress={() => run(() => askDating(row.id, picked), "Pytania wysłane")} />
          </>
        ) : null}

        {row.questions.length > 0 ? (
          <>
            <Title size={20}>Pytania</Title>
            {row.questions.map((q) => (
              <Card key={q.id} testID={`dating-answer-${q.id}`}>
                <Body>{q.prompt}</Body>
                {row.status === "questions" && row.role === "host" ? (
                  <>
                    <Field testID={`dating-answer-input-${q.id}`} label="Odpowiedź" value={answers[q.id]?.answer ?? ""} onChangeText={(text) => setAnswers((cur) => ({ ...cur, [q.id]: { answer: text, skipped: false } }))} multiline />
                    <Chip testID={`dating-skip-${q.id}`} label="Pomiń" selected={!!answers[q.id]?.skipped} onPress={() => setAnswers((cur) => ({ ...cur, [q.id]: { answer: "", skipped: !cur[q.id]?.skipped } }))} />
                  </>
                ) : (
                  <Body muted>{q.skipped ? "Pominięte" : q.answer || "Czeka na odpowiedź"}</Body>
                )}
              </Card>
            ))}
            {row.status === "questions" && row.role === "host" ? (
              <Button testID="dating-send-answers" title="Wyślij odpowiedzi" loading={busy} onPress={() => run(() => answerDating(row.id, row.questions.map((q) => ({
                id: q.id,
                answer: answers[q.id]?.answer ?? "",
                skipped: !!answers[q.id]?.skipped,
              }))), "Odpowiedzi zapisane")} />
            ) : null}
          </>
        ) : null}

        {row.status === "deciding" ? (
          <>
            <Title size={20}>Co dalej?</Title>
            <Body muted>Plan randki otwiera się dopiero, gdy oboje wybierzecie spotkanie. Do tego czasu piszecie na czacie.</Body>
            {row.my_decision ? <Body>Twoja decyzja: {row.my_decision === "date" ? "randka" : row.my_decision === "talk" ? "najpierw rozmowa" : "koniec"}</Body> : null}
            {row.their_decision ? <Body muted>Druga osoba też już wybrała. Szczegółów odmowy nie pokazujemy.</Body> : <Body muted>Druga osoba jeszcze nie wybrała.</Body>}
            <Button testID="dating-decide-date" title="Chcę umówić się na randkę" loading={busy} onPress={() => run(() => decideDating(row.id, "date"), "Decyzja zapisana")} />
            <Button testID="dating-decide-pass" title="Nie tym razem" variant="ghost" loading={busy} onPress={() => run(() => decideDating(row.id, "pass"), "Kontakt zakończony")} />
          </>
        ) : null}

        {row.plan_open ? (
          <>
            <Title size={20}>Planujemy randkę</Title>
            <Body muted>Ustalcie szczegóły dotyczące spotkania.</Body>
            <Field testID="dating-plan-date" label="Data (RRRR-MM-DD)" value={meetDate} onChangeText={setMeetDate} />
            <Field testID="dating-plan-time" label="Godzina (GG:MM)" value={meetTime} onChangeText={setMeetTime} placeholder="19:00" />
            <Body>Rodzaj miejsca</Body>
            <ChipRow testID="dating-plan-place">{FOOD_FORMATS.map((f) => <Chip key={f.key} testID={`dating-place-${f.key}`} label={f.label} selected={place === f.key} onPress={() => setPlace(f.key)} />)}</ChipRow>
            <Field testID="dating-plan-budget" label="Budżet, słownie" value={budget} onChangeText={setBudget} placeholder="np. do 80 zł na osobę" />
            <Body>Podział kosztów</Body>
            <ChipRow testID="dating-plan-split">{SPLITS.map((f) => <Chip key={f.key} testID={`dating-split-${f.key}`} label={f.label} selected={split === f.key} onPress={() => setSplit(f.key)} />)}</ChipRow>
            <Title size={18}>Misje przy jedzeniu</Title>
            {FOOD_MISSIONS.map((m) => (
              <Chip key={m.id} testID={`dating-mission-${m.id}`} label={m.title} selected={missions.includes(m.id)} onPress={() => setMissions((cur) => toggle(cur, m.id, 2))} />
            ))}
            {FOOD_MISSIONS.filter((m) => missions.includes(m.id)).map((m) => <Body key={m.id} muted>{m.body}</Body>)}
            <Title size={18}>Zabawy z Yummeet</Title>
            {DATING_GAMES.map((g) => (
              <Chip key={g.id} testID={`dating-game-${g.id}`} label={g.title} selected={games.includes(g.id)} onPress={() => setGames((cur) => toggle(cur, g.id, 2))} />
            ))}
            {DATING_GAMES.filter((g) => games.includes(g.id)).map((g) => (
              <Button key={g.id} testID={`dating-rules-${g.id}`} title={`Zasady: ${g.title}`} variant="ghost" onPress={() => setRules(rules === g.id ? null : g.id)} />
            ))}
            {rules ? <Body>{DATING_GAMES.find((g) => g.id === rules)?.rules}</Body> : null}
            <Button testID="dating-save-plan" title="Zapisz plan" loading={busy} onPress={() => run(() => saveDatingPlan(row.id, {
              meet_date: meetDate,
              meet_time: meetTime,
              place_kind: place,
              budget_note: budget,
              split,
              game_ids: games,
              mission_ids: missions,
            }), "Plan zapisany")} />
          </>
        ) : null}

        {row.status !== "declined" && row.status !== "cancelled" ? (
          <Button testID="dating-end" title="Zakończ kontakt" variant="danger" loading={busy} onPress={() => run(() => endDating(row.id), "Kontakt zakończony")} />
        ) : null}
        <Button testID="dating-contact-block" title="Zablokuj" variant="ghost" onPress={() => run(() => blockUser(row.person.user_id), "Osoba zablokowana")} />
        <Button testID="dating-contact-report" title="Zgłoś" variant="ghost" onPress={() => run(() => report("profile", row.person.user_id, "dating"), "Zgłoszenie zapisane")} />
      </KeyboardAwareScrollView>
    </View>
  );
}

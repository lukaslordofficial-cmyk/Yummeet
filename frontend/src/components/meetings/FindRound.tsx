import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Body, Button, Card, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { FIND_SOMEONE_GUESS_INSTRUCTION, FIND_SOMEONE_PLAY_INSTRUCTION, findPromptSummary } from "@/src/lib/meetingPlan";
import { useAuth } from "@/src/providers/AuthProvider";
import { ActivityName } from "./PlanNoteView";
import { eventFindSubmit, type FindState, type PlayParticipant } from "@/src/lib/play";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

const WAIT = "Zapisano odpowiedzi. Czekaj na innych użytkowników...";

export function FindRound({
  eventId,
  prompts,
  participants,
  find,
  onBoard,
  onNext,
  nextBusy,
}: {
  eventId: string;
  prompts: string[];
  participants: PlayParticipant[];
  find: FindState | null | undefined;
  onBoard: (next: Awaited<ReturnType<typeof eventFindSubmit>>) => void;
  onNext?: () => void;
  nextBusy?: boolean;
}) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const myId = session?.user.id;
  const phase = find?.phase ?? 1;
  const [yes, setYes] = useState<Record<string, boolean | null>>({});
  const [names, setNames] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextYes: Record<string, boolean | null> = {};
    const nextNames: Record<string, string[]> = {};
    for (const prompt of prompts) {
      const saved = find?.answers.find((row) => row.prompt === prompt);
      nextYes[prompt] = saved?.yes ?? null;
      nextNames[prompt] = saved?.names ?? [];
    }
    setYes(nextYes);
    setNames(nextNames);
  }, [find?.phase, find?.saved, prompts.join("|")]);

  const save = async () => {
    setBusy(true);
    try {
      const rows = prompts.map((prompt) => phase === 1
        ? { prompt, yes: yes[prompt] === true }
        : { prompt, names: names[prompt] ?? [] });
      if (phase === 1 && prompts.some((prompt) => yes[prompt] == null)) {
        setError("Zaznacz tak albo nie przy każdym zdaniu.");
        return;
      }
      onBoard(await eventFindSubmit(eventId, rows));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (phase >= 3 && find?.reveal) {
    const ranking = find.ranking ?? [];
    const place = ranking.length ? ranking.filter((row) => row.score > (find.score ?? 0)).length + 1 : null;
    return (
      <View style={{ gap: spacing.xl }} testID="find-results">
        <Title size={18} style={{ textAlign: "center" }}>Ranking</Title>
        {ranking.map((row, index) => (
          <Title key={row.id} size={16} style={{ textAlign: "center" }}>{index + 1}. {row.name}: {row.score} pkt</Title>
        ))}
        <Title size={22} style={{ textAlign: "center" }}>Twój wynik: {find.score ?? 0} pkt</Title>
        {place != null ? <Title size={18} style={{ textAlign: "center" }}>Twoje miejsce: {place}</Title> : null}
        <Body style={{ textAlign: "center" }}>Poprawny typ +1, pomyłka −1, wstrzymanie 0.</Body>
        {find.reveal.map((row) => (
          <Card key={row.prompt} style={{ gap: spacing.sm }}>
            <ActivityName>{findPromptSummary(row.prompt)}</ActivityName>
            <Body>Tak: {row.yes.length ? row.yes.join(", ") : "nikt"}</Body>
            <Body>Nie: {row.no.length ? row.no.join(", ") : "nikt"}</Body>
            <Body>Twoje typy: {row.mine.length ? row.mine.join(", ") : "brak"}</Body>
            <Body>Punkty za to zdanie: {row.points > 0 ? `+${row.points}` : row.points}</Body>
          </Card>
        ))}
        {onNext ? (
          <Button testID="find-next-game" title="Przejdź do następnej zabawy" loading={nextBusy} onPress={onNext} />
        ) : null}
      </View>
    );
  }

  const locked = !!find?.saved && phase < 3;

  return (
    <View style={{ gap: spacing.xl }} testID="find-round">
      <Body style={{ textAlign: "center" }}>{phase === 1 ? FIND_SOMEONE_PLAY_INSTRUCTION : FIND_SOMEONE_GUESS_INSTRUCTION}</Body>
      {error ? <Body testID="find-error">{error}</Body> : null}
      {locked ? <Title size={16} style={{ textAlign: "center" }} testID="find-wait">{WAIT}</Title> : null}
      {prompts.map((prompt) => (
        <Card key={prompt} style={{ gap: spacing.xl, paddingVertical: spacing.xl }}>
          <Title size={16}>{prompt}</Title>
          {phase === 1 ? (
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              {([true, false] as const).map((value) => (
                <Button
                  key={String(value)}
                  testID={`find-${value ? "yes" : "no"}-${prompt.slice(0, 12)}`}
                  title={value ? "Tak" : "Nie"}
                  variant={yes[prompt] === value ? "primary" : "secondary"}
                  style={{ flex: 1 }}
                  disabled={locked}
                  onPress={() => setYes((cur) => ({ ...cur, [prompt]: value }))}
                />
              ))}
            </View>
          ) : (
            <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
              {(names[prompt] ?? []).map((name) => (
                <View key={name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                  <Body>{name}</Body>
                  <Button
                    testID={`find-remove-${name}`}
                    title="−"
                    variant="ghost"
                    disabled={locked}
                    style={{ minWidth: 48, paddingHorizontal: spacing.md }}
                    onPress={() => setNames((cur) => ({ ...cur, [prompt]: (cur[prompt] ?? []).filter((item) => item !== name) }))}
                  />
                </View>
              ))}
              <Button testID={`find-add-${prompt.slice(0, 12)}`} title="+" disabled={locked} onPress={() => setOpen(open === prompt ? null : prompt)} />
              {open === prompt ? participants.filter((person) => person.id !== myId && !(names[prompt] ?? []).includes(person.name)).map((person) => (
                <Pressable
                  key={person.id}
                  testID={`find-person-${person.id}`}
                  onPress={() => {
                    setNames((cur) => ({ ...cur, [prompt]: [...(cur[prompt] ?? []), person.name] }));
                    setOpen(null);
                  }}
                  style={{ backgroundColor: colors.onBrandPrimary, borderRadius: radius.md, padding: spacing.lg }}
                >
                  <Title size={16} style={{ color: colors.onSurface, textAlign: "center", fontFamily: fonts.display }}>{person.name}</Title>
                </Pressable>
              )) : null}
            </View>
          )}
        </Card>
      ))}
      <Button
        testID="find-save"
        title="Zapisz odpowiedzi"
        loading={busy}
        disabled={locked || prompts.length === 0}
        onPress={() => void save()}
      />
    </View>
  );
}

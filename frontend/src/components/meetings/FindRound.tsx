import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Body, Button, Card, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { FIND_SOMEONE_INSTRUCTION } from "@/src/lib/meetingPlan";
import { eventFindSubmit, type FindState, type PlayParticipant } from "@/src/lib/play";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

const WAIT = "Wyniki zobaczysz dopiero, gdy wszyscy uczestnicy wypełnią test.";

export function FindRound({
  eventId,
  prompts,
  participants,
  find,
  onBoard,
}: {
  eventId: string;
  prompts: string[];
  participants: PlayParticipant[];
  find: FindState | null | undefined;
  onBoard: (next: Awaited<ReturnType<typeof eventFindSubmit>>) => void;
}) {
  const { colors } = useTheme();
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
    return (
      <View style={{ gap: spacing.md }} testID="find-results">
        <Title size={22} style={{ textAlign: "center" }}>Wynik: {find.score ?? 0} pkt</Title>
        <Body style={{ textAlign: "center" }}>Poprawny typ +1, pomyłka −1.</Body>
        {find.reveal.map((row) => (
          <Card key={row.prompt}>
            <Title size={16}>{row.prompt}</Title>
            <Body>Tak: {row.yes.length ? row.yes.join(", ") : "nikt"}</Body>
            <Body>Nie: {row.no.length ? row.no.join(", ") : "nikt"}</Body>
            <Body>Twoje typy: {row.mine.length ? row.mine.join(", ") : "brak"}</Body>
            <Body>Punkty za to zdanie: {row.points > 0 ? `+${row.points}` : row.points}</Body>
          </Card>
        ))}
      </View>
    );
  }

  const locked = !!find?.saved && phase < 3;

  return (
    <View style={{ gap: spacing.md }} testID="find-round">
      <Body style={{ textAlign: "center" }}>{FIND_SOMEONE_INSTRUCTION}</Body>
      <Body style={{ textAlign: "center" }}>
        {phase === 1
          ? "Zaznacz tak albo nie przy każdym zdaniu i zapisz odpowiedzi."
          : "Przy tych samych zdaniach wskaż, kto Twoim zdaniem odpowiedział tak. Możesz nie wskazać nikogo, żeby nie stracić punktów."}
      </Body>
      {error ? <Body testID="find-error">{error}</Body> : null}
      {locked && phase === 2 ? <Title size={16} style={{ textAlign: "center" }} testID="find-wait">{WAIT}</Title> : null}
      {locked && phase === 1 ? <Body style={{ textAlign: "center" }}>Twoje odpowiedzi są zapisane. Druga tura zacznie się, gdy wszyscy zapiszą.</Body> : null}
      {prompts.map((prompt) => (
        <Card key={prompt}>
          <Title size={16}>{prompt}</Title>
          {phase === 1 ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
            <View style={{ gap: spacing.sm }}>
              {(names[prompt] ?? []).map((name) => (
                <View key={name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
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
              {open === prompt ? participants.filter((person) => !(names[prompt] ?? []).includes(person.name)).map((person) => (
                <Pressable
                  key={person.id}
                  testID={`find-person-${person.id}`}
                  onPress={() => setNames((cur) => ({ ...cur, [prompt]: [...(cur[prompt] ?? []), person.name] }))}
                  style={{ backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md }}
                >
                  <Title size={16} style={{ color: colors.onBrandPrimary, textAlign: "center", fontFamily: fonts.display }}>{person.name}</Title>
                </Pressable>
              )) : null}
            </View>
          )}
        </Card>
      ))}
      <Button
        testID="find-save"
        title={phase === 1 ? "Zapisz odpowiedzi" : "Zapisz"}
        loading={busy}
        disabled={locked || prompts.length === 0}
        onPress={() => void save()}
      />
    </View>
  );
}

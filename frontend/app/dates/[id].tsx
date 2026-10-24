import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { Body, Button, Card, ErrorState, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { blockUser, report } from "@/src/lib/data";
import {
  contactStatusLabel,
  datingListing,
  datingProfile,
  deleteDating,
  expressDating,
  formatLabel,
  genderLabel,
  goalLabel,
  kidsLabel,
  listingStatusLabel,
  modelLabel,
  seekingLabel,
  passDating,
  setDatingStatus,
  type DatingListing,
} from "@/src/lib/dating";
import { radius, spacing, useTheme } from "@/src/theme";

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <View>
      <Body muted>{label}</Body>
      <Body>{value?.trim() ? value : "Nie podano"}</Body>
    </View>
  );
}

export default function DatingListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [row, setRow] = useState<DatingListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await datingListing(id);
      if (next.mine) {
        const me = await datingProfile().catch(() => null);
        if (me) {
          next.person = {
            ...next.person,
            bio: next.person.bio || me.bio,
            goal: next.person.goal || me.goal,
            gender: next.person.gender || me.gender,
            seeking_gender: next.person.seeking_gender ?? me.seeking_gender,
            age_min: next.person.age_min ?? me.age_min,
            age_max: next.person.age_max ?? me.age_max,
            kids: next.person.kids ?? me.kids,
            relationship_model: next.person.relationship_model ?? me.relationship_model,
            about: next.person.about ?? me.about,
          };
        }
      }
      setRow(next);
      setError(null);
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

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Randka" /><ErrorState message={error} onRetry={load} /></View>;
  if (!row) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Randka" /><Loading /></View>;
  const person = row.person;

  return (
    <View testID="dating-listing-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={person.display_name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}>
        <Image source={{ uri: person.photo_url }} style={{ width: "100%", height: 420, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }} contentFit="contain" />
        <Title size={22} style={{ textAlign: "center" }}>{person.display_name}, {person.age}</Title>
        {person.distance_label ? <Body muted style={{ textAlign: "center" }}>{person.distance_label}</Body> : null}
        <Fact label="Typ spotkania" value={formatLabel(row.format)} />
        <Fact label="Zaproszenie" value={row.blurb} />
        <Fact label="Kiedy pasuje" value={row.time_window} />
        <Fact label="O sobie" value={person.bio} />
        <Fact label="Płeć" value={genderLabel(person.gender)} />
        <Fact label="Cel związku" value={goalLabel(person.goal)} />
        <Fact label="Kogo szuka" value={person.age_min != null ? `${seekingLabel(person.seeking_gender) || "Nie podano"}, ${person.age_min}–${person.age_max} lat` : seekingLabel(person.seeking_gender)} />
        <Fact label="Dzieci" value={kidsLabel(person.kids)} />
        <Fact label="Jakiego związku oczekuje" value={modelLabel(person.relationship_model)} />
        <Fact label="Co warto wiedzieć" value={person.about} />
        {row.mine ? (
          <>
            <Body>Status: {listingStatusLabel[row.status] ?? row.status}</Body>
            <Button testID="dating-edit" title="Edytuj ogłoszenie" variant="secondary" onPress={() => router.push(`/dates/new?id=${row.id}`)} />
            <Button testID="dating-pause" title={row.status === "active" ? "Wstrzymaj" : "Wznów"} variant="secondary" loading={busy} onPress={() => run(() => setDatingStatus(row.id, row.status === "active" ? "paused" : "active"), "Status zapisany")} />
            <Button testID="dating-delete" title="Usuń ogłoszenie" variant="danger" loading={busy} onPress={() => run(async () => { await deleteDating(row.id); router.back(); }, "Ogłoszenie usunięte")} />
            <Title size={20}>Zgłoszenia</Title>
            {(row.interests ?? []).length === 0 ? <Body muted>Nikt jeszcze nie napisał, że chce Cię poznać.</Body> : (row.interests ?? []).map((item) => (
              <Card key={item.id} testID={`dating-interest-${item.id}`}>
                <Body>{item.person.display_name}, {item.person.age}</Body>
                <Body muted>{contactStatusLabel[item.status] ?? item.status}</Body>
                <Button testID={`dating-interest-open-${item.id}`} title="Otwórz kontakt" variant="secondary" onPress={() => router.push(`/dates/contact/${item.id}`)} />
              </Card>
            ))}
          </>
        ) : (
          <>
            <Button testID="dating-interest" title="Chcę poznać tę osobę" loading={busy} onPress={() => run(async () => {
              const interest = await expressDating(row.id);
              router.push(`/dates/contact/${interest}`);
            }, "Zgłoszenie wysłane")} />
            <Button testID="dating-pass" title="Nie tym razem" variant="ghost" onPress={() => run(async () => { await passDating(row.id); router.back(); }, "Ukryte z Twojej tablicy")} />
            <Button testID="dating-block" title="Zablokuj" variant="danger" onPress={() => run(() => blockUser(person.user_id), "Osoba zablokowana")} />
            <Button testID="dating-report" title="Zgłoś" variant="ghost" onPress={() => run(() => report("profile", person.user_id, "dating"), "Zgłoszenie zapisane")} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

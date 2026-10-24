import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  contactStatusLabel,
  datingBoard,
  datingProfile,
  formatLabel,
  goalLabel,
  kidsLabel,
  modelLabel,
  seekingLabel,
  listingStatusLabel,
  myDatingContacts,
  myDatingListings,
  type DatingCard,
  type DatingContactRow,
  type DatingMine,
  type DatingProfile,
} from "@/src/lib/dating";
import { usesNativeTabs } from "@/src/navigation";
import { radius, spacing, useTheme } from "@/src/theme";

type Pane = "discover" | "mine" | "contacts" | "profile";

export default function DatesTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const bottom = usesNativeTabs ? insets.bottom : 0;
  const [pane, setPane] = useState<Pane>("discover");
  const [profile, setProfile] = useState<DatingProfile | null | undefined>(undefined);
  const [cards, setCards] = useState<DatingCard[] | null>(null);
  const [mine, setMine] = useState<DatingMine[] | null>(null);
  const [contacts, setContacts] = useState<DatingContactRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await datingProfile();
      setProfile(me);
      if (!me) {
        setCards([]);
        setMine([]);
        setContacts([]);
        setError(null);
        return;
      }
      const [board, listings, people] = await Promise.all([
        datingBoard(null, null),
        myDatingListings(),
        myDatingContacts(),
      ]);
      setCards(board ?? []);
      setMine(listings ?? []);
      setContacts(people ?? []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const add = () => {
    if (!profile) router.push("/dates/profile?next=listing");
    else if ((mine ?? []).some((row) => row.status === "active")) toast("Masz już aktywne ogłoszenie. Wstrzymaj je w Moje ogłoszenia.", "error");
    else router.push("/dates/new");
  };

  return (
    <View testID="dates-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: bottom + spacing.xl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <Title size={32} testID="dates-title" style={{ textAlign: "center" }}>Randki</Title>
        <Body muted>Poznajecie się przy jedzeniu: ogłoszenie, kilka pytań i wspólny plan spotkania. Bez przeglądania zdjęć w nieskończoność.</Body>
        <Button testID="dates-add" title="Dodaj randkę" icon="plus" onPress={add} />
        <ChipRow testID="dates-panes">
          {([
            ["discover", "Odkrywaj"],
            ["mine", "Moje ogłoszenia"],
            ["contacts", "Moje randki"],
            ["profile", "Profil"],
          ] as const).map(([key, label]) => (
            <Chip key={key} testID={`dates-pane-${key}`} label={label} selected={pane === key} onPress={() => setPane(key)} />
          ))}
        </ChipRow>
        {error ? <ErrorState message={error} onRetry={load} /> : profile === undefined || cards === null ? <Loading /> : (
          <>
            {pane === "discover" ? (
              !profile ? (
                <EmptyState testID="dates-need-profile" icon="account-heart-outline" title="Najpierw profil" text="Żeby zobaczyć ogłoszenia w okolicy, uzupełnij profil randkowy. Musisz mieć ukończone 18 lat." action={<Button testID="dates-setup-profile" title="Uzupełnij profil" onPress={() => router.push("/dates/profile")} />} />
              ) : cards.length === 0 ? (
                <EmptyState testID="dates-empty-board" icon="food-variant" title="Brak ogłoszeń w okolicy" text="Nikt w Twoim zasięgu nie szuka teraz randki przy jedzeniu. Dodaj własne ogłoszenie albo poszerz wiek i dystans w profilu." action={<Button testID="dates-empty-add" title="Dodaj randkę" onPress={add} />} />
              ) : cards.map((card) => (
                <Card key={card.id} testID={`dates-card-${card.id}`}>
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <Image source={{ uri: card.person.photo_url }} style={{ width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }} contentFit="contain" />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Title size={18}>{card.person.display_name}, {card.person.age}</Title>
                      <Body muted>{card.person.distance_label} · {formatLabel(card.format)}</Body>
                      <Body numberOfLines={3}>{card.blurb}</Body>
                      <Body muted>{goalLabel(card.person.goal)}</Body>
                    </View>
                  </View>
                  <Button testID={`dates-more-${card.id}`} title="Więcej" variant="secondary" onPress={() => router.push(`/dates/${card.id}`)} />
                </Card>
              ))
            ) : null}
            {pane === "mine" ? (
              mine && mine.length ? mine.map((row) => (
                <Card key={row.id} testID={`dates-mine-${row.id}`}>
                  <Title size={18}>{formatLabel(row.format)}</Title>
                  <Body>{listingStatusLabel[row.status] ?? row.status}{row.pending ? ` · ${row.pending} nowych zgłoszeń` : ""}</Body>
                  <Body numberOfLines={3}>{row.blurb}</Body>
                  <Button testID={`dates-mine-open-${row.id}`} title="Otwórz" variant="secondary" onPress={() => router.push(`/dates/${row.id}`)} />
                </Card>
              )) : <EmptyState testID="dates-empty-mine" icon="calendar-plus" title="Nie masz ogłoszeń" text="Jedno aktywne zaproszenie na randkę przy jedzeniu wystarczy na start." />
            ) : null}
            {pane === "contacts" ? (
              contacts && contacts.length ? contacts.map((row) => (
                <Card key={row.id} testID={`dates-contact-${row.id}`}>
                  <Title size={18}>{row.person.display_name}</Title>
                  <Body muted>{contactStatusLabel[row.status] ?? row.status} · {formatLabel(row.format)}</Body>
                  <Button testID={`dates-contact-open-${row.id}`} title="Kontynuuj" variant="secondary" onPress={() => router.push(`/dates/contact/${row.id}`)} />
                </Card>
              )) : <EmptyState testID="dates-empty-contacts" icon="account-heart-outline" title="Brak kontaktów" text="Gdy ktoś przyjmie zgłoszenie, pytania i plan spotkania pojawią się tutaj." />
            ) : null}
            {pane === "profile" ? (
              profile ? (
                <View style={{ gap: spacing.md }}>
                  <Card testID="dates-profile-card">
                    <View style={{ flexDirection: "row", gap: spacing.md }}>
                      <Image source={{ uri: profile.photo_url }} style={{ width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }} contentFit="contain" />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Title size={18}>{profile.display_name}, {profile.age}</Title>
                        <Body muted>Do {profile.max_km} km · otwarte kontakty {profile.open_contacts}/3</Body>
                      </View>
                    </View>
                    <Body muted>O sobie</Body>
                    <Body>{profile.bio}</Body>
                    <Body muted>Cel związku</Body>
                    <Body>{goalLabel(profile.goal)}</Body>
                    <Body muted>Kogo szukam</Body>
                    <Body>{seekingLabel(profile.seeking_gender) || "Nie podano"}, {profile.age_min}–{profile.age_max} lat</Body>
                    <Body muted>Dzieci</Body>
                    <Body>{kidsLabel(profile.kids) || "Nie podano"}</Body>
                    <Body muted>Jakiego związku oczekuję</Body>
                    <Body>{modelLabel(profile.relationship_model) || "Nie podano"}</Body>
                    <Body muted>Co warto o mnie wiedzieć</Body>
                    <Body>{profile.about || "Nie podano"}</Body>
                    <Button testID="dates-edit-profile" title="Edytuj profil" variant="secondary" onPress={() => router.push("/dates/profile")} />
                  </Card>
                  <PlusTeaser />
                </View>
              ) : <EmptyState testID="dates-empty-profile" icon="account-heart-outline" title="Profil randkowy" text="Jedno zdjęcie, pseudonim i to, kogo chcesz poznać przy stole." action={<Button testID="dates-create-profile" title="Uzupełnij profil" onPress={() => router.push("/dates/profile")} />} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PlusTeaser() {
  const toast = useToast();
  const locked = (title: string) => toast(`${title} będzie w Yummeet+. W tej wersji nic nie zapisujemy.`, "info");
  return (
    <Card testID="dates-plus">
      <Title size={18}>Yummeet+</Title>
      <Body muted>Darmowa randka pokazuje smak: jedno ogłoszenie, 3 kontakty i krótkie pytania. Pełne testy i planer zostają na później.</Body>
      <Pressable testID="dates-plus-enneagram" onPress={() => locked("Archetyp charakteru")}>
        <Body>Archetyp charakteru — wkrótce</Body>
      </Pressable>
      <Pressable testID="dates-plus-attachment" onPress={() => locked("Styl przywiązania")}>
        <Body>Styl przywiązania — wkrótce</Body>
      </Pressable>
      <Pressable testID="dates-plus-love" onPress={() => locked("Języki miłości")}>
        <Body>Języki miłości — wkrótce</Body>
      </Pressable>
      <Pressable testID="dates-plus-basket" onPress={() => locked("Koszyk randki")}>
        <Body>Koszyk z kosztami i kafelki planera — wkrótce</Body>
      </Pressable>
    </Card>
  );
}

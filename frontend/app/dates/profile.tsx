import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Body, Button, Chip, ChipRow, Field, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  DATE_GOALS,
  GENDERS,
  KIDS,
  MODELS,
  SEEKING,
  datingProfile,
  saveDatingProfile,
} from "@/src/lib/dating";
import { getCurrentPosition } from "@/src/lib/location";
import { pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { radius, spacing, useTheme } from "@/src/theme";

export default function DatingProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState("woman");
  const [bio, setBio] = useState("");
  const [goal, setGoal] = useState("serious");
  const [seeking, setSeeking] = useState("any");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("45");
  const [km, setKm] = useState("30");
  const [about, setAbout] = useState("");
  const [kids, setKids] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    void datingProfile().then((row) => {
      if (!row) return;
      setPhoto(row.photo_url);
      setName(row.display_name);
      setBirth(String(row.birth_date).slice(0, 10));
      setGender(row.gender);
      setBio(row.bio);
      setGoal(row.goal === "slow" ? "serious" : row.goal);
      setSeeking(row.seeking_gender);
      setAgeMin(String(row.age_min));
      setAgeMax(String(row.age_max));
      setKm(String(row.max_km));
      setAbout(row.about ?? "");
      setKids(row.kids ?? "");
      setModel(row.relationship_model ?? "");
    }).catch((e) => toast(errorMessage(e), "error"));
  }, [toast]);

  const pick = async () => {
    if (!session?.user.id) return;
    try {
      const url = await pickPinPhoto(session.user.id, "gallery");
      if (url) setPhoto(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const here = await getCurrentPosition();
      if (!here) return toast("Włącz GPS — zapisujemy tylko przybliżoną okolicę, bez adresu.", "error");
      await saveDatingProfile({
        display_name: name,
        birth_date: birth,
        gender,
        bio,
        goal,
        seeking_gender: seeking,
        age_min: Number(ageMin) || 18,
        age_max: Number(ageMax) || 99,
        max_km: Number(km) || 30,
        photo_url: photo,
        area_label: null,
        lat: here.lat,
        lng: here.lng,
        about,
        kids: kids || null,
        relationship_model: model || null,
        show_extras: true,
      });
      toast("Profil randkowy zapisany", "success");
      if (next === "listing") router.replace("/dates/new");
      else router.back();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="dating-profile-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Profil randkowy" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Body muted>Wymagane do ogłoszenia: zdjęcie, pseudonim, data urodzenia (18+), płeć, krótki opis, cel i kogo szukasz.</Body>
        {photo ? <Image source={{ uri: photo }} style={{ width: "100%", height: 360, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }} contentFit="contain" /> : null}
        <Button testID="dating-photo" title={photo ? "Zmień zdjęcie" : "Dodaj zdjęcie"} icon="image" variant="secondary" onPress={pick} />
        <Field testID="dating-name" label="Imię lub pseudonim" value={name} onChangeText={setName} />
        <Field testID="dating-birth" label="Data urodzenia (RRRR-MM-DD)" value={birth} onChangeText={setBirth} placeholder="1996-04-12" />
        <Body>Płeć</Body>
        <ChipRow testID="dating-gender">{GENDERS.map((g) => <Chip key={g.key} testID={`dating-gender-${g.key}`} label={g.label} selected={gender === g.key} onPress={() => setGender(g.key)} />)}</ChipRow>
        <Field testID="dating-bio" label="Krótko o sobie" value={bio} onChangeText={setBio} multiline />
        <Body>Cel</Body>
        <ChipRow testID="dating-goal">{DATE_GOALS.map((g) => <Chip key={g.key} testID={`dating-goal-${g.key}`} label={g.label} selected={goal === g.key} onPress={() => setGoal(g.key)} />)}</ChipRow>
        <Body>Kogo chcesz poznać</Body>
        <ChipRow testID="dating-seeking">{SEEKING.map((g) => <Chip key={g.key} testID={`dating-seeking-${g.key}`} label={g.label} selected={seeking === g.key} onPress={() => setSeeking(g.key)} />)}</ChipRow>
        <Field testID="dating-age-min" label="Wiek od" value={ageMin} onChangeText={setAgeMin} keyboardType="number-pad" />
        <Field testID="dating-age-max" label="Wiek do" value={ageMax} onChangeText={setAgeMax} keyboardType="number-pad" />
        <Field testID="dating-km" label="Maksymalny dystans (1–50 km)" value={km} onChangeText={setKm} keyboardType="number-pad" />
        <Field testID="dating-about" label="Co warto o mnie wiedzieć? (opcjonalnie)" value={about} onChangeText={setAbout} multiline />
        <Body>Dzieci (opcjonalnie)</Body>
        <ChipRow testID="dating-kids">{KIDS.map((g) => <Chip key={g.key} testID={`dating-kids-${g.key}`} label={g.label} selected={kids === g.key} onPress={() => setKids(kids === g.key ? "" : g.key)} />)}</ChipRow>
        <Body>Model relacji (opcjonalnie)</Body>
        <ChipRow testID="dating-model">{MODELS.map((g) => <Chip key={g.key} testID={`dating-model-${g.key}`} label={g.label} selected={model === g.key} onPress={() => setModel(model === g.key ? "" : g.key)} />)}</ChipRow>
        <Button testID="dating-save-profile" title="Zapisz profil" loading={busy} onPress={save} />
      </KeyboardAwareScrollView>
    </View>
  );
}

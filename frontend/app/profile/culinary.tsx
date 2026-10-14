import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Chip, ChipRow, Field, Header, Title, haptic, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  COLLAB_FORMS, CULINARY_LEVELS, DIET_STYLES, PAID_COOKING_CONSENTS, SPICE_LABELS, SUPERPOWERS, SUPERPOWERS_HINT,
} from "@/src/lib/culinaryProfile";
import { updateMyProfile } from "@/src/lib/data";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

export default function CulinaryProfile() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const [signature, setSignature] = useState(profile?.signature_dish ?? "");
  const [favCuisine, setFavCuisine] = useState(profile?.favorite_cuisine ?? "");
  const [skill, setSkill] = useState<number | null>(profile?.culinary_skill_level ?? null);
  const [diet, setDiet] = useState<string | null>(profile?.diet_style ?? null);
  const [spice, setSpice] = useState<string | null>(profile?.spice_tolerance_label ?? null);
  const [powers, setPowers] = useState<string[]>(profile?.superpowers ?? []);
  const [customPower, setCustomPower] = useState("");
  const [collab, setCollab] = useState<string[]>(profile?.collab_forms ?? []);
  const [consents, setConsents] = useState<boolean[]>([false, false, false]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSignature(profile?.signature_dish ?? "");
    setFavCuisine(profile?.favorite_cuisine ?? "");
    setSkill(profile?.culinary_skill_level ?? null);
    setDiet(profile?.diet_style ?? null);
    setSpice(profile?.spice_tolerance_label ?? null);
    setPowers(profile?.superpowers ?? []);
    setCollab(profile?.collab_forms ?? []);
  }, [profile]);

  const powerOptions = useMemo(() => {
    const extras = powers.filter((p) => !(SUPERPOWERS as readonly string[]).includes(p));
    return [...SUPERPOWERS, ...extras];
  }, [powers]);

  const selectedLevel = skill != null ? CULINARY_LEVELS.find((l) => l.level === skill) : null;
  const selectedDiet = diet ? DIET_STYLES.find((d) => d.key === diet) : null;
  const selectedSpice = spice ? SPICE_LABELS.find((s) => s.key === spice) : null;

  const togglePower = (p: string) => {
    setPowers((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : prev.length >= 3 ? prev : [...prev, p]));
  };

  const addCustomPower = () => {
    const tag = customPower.trim().replace(/\s+/g, " ");
    if (tag.length < 2) return toast("Wpisz nazwę supermocy (min. 2 znaki)", "error");
    if (tag.length > 40) return toast("Tag max 40 znaków", "error");
    if (powers.includes(tag)) return toast("Ten tag już jest wybrany", "info");
    if (powers.length >= 3) return toast("Max 3 supermoce", "error");
    setPowers((prev) => [...prev, tag]);
    setCustomPower("");
  };

  const toggleCollab = (k: string) => {
    const paid = k === "cook_order" || k === "cook_ingredients";
    if (paid && !collab.includes(k) && !consents.every(Boolean)) {
      toast("Najpierw zaakceptuj oświadczenia sanitarno-prawne poniżej.", "info");
      return;
    }
    setCollab((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const save = async () => {
    const wantsPaid = collab.some((c) => c === "cook_order" || c === "cook_ingredients");
    if (wantsPaid && !consents.every(Boolean)) {
      return toast("Aby włączyć gotowanie odpłatne / za składniki, zaznacz wszystkie oświadczenia.", "error");
    }
    setBusy(true);
    try {
      await updateMyProfile({
        signature_dish: signature.trim() || null,
        favorite_cuisine: favCuisine.trim() || null,
        culinary_skill_level: skill,
        diet_style: diet,
        spice_tolerance_label: spice,
        superpowers: powers,
        collab_forms: collab,
        cooking_paid_enabled: wantsPaid,
        cooking_legal_consents: wantsPaid
          ? { sanepid: consents[0], liability: consents[1], taxes: consents[2], at: new Date().toISOString() }
          : profile?.cooking_legal_consents ?? {},
      } as any);
      await refreshProfile();
      toast("Profil kulinarny zapisany", "success");
      router.back();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="culinary-profile-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Profil kulinarny" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Field testID="culinary-signature" label="Najsmaczniejsze / najtrudniejsze danie" value={signature} onChangeText={setSignature} multiline placeholder="np. szarpana wieprzowina BBQ…" />
        <Field testID="culinary-fav" label="Ulubiony typ kuchni" value={favCuisine} onChangeText={setFavCuisine} />

        <Title size={16}>Poziom umiejętności</Title>
        {CULINARY_LEVELS.map((l) => (
          <Chip
            key={l.level}
            testID={`culinary-level-${l.level}`}
            label={`${l.emoji} Poziom ${l.level}: ${l.title}${"subtitle" in l && l.subtitle ? ` (${l.subtitle})` : ""}`}
            selected={skill === l.level}
            onPress={() => setSkill(l.level)}
          />
        ))}
        {selectedLevel ? (
          <View style={{ gap: spacing.xs }}>
            <Body>{selectedLevel.description}</Body>
            <Body muted>Dla kogo: {selectedLevel.forWhom}</Body>
          </View>
        ) : null}

        <Title size={16}>Kulinarna religia (dieta)</Title>
        <ChipRow>
          {DIET_STYLES.map((d) => (
            <Chip key={d.key} testID={`culinary-diet-${d.key}`} label={d.label} selected={diet === d.key} onPress={() => setDiet(d.key)} />
          ))}
        </ChipRow>
        {selectedDiet ? <Body muted>{selectedDiet.blurb}</Body> : null}

        <Title size={16}>Tolerancja na ostrość</Title>
        <ChipRow>
          {SPICE_LABELS.map((s) => (
            <Chip key={s.key} testID={`culinary-spice-${s.key}`} label={s.label} selected={spice === s.key} onPress={() => setSpice(s.key)} />
          ))}
        </ChipRow>
        {selectedSpice ? <Body muted>{selectedSpice.blurb}</Body> : null}

        <Title size={16}>Supermoce (max 3)</Title>
        <Body muted>{SUPERPOWERS_HINT}</Body>
        <ChipRow>
          {powerOptions.map((p) => (
            <Chip key={p} testID={`culinary-power-${p}`} label={p} selected={powers.includes(p)} onPress={() => togglePower(p)} />
          ))}
        </ChipRow>
        <Field
          testID="culinary-power-custom"
          label="Własny tag supermocy"
          value={customPower}
          onChangeText={setCustomPower}
          placeholder="np. ekspert od zup"
          onSubmitEditing={addCustomPower}
        />
        <Button testID="culinary-power-add" title="Dodaj własny tag" variant="secondary" onPress={addCustomPower} />

        <Title size={16}>Formy współpracy</Title>
        <ChipRow>
          {COLLAB_FORMS.map((c) => (
            <Chip key={c.key} testID={`culinary-collab-${c.key}`} label={c.label} selected={collab.includes(c.key)} onPress={() => toggleCollab(c.key)} />
          ))}
        </ChipRow>

        <Title size={16}>Oświadczenia (gotowanie odpłatne / za składniki)</Title>
        <Body muted>Aplikacja nie pośredniczy w płatnościach i nie jest sprzedawcą żywności. Przeczytaj pełny tekst i zaznacz każde oświadczenie:</Body>
        {PAID_COOKING_CONSENTS.map((text, i) => (
          <Pressable
            key={i}
            testID={`culinary-consent-${i}`}
            onPress={() => { haptic.tap(); setConsents((prev) => prev.map((v, j) => (j === i ? !v : v))); }}
            style={{
              flexDirection: "row", gap: spacing.md, alignItems: "flex-start",
              padding: spacing.md, borderRadius: 12,
              backgroundColor: consents[i] ? colors.brandPrimary + "22" : colors.surfaceSecondary,
              borderWidth: 1, borderColor: consents[i] ? colors.brandPrimary : colors.border,
            }}
          >
            <Icon name={consents[i] ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={consents[i] ? colors.brandPrimary : colors.muted} />
            <Body style={{ flex: 1 }}>{text}</Body>
          </Pressable>
        ))}

        <Button testID="culinary-save" title="Zapisz" loading={busy} onPress={() => void save()} />
      </KeyboardAwareScrollView>
    </View>
  );
}

import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Title, haptic } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";
import { radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "./Icon";

export const TUTORIAL_KEY = "yummeet.tutorial.mvp.v1";

const STEPS = [
  {
    icon: "map-search",
    title: "Odkrywaj lokale",
    text: "Na mapie znajdziesz restauracje jako duże łezki — jak pinezki Google Maps. Kolor i znaczek zależą od kuchni: pizza, sushi, kebab i reszta wyglądają inaczej, więc od razu wiesz, co jest w okolicy.",
  },
  {
    icon: "account-group",
    title: "Spotkanie",
    text: "Zakładka Spotkanie to otwarte stoły i wydarzenia. Dołącz, poznaj ludzi przy jedzeniu i po spotkaniu oceń organizatora gwiazdkami — tak samo jak lokale.",
  },
  {
    icon: "map-marker-path",
    title: "Gastro-Trasa",
    text: "Ustal trasę przejazdu i odkryj miejsca po drodze, w których mógłbyś zjeść. Wybierz start i cel, a Yummeet pokaże knajpy w Twoim promieniu.",
  },
  {
    icon: "chat-processing",
    title: "Czat i profil z boku",
    text: "Ikonki czatu i profilu pływają z prawej strony na każdym ekranie. Stuknij dymka, żeby pisać, albo awatar, żeby wejść w swoją kartę postaci.",
  },
] as const;

export async function markTutorialSeen() {
  await storage.setItem(TUTORIAL_KEY, true);
}

let replayTutorial: (() => void) | null = null;
export function openTutorial() {
  replayTutorial?.();
}

export function AppTutorial({ force, autoStart = false, onClose }: { force?: boolean; autoStart?: boolean; onClose?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    replayTutorial = () => { setStep(0); setOpen(true); };
    if (force) {
      setStep(0);
      setOpen(true);
      return () => { replayTutorial = null; };
    }
    if (!autoStart) return () => { replayTutorial = null; };
    let alive = true;
    storage.getItem(TUTORIAL_KEY, false).then((seen) => {
      if (alive && !seen) setOpen(true);
    });
    return () => { alive = false; replayTutorial = null; };
  }, [force, autoStart]);

  const close = async () => {
    haptic.success();
    await markTutorialSeen();
    setOpen(false);
    onClose?.();
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { void close(); }}>
      <View testID="app-tutorial" style={{ flex: 1, backgroundColor: "rgba(44,37,32,0.55)", justifyContent: "flex-end", paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <Icon name={current.icon} size={32} color={colors.onBrandTertiary} />
          </View>
          <Title size={24} testID="tutorial-title">{current.title}</Title>
          <Body testID="tutorial-body">{current.text}</Body>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {STEPS.map((_, i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.brandPrimary : colors.border }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {step > 0 ? (
              <Button testID="tutorial-back" title="Wstecz" variant="ghost" onPress={() => { haptic.tap(); setStep((s) => s - 1); }} />
            ) : (
              <Pressable testID="tutorial-skip" onPress={() => { void close(); }} style={{ justifyContent: "center", paddingHorizontal: spacing.md }}>
                <Body muted>Pomiń</Body>
              </Pressable>
            )}
            <Button
              testID="tutorial-next"
              title={last ? "Zaczynamy" : "Dalej"}
              style={{ flex: 1 }}
              onPress={() => {
                if (last) void close();
                else { haptic.tap(); setStep((s) => s + 1); }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

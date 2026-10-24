import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Body, Button, Chip, ChipRow, Field, Header, Loading, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { FOOD_FORMATS, datingListing, datingProfile, formatLabel, publishDating, updateDating, type DatingProfile } from "@/src/lib/dating";
import { radius, spacing, useTheme } from "@/src/theme";

export default function NewDateListing() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [me, setMe] = useState<DatingProfile | null>(null);
  const [format, setFormat] = useState("dinner");
  const [blurb, setBlurb] = useState("");
  const [area, setArea] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void datingProfile().then((row) => {
      if (!row) {
        router.replace("/dates/profile?next=listing");
        return;
      }
      setMe(row);
      if (!id) setArea(row.area_label ?? "");
    }).catch((e) => toast(errorMessage(e), "error"));
    if (!id) return;
    void datingListing(id).then((listing) => {
      if (!listing.mine) return;
      setBlurb(listing.blurb);
      setFormat(FOOD_FORMATS.some((f) => f.key === listing.format) ? listing.format : "dinner");
      setArea(listing.area_label ?? "");
      setWhen(listing.time_window ?? "");
    }).catch((e) => toast(errorMessage(e), "error"));
  }, [id, router, toast]);

  const publish = async () => {
    setBusy(true);
    try {
      const payload = { blurb, format, area_label: area, time_window: when };
      if (id) {
        await updateDating(id, payload);
        toast("Ogłoszenie zapisane", "success");
        router.replace(`/dates/${id}`);
        return;
      }
      const created = await publishDating(payload);
      toast("Ogłoszenie jest na tablicy", "success");
      router.replace(`/dates/${created}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Nowa randka" /><Loading /></View>;

  return (
    <View testID="dating-new-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={id ? "Edytuj ogłoszenie" : "Nowa randka"} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}>
        <Body muted>To zaproszenie, nie rezerwacja stolika. Dokładną datę i lokal ustalicie dopiero, gdy oboje będziecie chcieli się spotkać.</Body>
        <Image source={{ uri: me.photo_url }} style={{ width: "100%", height: 320, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }} contentFit="contain" />
        <Body>{me.display_name}, {me.age}</Body>
        <Button testID="dating-new-edit-profile" title="Edytuj profil" variant="ghost" onPress={() => router.push("/dates/profile")} />
        <Body>Charakter spotkania</Body>
        <ChipRow testID="dating-format">{FOOD_FORMATS.map((f) => <Chip key={f.key} testID={`dating-format-${f.key}`} label={f.label} selected={format === f.key} onPress={() => setFormat(f.key)} />)}</ChipRow>
        <Body muted>Wybrane: {formatLabel(format)}</Body>
        <Field testID="dating-blurb" label="Zaproszenie" value={blurb} onChangeText={setBlurb} multiline placeholder="Np. kolacja bez pośpiechu, mogę przynieść deser." />
        <Field testID="dating-new-area" label="Okolica spotkania" value={area} onChangeText={setArea} />
        <Field testID="dating-window" label="Kiedy Ci pasuje (opcjonalnie)" value={when} onChangeText={setWhen} placeholder="np. wieczory w tygodniu" />
        <Button testID="dating-publish" title={id ? "Zapisz zmiany" : "Opublikuj"} loading={busy} onPress={publish} />
      </KeyboardAwareScrollView>
    </View>
  );
}

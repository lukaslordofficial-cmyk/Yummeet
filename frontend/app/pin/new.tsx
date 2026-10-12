import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Chip, ChipRow, Field, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
import { createPin, invalidatePins } from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { radius, spacing, useTheme } from "@/src/theme";

export default function NewPin() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const [pos, setPos] = useState({ lat: 52.2297, lng: 21.0122 });
  const [mapCenter, setMapCenter] = useState(pos);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const locate = async () => {
    const p = await getCurrentPosition();
    if (!p) return toast("Włącz GPS, żeby ustawić pin na Twojej lokalizacji.", "info");
    setPos(p);
    setMapCenter(p);
  };

  const addPhoto = async (source: "gallery" | "camera") => {
    const uid = session?.user.id;
    if (!uid) return toast("Zaloguj się ponownie", "error");
    setPhotoBusy(true);
    try {
      const url = await pickPinPhoto(uid, source);
      if (url) setCoverUrl(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (title.trim().length < 2) return toast("Podaj nazwę lokalu", "error");
    setBusy(true);
    try {
      let id: string;
      try {
        id = await createPin({ title, lat: pos.lat, lng: pos.lng, description, cuisine, city, price, coverUrl });
      } catch {
        id = await createPin({ title, lat: pos.lat, lng: pos.lng, description, cuisine, city, price });
        if (coverUrl) {
          const { supabase } = await import("@/src/lib/supabase");
          await supabase.from("pins").update({ cover_url: coverUrl }).eq("id", id);
        }
      }
      invalidatePins();
      toast("Pin dodany!", "success");
      router.replace(`/pin/${id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="new-pin-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Nowy pin" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <View style={{ height: 260, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden" }}>
          <AppMapView center={mapCenter} zoom={14} pickMode onMapPress={(lat, lng) => setPos({ lat, lng })} />
        </View>
        <Body muted style={{ marginHorizontal: spacing.lg }} testID="new-pin-coords">
          Stuknij mapę · {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
        </Body>
        <Button testID="new-pin-gps" title="Ustaw na GPS" icon="crosshairs-gps" variant="ghost" onPress={() => void locate()} style={{ marginHorizontal: spacing.lg }} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-pin-title-input" label="Nazwa lokalu" value={title} onChangeText={setTitle} />
          <Field testID="new-pin-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 90 }} />
          <Field testID="new-pin-city-input" label="Miasto" value={city} onChangeText={setCity} />
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={{ width: "100%", height: 180, borderRadius: radius.md }} contentFit="cover" />
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="new-pin-photo-camera" title="Zrób zdjęcie" icon="camera" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addPhoto("camera")} />
            <Button testID="new-pin-photo-gallery" title="Galeria" icon="image" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addPhoto("gallery")} />
          </View>
        </View>
        <ChipRow>{CUISINES.filter((c) => c.key).map((c) => <Chip key={c.label} testID={`new-pin-cuisine-${c.key}`} label={c.label} selected={cuisine === c.key} onPress={() => setCuisine(c.key)} />)}</ChipRow>
        <ChipRow>{[1, 2, 3, 4].map((p) => <Chip key={p} testID={`new-pin-price-${p}`} label={"zł".repeat(p)} selected={price === p} onPress={() => setPrice(p)} />)}</ChipRow>
        <Button testID="new-pin-save-button" title="Opublikuj pin" loading={busy} onPress={() => void save()} style={{ marginHorizontal: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

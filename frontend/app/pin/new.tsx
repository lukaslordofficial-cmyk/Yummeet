import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Chip, ChipRow, Field, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
import { createPin, findNearbyPin, invalidatePins, type NearbyPin } from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { reverseGeocode } from "@/src/lib/routing";
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
  const [followToken, setFollowToken] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nearby, setNearby] = useState<NearbyPin | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const hit = await findNearbyPin(pos.lat, pos.lng, 40);
      if (!alive) return;
      setNearby(hit);
      const rev = await reverseGeocode(pos.lat, pos.lng, "pl");
      if (!alive || !rev) return;
      if (!city && rev.city) setCity(rev.city);
      if (!address && rev.street) setAddress(rev.title);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.lat, pos.lng]);

  const locate = async () => {
    const p = await getCurrentPosition();
    if (!p) return toast("Włącz GPS, żeby ustawić pin na Twojej lokalizacji.", "info");
    setPos(p);
    setMapCenter(p);
    setFollowToken(Date.now());
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
    if (nearby) {
      toast(`Nie możesz dodać tego pinu — „${nearby.title}” jest już na mapie. Możesz dodać ocenę.`, "error");
      return;
    }
    setBusy(true);
    try {
      let id: string;
      try {
        id = await createPin({ title, lat: pos.lat, lng: pos.lng, description, cuisine, city, price, coverUrl, address });
      } catch (e) {
        const msg = errorMessage(e);
        if (/już na mapie|pin_already_exists/i.test(msg)) throw e;
        id = await createPin({ title, lat: pos.lat, lng: pos.lng, description, cuisine, city, price, address });
        if (coverUrl) {
          const { supabase } = await import("@/src/lib/supabase");
          await supabase.from("pins").update({ cover_url: coverUrl }).eq("id", id);
        }
      }
      invalidatePins();
      toast("Pin dodany! Współrzędne są zablokowane na mapie.", "success");
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
          <AppMapView
            center={mapCenter}
            zoom={14}
            pickMode
            followCenterToken={followToken}
            onMapPress={(lat, lng) => setPos({ lat, lng })}
          />
        </View>
        <Body muted style={{ marginHorizontal: spacing.lg }} testID="new-pin-coords">
          Współrzędne (zaklepane po publikacji): {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
        </Body>
        {nearby ? (
          <View style={{ marginHorizontal: spacing.lg, gap: spacing.sm }}>
            <Body testID="new-pin-duplicate-warning">
              Ten punkt jest już zajęty przez „{nearby.title}”. Nie dodasz drugiego pinu — możesz zostawić ocenę.
            </Body>
            <Button testID="new-pin-go-existing" title="Otwórz istniejący lokal" onPress={() => router.push(`/pin/${nearby.id}`)} />
          </View>
        ) : null}
        <Button testID="new-pin-gps" title="Moja lokalizacja" icon="crosshairs-gps" variant="ghost" onPress={() => void locate()} style={{ marginHorizontal: spacing.lg }} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-pin-title-input" label="Nazwa lokalu" value={title} onChangeText={setTitle} />
          <Field testID="new-pin-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 90 }} />
          <Field testID="new-pin-city-input" label="Miasto" value={city} onChangeText={setCity} />
          <Field testID="new-pin-address-input" label="Adres (kraj — miasto — ulica)" value={address} onChangeText={setAddress} />
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
        <Button testID="new-pin-save-button" title="Opublikuj pin" loading={busy} disabled={!!nearby} onPress={() => void save()} style={{ marginHorizontal: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

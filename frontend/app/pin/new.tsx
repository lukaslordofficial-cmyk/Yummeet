import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  const params = useLocalSearchParams<{ lat?: string; lng?: string; zoom?: string }>();

  const initial = useMemo(() => {
    const lat = params.lat ? Number(params.lat) : NaN;
    const lng = params.lng ? Number(params.lng) : NaN;
    const zoom = params.zoom ? Number(params.zoom) : 14;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, zoom: Number.isFinite(zoom) ? zoom : 14, fromMap: true };
    return { lat: 52.2297, lng: 21.0122, zoom: 14, fromMap: false };
  }, [params.lat, params.lng, params.zoom]);

  const [pos, setPos] = useState({ lat: initial.lat, lng: initial.lng });
  const [mapCenter, setMapCenter] = useState({ lat: initial.lat, lng: initial.lng });
  const [followToken, setFollowToken] = useState(initial.fromMap ? Date.now() : 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nearby, setNearby] = useState<NearbyPin | null>(null);
  const [placed, setPlaced] = useState(initial.fromMap);

  useEffect(() => {
    if (!placed) {
      setNearby(null);
      return;
    }
    let alive = true;
    (async () => {
      const hit = await findNearbyPin(pos.lat, pos.lng, 40);
      if (alive) setNearby(hit);
    })();
    return () => {
      alive = false;
    };
  }, [pos.lat, pos.lng, placed]);

  const fillAddress = async (lat: number, lng: number) => {
    const rev = await reverseGeocode(lat, lng, "pl");
    if (!rev) return;
    if (rev.city) setCity(rev.city);
    setAddress(rev.title);
  };

  const onMapPress = (lat: number, lng: number) => {
    setPos({ lat, lng });
    setPlaced(true);
    void fillAddress(lat, lng);
  };

  const locate = async () => {
    const p = await getCurrentPosition();
    if (!p) return toast("Włącz GPS, żeby dodać lokal w Twojej lokalizacji.", "info");
    setPos(p);
    setMapCenter(p);
    setFollowToken(Date.now());
    setPlaced(true);
    try {
      await fillAddress(p.lat, p.lng);
      toast("Uzupełniono adres z GPS", "success");
    } catch {
      /* ignore */
    }
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
    if (!placed) return toast("Wskaż lokalizację na mapie lub użyj „Dodaj Lokal”.", "error");
    if (nearby) {
      toast(`Nie możesz dodać tego pinu — „${nearby.title}” jest już na mapie. Możesz dodać ocenę.`, "error");
      return;
    }
    setBusy(true);
    try {
      let id: string;
      try {
        id = await createPin({ title, lat: pos.lat, lng: pos.lng, description, cuisine, city, coverUrl, address });
      } catch (e) {
        const msg = errorMessage(e);
        if (/już na mapie|pin_already_exists/i.test(msg)) throw e;
        id = await createPin({ title, lat: pos.lat, lng: pos.lng, description, cuisine, city, address });
        if (coverUrl) {
          const { supabase } = await import("@/src/lib/supabase");
          await supabase.from("pins").update({ cover_url: coverUrl }).eq("id", id);
        }
      }
      invalidatePins();
      toast("Pin dodany! Współrzędne są zablokowane.", "success");
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
            zoom={initial.zoom}
            pickMode
            followCenterToken={followToken}
            onMapPress={onMapPress}
          />
        </View>
        <Body muted style={{ marginHorizontal: spacing.lg }} testID="new-pin-coords">
          {placed ? `Współrzędne: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : "Przesuń pinezkę / stuknij mapę albo „Dodaj Lokal”."}
        </Body>
        {nearby ? (
          <View style={{ marginHorizontal: spacing.lg, gap: spacing.sm }}>
            <Body testID="new-pin-duplicate-warning">
              Ten punkt jest już zajęty przez „{nearby.title}”. Możesz zostawić ocenę.
            </Body>
            <Button testID="new-pin-go-existing" title="Otwórz istniejący lokal" onPress={() => router.push(`/pin/${nearby.id}`)} />
          </View>
        ) : null}
        <Button testID="new-pin-gps" title="Dodaj Lokal" icon="crosshairs-gps" variant="ghost" onPress={() => void locate()} style={{ marginHorizontal: spacing.lg }} />
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
        <Button testID="new-pin-save-button" title="Opublikuj pin" loading={busy} disabled={!!nearby || !placed} onPress={() => void save()} style={{ marginHorizontal: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

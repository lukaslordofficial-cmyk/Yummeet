import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { PinCategoryFields } from "@/src/components/PinCategoryFields";
import { Body, Button, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { createPin, findNearbyPin, invalidatePins, updatePin, type NearbyPin } from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { reverseGeocode } from "@/src/lib/routing";
import { pickMenuPdf, pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { radius, spacing, useTheme } from "@/src/theme";

export default function NewPin() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [followToken, setFollowToken] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [menuPhoto, setMenuPhoto] = useState<string | null>(null);
  const [menuPdf, setMenuPdf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nearby, setNearby] = useState<NearbyPin | null>(null);

  useEffect(() => {
    if (!pos) { setNearby(null); return; }
    let alive = true;
    findNearbyPin(pos.lat, pos.lng, 40).then((hit) => { if (alive) setNearby(hit); });
    return () => { alive = false; };
  }, [pos?.lat, pos?.lng]);

  const locate = async () => {
    const p = await getCurrentPosition();
    if (!p) return toast("Musisz być na miejscu z włączonym GPS — kliknij „Dodaj Lokal”.", "info");
    setPos(p);
    setFollowToken(Date.now());
    try {
      const rev = await reverseGeocode(p.lat, p.lng, "pl");
      if (rev?.city) setCity(rev.city);
      if (rev?.title) setAddress(rev.title);
      toast("Lokalizacja z GPS ustawiona", "success");
    } catch { /* ignore */ }
  };

  const addCover = async (source: "gallery" | "camera") => {
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

  const addMenuPhoto = async (source: "gallery" | "camera") => {
    const uid = session?.user.id;
    if (!uid) return toast("Zaloguj się ponownie", "error");
    setPhotoBusy(true);
    try {
      const url = await pickPinPhoto(uid, source);
      if (url) setMenuPhoto(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const addMenuPdf = async () => {
    const uid = session?.user.id;
    if (!uid) return toast("Zaloguj się ponownie", "error");
    setPhotoBusy(true);
    try {
      const url = await pickMenuPdf(uid);
      if (url) setMenuPdf(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (title.trim().length < 2) return toast("Podaj nazwę lokalu", "error");
    if (!pos) return toast("Najpierw kliknij „Dodaj Lokal”.", "error");
    if (nearby) return toast(`„${nearby.title}” jest już na mapie.`, "error");
    const pMin = priceMin.trim() ? Number(priceMin) : null;
    const pMax = priceMax.trim() ? Number(priceMax) : null;
    if ((pMin != null && !Number.isFinite(pMin)) || (pMax != null && !Number.isFinite(pMax))) {
      return toast("Ceny muszą być liczbami", "error");
    }
    if (pMin != null && pMax != null && pMax < pMin) return toast("Cena „do” nie może być niższa niż „od”.", "error");
    setBusy(true);
    try {
      const payload = {
        title, lat: pos.lat, lng: pos.lng, description, cuisine, city, coverUrl, address,
        priceMin: pMin, priceMax: pMax,
      };
      let id: string;
      try {
        id = await createPin(payload);
      } catch (e) {
        const msg = errorMessage(e);
        if (/już na mapie|pin_already_exists/i.test(msg)) throw e;
        id = await createPin({ ...payload, coverUrl: null });
        if (coverUrl) {
          await updatePin({ pinId: id, coverUrl, priceMin: pMin, priceMax: pMax, cuisine });
        }
      }
      if (menuPhoto || menuPdf) {
        try {
          await updatePin({
            pinId: id,
            menuPhotoUrl: menuPhoto,
            menuPdfUrl: menuPdf,
          });
        } catch (e) {
          toast(errorMessage(e), "info");
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
        <Body muted style={{ marginHorizontal: spacing.lg }}>Pin tylko z GPS na miejscu — „Dodaj Lokal”. Zdjęcie lokalu i menu: po 1 na miejsce (bez limitu miesięcznego).</Body>
        <Button testID="new-pin-gps" title="Dodaj Lokal" icon="crosshairs-gps" onPress={() => void locate()} style={{ marginHorizontal: spacing.lg }} />
        {pos ? (
          <View style={{ height: 180, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden" }}>
            <AppMapView center={pos} zoom={17} showUser followCenterToken={followToken} />
          </View>
        ) : null}
        <Body muted style={{ marginHorizontal: spacing.lg }} testID="new-pin-coords">
          {pos ? `GPS: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : "Brak lokalizacji."}
        </Body>
        {nearby ? (
          <View style={{ marginHorizontal: spacing.lg, gap: spacing.sm }}>
            <Body testID="new-pin-duplicate-warning">Zajęte przez „{nearby.title}”.</Body>
            <Button testID="new-pin-go-existing" title="Otwórz lokal" onPress={() => router.push(`/pin/${nearby.id}`)} />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Field testID="new-pin-title-input" label="Nazwa lokalu" value={title} onChangeText={setTitle} />
          <Field testID="new-pin-description-input" label="Opis" value={description} onChangeText={setDescription} multiline style={{ minHeight: 80 }} />
          <Field testID="new-pin-city-input" label="Miasto" value={city} onChangeText={setCity} />
          <Field testID="new-pin-address-input" label="Adres" value={address} onChangeText={setAddress} />
          <PinCategoryFields
            cuisine={cuisine} onCuisine={setCuisine}
            priceMin={priceMin} priceMax={priceMax} onPriceMin={setPriceMin} onPriceMax={setPriceMax}
          />

          <Title size={16}>Zdjęcie lokalu</Title>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={{ width: "100%", height: 160, borderRadius: radius.md }} contentFit="cover" /> : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="new-pin-cover-camera" title="Zrób zdjęcie lokalu" icon="camera" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addCover("camera")} />
            <Button testID="new-pin-cover-gallery" title="Wgraj zdjęcie lokalu" icon="image" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addCover("gallery")} />
          </View>

          <Title size={16}>Menu</Title>
          {menuPhoto ? <Image source={{ uri: menuPhoto }} style={{ width: "100%", height: 160, borderRadius: radius.md }} contentFit="cover" /> : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="new-pin-menu-camera" title="Zrób zdjęcie menu" icon="camera" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addMenuPhoto("camera")} />
            <Button testID="new-pin-menu-gallery" title="Wgraj zdjęcie menu" icon="image" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addMenuPhoto("gallery")} />
          </View>
          {menuPdf ? <Body muted testID="new-pin-menu-pdf-ready">PDF menu gotowy do publikacji.</Body> : null}
          <Button testID="new-pin-menu-pdf" title="Wgraj PDF menu" icon="file-pdf-box" variant="secondary" loading={photoBusy} onPress={() => void addMenuPdf()} />
        </View>
        <Button testID="new-pin-save-button" title="Opublikuj pin" loading={busy} disabled={!!nearby || !pos} onPress={() => void save()} style={{ marginHorizontal: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

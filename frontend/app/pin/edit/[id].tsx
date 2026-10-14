import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinCategoryFields } from "@/src/components/PinCategoryFields";
import { Body, Button, Chip, ChipRow, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { PIN_TAGS } from "@/src/lib/cuisines";
import { invalidatePins, pinDetails, updatePin } from "@/src/lib/data";
import { pickMenuPdf, pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { spacing, useTheme } from "@/src/theme";

export default function EditPin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [menuText, setMenuText] = useState("");
  const [menuPhoto, setMenuPhoto] = useState<string | null>(null);
  const [menuPdf, setMenuPdf] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [hadCover, setHadCover] = useState(false);
  const [hadMenuPhoto, setHadMenuPhoto] = useState(false);
  const [hadMenuPdf, setHadMenuPdf] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await pinDetails(id);
      setTitle(p.title ?? "");
      setDescription(p.description ?? "");
      setCity(p.city ?? "");
      setAddress(p.address ?? "");
      setCuisine(p.cuisine ?? null);
      setPriceMin(p.price_min != null ? String(p.price_min) : "");
      setPriceMax(p.price_max != null ? String(p.price_max) : "");
      setMenuText(p.menu_text ?? "");
      setMenuPhoto(p.menu_photo_url ?? null);
      setMenuPdf(p.menu_pdf_url ?? null);
      setCoverUrl(p.cover_url ?? null);
      setHadCover(!!p.cover_url);
      setHadMenuPhoto(!!p.menu_photo_url);
      setHadMenuPdf(!!p.menu_pdf_url);
      setTags(Array.isArray(p.tags) ? p.tags : []);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleTag = (key: string) => {
    setTags((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : prev.length >= 12 ? prev : [...prev, key]));
  };

  const addCover = async (source: "gallery" | "camera") => {
    if (hadCover) return toast("Lokal ma już zdjęcie — nie można dodać kolejnego.", "info");
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
    if (hadMenuPhoto) return toast("Menu ma już zdjęcie — nie można dodać kolejnego.", "info");
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

  const addMenuPdfFile = async () => {
    if (hadMenuPdf) return toast("Menu ma już PDF — nie można dodać kolejnego.", "info");
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
    const pMin = priceMin.trim() ? Number(priceMin) : null;
    const pMax = priceMax.trim() ? Number(priceMax) : null;
    if ((pMin != null && !Number.isFinite(pMin)) || (pMax != null && !Number.isFinite(pMax))) {
      return toast("Ceny muszą być liczbami", "error");
    }
    if (pMin != null && pMax != null && pMax < pMin) return toast("Cena „do” nie może być niższa niż „od”.", "error");
    setBusy(true);
    try {
      await updatePin({
        pinId: id,
        title: title.trim(),
        description: description.trim() || null,
        cuisine,
        city: city.trim() || null,
        address: address.trim() || null,
        priceMin: pMin,
        priceMax: pMax,
        menuText: menuText.trim() || null,
        menuPhotoUrl: !hadMenuPhoto ? menuPhoto : null,
        menuPdfUrl: !hadMenuPdf ? menuPdf : null,
        coverUrl: !hadCover ? coverUrl : null,
        tags,
      });
      invalidatePins();
      toast("Pin zaktualizowany", "success");
      router.back();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="edit-pin-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Edytuj lokal" />
      {loading ? <Loading /> : (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          <Body muted>Każdy Yummiter może uzupełnić dane. Zdjęcie lokalu i menu: tylko jeśli jeszcze ich nie ma (1 na pin).</Body>
          <Field testID="edit-pin-title" label="Nazwa" value={title} onChangeText={setTitle} />
          <Field testID="edit-pin-description" label="Opis" value={description} onChangeText={setDescription} multiline />
          <Field testID="edit-pin-city" label="Miasto" value={city} onChangeText={setCity} />
          <Field testID="edit-pin-address" label="Adres" value={address} onChangeText={setAddress} />
          <PinCategoryFields
            cuisine={cuisine}
            onCuisine={setCuisine}
            priceMin={priceMin}
            priceMax={priceMax}
            onPriceMin={setPriceMin}
            onPriceMax={setPriceMax}
          />
          <Title size={16}>Tagi oferty</Title>
          <ChipRow>
            {PIN_TAGS.map((t) => (
              <Chip key={t.key} testID={`edit-pin-tag-${t.key}`} label={t.label} selected={tags.includes(t.key)} onPress={() => toggleTag(t.key)} />
            ))}
          </ChipRow>

          <Title size={16}>Zdjęcie lokalu</Title>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={{ width: "100%", height: 160, borderRadius: 12 }} contentFit="cover" /> : null}
          {hadCover ? (
            <Body muted>Zdjęcie lokalu już jest — zablokowane dla innych.</Body>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID="edit-pin-cover-camera" title="Zrób zdjęcie lokalu" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addCover("camera")} />
              <Button testID="edit-pin-cover-gallery" title="Wgraj" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addCover("gallery")} />
            </View>
          )}

          <Title size={16}>Menu</Title>
          <Field testID="edit-pin-menu-text" label="Menu (tekst)" value={menuText} onChangeText={setMenuText} multiline placeholder="np. lunch 25 zł…" />
          {menuPhoto ? <Image source={{ uri: menuPhoto }} style={{ width: "100%", height: 180, borderRadius: 12 }} contentFit="cover" /> : null}
          {hadMenuPhoto ? (
            <Body muted>Zdjęcie menu już jest — zablokowane.</Body>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID="edit-pin-menu-camera" title="Zrób zdjęcie menu" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addMenuPhoto("camera")} />
              <Button testID="edit-pin-menu-gallery" title="Wgraj zdjęcie menu" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void addMenuPhoto("gallery")} />
            </View>
          )}
          {menuPdf ? (
            <Button testID="edit-pin-open-pdf" title="Otwórz PDF menu" variant="ghost" onPress={() => void Linking.openURL(menuPdf)} />
          ) : null}
          {hadMenuPdf ? (
            <Body muted>PDF menu już jest — zablokowany.</Body>
          ) : (
            <Button testID="edit-pin-menu-pdf" title="Wgraj PDF menu" variant="secondary" loading={photoBusy} onPress={() => void addMenuPdfFile()} />
          )}
          <Button testID="edit-pin-save" title="Zapisz zmiany" loading={busy} onPress={() => void save()} />
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

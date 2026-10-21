import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinCategoryFields } from "@/src/components/PinCategoryFields";
import { Body, Button, Chip, ChipRow, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { PIN_TAGS } from "@/src/lib/cuisines";
import { invalidatePins, pinDetails, updatePin } from "@/src/lib/data";
import {
  DELIVERY_SHARE_HINT,
  firstDeliveryValidationError,
  validateDeliveryUrl,
} from "@/src/lib/deliveryLinks";
import { openDeliveryOrWeb, resolvePhone } from "@/src/lib/openExternal";
import { resolveMenuUrl } from "@/src/lib/pinWebsite";
import { pickPinPhoto } from "@/src/lib/storage";
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
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [orderWolt, setOrderWolt] = useState("");
  const [orderPyszne, setOrderPyszne] = useState("");
  const [orderGlovo, setOrderGlovo] = useState("");
  const [orderUber, setOrderUber] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [hadCover, setHadCover] = useState(false);
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
      setWebsite(p.website ?? resolveMenuUrl(p.description) ?? "");
      setPhone(p.phone ?? resolvePhone(p.description) ?? "");
      setOrderWolt(p.order_wolt_url ?? "");
      setOrderPyszne(p.order_pyszne_url ?? "");
      setOrderGlovo(p.order_glovo_url ?? "");
      setOrderUber(p.order_uber_url ?? "");
      setCuisine(p.cuisine ?? null);
      setPriceMin(p.price_min != null ? String(p.price_min) : "");
      setPriceMax(p.price_max != null ? String(p.price_max) : "");
      setCoverUrl(p.cover_url ?? null);
      setHadCover(!!p.cover_url);
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

  const previewSite = resolveMenuUrl(website);
  const openWebsite = () => {
    if (!previewSite) return toast("Wpisz adres strony z menu", "info");
    void openDeliveryOrWeb(previewSite).catch(() => toast("Nie udało się otworzyć strony", "error"));
  };

  const woltError = useMemo(() => validateDeliveryUrl("wolt", orderWolt), [orderWolt]);
  const pyszneError = useMemo(() => validateDeliveryUrl("pyszne", orderPyszne), [orderPyszne]);
  const glovoError = useMemo(() => validateDeliveryUrl("glovo", orderGlovo), [orderGlovo]);
  const uberError = useMemo(() => validateDeliveryUrl("uber", orderUber), [orderUber]);
  const deliveryBlocked = !!(woltError || pyszneError || glovoError || uberError);

  const save = async () => {
    const deliveryErr = firstDeliveryValidationError({
      wolt: orderWolt,
      pyszne: orderPyszne,
      glovo: orderGlovo,
      uber: orderUber,
    });
    if (deliveryErr) return toast(deliveryErr, "error");
    if (title.trim().length < 2) return toast("Podaj nazwę lokalu", "error");
    const priceBlank = !priceMin.trim() && !priceMax.trim();
    if (!priceBlank && (!priceMin.trim() || !priceMax.trim())) {
      return toast("Podaj obie ceny albo zostaw obie puste.", "error");
    }
    const pMin = priceBlank ? null : Number(priceMin);
    const pMax = priceBlank ? null : Number(priceMax);
    if (!priceBlank && (pMin == null || pMax == null || !Number.isFinite(pMin) || !Number.isFinite(pMax) || pMin < 0 || pMax < 0)) {
      return toast("Ceny muszą być liczbami ≥ 0", "error");
    }
    if (!priceBlank && pMin != null && pMax != null && pMax < pMin) return toast("Najdroższe nie może być niższe niż najtańsze.", "error");
    setBusy(true);
    try {
      await updatePin({
        pinId: id,
        title: title.trim(),
        description: description.replace(/Menu i ceny:\s*https?:\/\/\S+/gi, "Menu i ceny są na stronie lokalu.").trim() || null,
        cuisine,
        city: city.trim() || null,
        address: address.trim() || null,
        priceMin: pMin,
        priceMax: pMax,
        coverUrl: !hadCover ? coverUrl : null,
        tags,
        website: website.trim(),
        phone: phone.trim(),
        orderWoltUrl: orderWolt.trim(),
        orderPyszneUrl: orderPyszne.trim(),
        orderGlovoUrl: orderGlovo.trim(),
        orderUberUrl: orderUber.trim(),
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
          <Body muted>Najważniejsze: strona z menu. Zdjęcie lokalu tylko jeśli jeszcze go nie ma.</Body>
          <Field testID="edit-pin-title" label="Nazwa" value={title} onChangeText={setTitle} />

          <Title size={16}>Strona z menu</Title>
          <Field testID="edit-pin-website" label="Adres www" value={website} onChangeText={setWebsite} placeholder="https://…" autoCapitalize="none" />
          <Button testID="edit-pin-open-website" title="Otwórz stronę z menu" icon="open-in-new" variant="secondary" onPress={openWebsite} disabled={!previewSite} />

          <Title size={16}>Zamówienie</Title>
          <Body muted>Puste pola nie pokażą przycisków na karcie lokalu.</Body>
          <Body muted>{DELIVERY_SHARE_HINT}</Body>
          <Field testID="edit-pin-phone" label="Telefon (zadzwoń i zamów)" value={phone} onChangeText={setPhone} placeholder="+48 …" keyboardType="phone-pad" autoCapitalize="none" />
          <Field testID="edit-pin-wolt" label="Link Wolt" value={orderWolt} onChangeText={setOrderWolt} placeholder="https://wolt.com/…" autoCapitalize="none" />
          {woltError ? <Body testID="edit-pin-wolt-error" style={{ color: colors.error }}>{woltError}</Body> : null}
          <Field testID="edit-pin-pyszne" label="Link Pyszne.pl" value={orderPyszne} onChangeText={setOrderPyszne} placeholder="https://www.pyszne.pl/…" autoCapitalize="none" />
          {pyszneError ? <Body testID="edit-pin-pyszne-error" style={{ color: colors.error }}>{pyszneError}</Body> : null}
          <Field testID="edit-pin-glovo" label="Link Glovo" value={orderGlovo} onChangeText={setOrderGlovo} placeholder="https://glovoapp.com/…" autoCapitalize="none" />
          {glovoError ? <Body testID="edit-pin-glovo-error" style={{ color: colors.error }}>{glovoError}</Body> : null}
          <Field testID="edit-pin-uber" label="Link Uber Eats" value={orderUber} onChangeText={setOrderUber} placeholder="https://www.ubereats.com/…" autoCapitalize="none" />
          {uberError ? <Body testID="edit-pin-uber-error" style={{ color: colors.error }}>{uberError}</Body> : null}

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

          <Button testID="edit-pin-save" title="Zapisz zmiany" loading={busy} disabled={deliveryBlocked} onPress={() => void save()} />
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

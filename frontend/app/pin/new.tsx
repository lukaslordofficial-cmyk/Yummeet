import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { PinCategoryFields } from "@/src/components/PinCategoryFields";
import { Body, Button, Field, Header, Title, useToast } from "@/src/components/ui";
import { useSharedDeliveryLink } from "@/src/hooks/useSharedDeliveryLink";
import { errorMessage } from "@/src/lib/api";
import { createPin, findNearbyPin, invalidatePins, updatePin, type NearbyPin } from "@/src/lib/data";
import {
  DELIVERY_SHARE_HINT,
  firstDeliveryValidationError,
  validateDeliveryUrl,
} from "@/src/lib/deliveryLinks";
import { getCurrentPosition } from "@/src/lib/location";
import { openDeliveryOrWeb } from "@/src/lib/openExternal";
import { resolveMenuUrl } from "@/src/lib/pinWebsite";
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
  useLocalSearchParams<{ fromShare?: string }>();

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [followToken, setFollowToken] = useState(0);
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
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nearby, setNearby] = useState<NearbyPin | null>(null);

  const onSharedLink = useCallback(
    (url: string, target: "wolt" | "pyszne" | "glovo" | "uber" | "website") => {
      if (target === "wolt") setOrderWolt(url);
      else if (target === "pyszne") setOrderPyszne(url);
      else if (target === "glovo") setOrderGlovo(url);
      else if (target === "uber") setOrderUber(url);
      else setWebsite(url);

      const label =
        target === "wolt" ? "Wolt"
          : target === "pyszne" ? "Pyszne.pl"
            : target === "glovo" ? "Glovo"
              : target === "uber" ? "Uber Eats"
                : "strony www";
      toast(`Link z ${label} wklejony do formularza`, "success");
    },
    [toast],
  );
  useSharedDeliveryLink(onSharedLink);

  useEffect(() => {
    if (!pos) { setNearby(null); return; }
    let alive = true;
    findNearbyPin(pos.lat, pos.lng, 40).then((hit) => { if (alive) setNearby(hit); });
    return () => { alive = false; };
  }, [pos?.lat, pos?.lng]);

  const woltError = useMemo(() => validateDeliveryUrl("wolt", orderWolt), [orderWolt]);
  const pyszneError = useMemo(() => validateDeliveryUrl("pyszne", orderPyszne), [orderPyszne]);
  const glovoError = useMemo(() => validateDeliveryUrl("glovo", orderGlovo), [orderGlovo]);
  const uberError = useMemo(() => validateDeliveryUrl("uber", orderUber), [orderUber]);
  const deliveryBlocked = !!(woltError || pyszneError || glovoError || uberError);

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

  const previewSite = resolveMenuUrl(website);
  const openWebsite = () => {
    if (!previewSite) return toast("Wpisz adres strony z menu", "info");
    void openDeliveryOrWeb(previewSite).catch(() => toast("Nie udało się otworzyć strony", "error"));
  };

  const orderPatch = () => ({
    phone: phone.trim() || null,
    orderWoltUrl: orderWolt.trim() || null,
    orderPyszneUrl: orderPyszne.trim() || null,
    orderGlovoUrl: orderGlovo.trim() || null,
    orderUberUrl: orderUber.trim() || null,
  });

  const save = async () => {
    const deliveryErr = firstDeliveryValidationError({
      wolt: orderWolt,
      pyszne: orderPyszne,
      glovo: orderGlovo,
      uber: orderUber,
    });
    if (deliveryErr) return toast(deliveryErr, "error");
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
        priceMin: pMin, priceMax: pMax, website: website.trim() || null,
      };
      let id: string;
      try {
        id = await createPin(payload);
      } catch (e) {
        const msg = errorMessage(e);
        if (/już na mapie|pin_already_exists/i.test(msg)) throw e;
        id = await createPin({ ...payload, coverUrl: null });
        if (coverUrl) {
          await updatePin({ pinId: id, coverUrl, priceMin: pMin, priceMax: pMax, cuisine, website: website.trim() || null, ...orderPatch() });
        }
      }
      const orders = orderPatch();
      if (orders.phone || orders.orderWoltUrl || orders.orderPyszneUrl || orders.orderGlovoUrl || orders.orderUberUrl) {
        try {
          await updatePin({ pinId: id, ...orders });
        } catch {
          /* pin już utworzony — zamówienie można dopisać w edycji */
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
        <Body muted style={{ marginHorizontal: spacing.lg }}>Pin tylko z GPS na miejscu — „Dodaj Lokal”. Menu: link do strony lokalu.</Body>
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

          <Title size={16}>Strona z menu</Title>
          <Field testID="new-pin-website-input" label="Adres www" value={website} onChangeText={setWebsite} placeholder="https://…" autoCapitalize="none" />
          <Button testID="new-pin-open-website" title="Otwórz stronę z menu" icon="open-in-new" variant="secondary" onPress={openWebsite} disabled={!previewSite} />

          <Title size={16}>Zamówienie</Title>
          <Body muted>Opcjonalnie — puste pola nie pokażą przycisków.</Body>
          <Body muted>{DELIVERY_SHARE_HINT}</Body>
          <Field testID="new-pin-phone" label="Telefon" value={phone} onChangeText={setPhone} placeholder="+48 …" keyboardType="phone-pad" autoCapitalize="none" />
          <Field testID="new-pin-wolt" label="Link Wolt" value={orderWolt} onChangeText={setOrderWolt} placeholder="https://wolt.com/…" autoCapitalize="none" />
          {woltError ? <Body testID="new-pin-wolt-error" style={{ color: colors.error }}>{woltError}</Body> : null}
          <Field testID="new-pin-pyszne" label="Link Pyszne.pl" value={orderPyszne} onChangeText={setOrderPyszne} placeholder="https://www.pyszne.pl/…" autoCapitalize="none" />
          {pyszneError ? <Body testID="new-pin-pyszne-error" style={{ color: colors.error }}>{pyszneError}</Body> : null}
          <Field testID="new-pin-glovo" label="Link Glovo" value={orderGlovo} onChangeText={setOrderGlovo} placeholder="https://glovoapp.com/…" autoCapitalize="none" />
          {glovoError ? <Body testID="new-pin-glovo-error" style={{ color: colors.error }}>{glovoError}</Body> : null}
          <Field testID="new-pin-uber" label="Link Uber Eats" value={orderUber} onChangeText={setOrderUber} placeholder="https://www.ubereats.com/…" autoCapitalize="none" />
          {uberError ? <Body testID="new-pin-uber-error" style={{ color: colors.error }}>{uberError}</Body> : null}

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
        </View>
        <Button
          testID="new-pin-save-button"
          title="Opublikuj pin"
          loading={busy}
          disabled={!!nearby || !pos || deliveryBlocked}
          onPress={() => void save()}
          style={{ marginHorizontal: spacing.lg }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

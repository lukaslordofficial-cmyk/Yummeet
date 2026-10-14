import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { Body, Button, Chip, ChipRow, EmptyState, ErrorState, Field, Loading, Title, useToast } from "@/src/components/ui";
import { allergenLabel, FOOD_ALLERGENS, toggleAllergen } from "@/src/lib/allergens";
import { errorMessage } from "@/src/lib/api";
import {
  createCookingTip, createFoodOffer, FOOD_DEAL_MODES, foodDealLabel, foodOfferDetails,
  listCookingTipsNearby, listFoodOffersNearby, openDirect,
  type CookingTip, type FoodDealMode, type FoodOffer, type FoodOfferKind,
} from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { FREE_PHOTO_SLOTS, photoQuotaStatus, pickPinPhoto, type PhotoQuota } from "@/src/lib/storage";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

function DishThumb({ uri, size = 44 }: { uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.sm }} contentFit="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
      <Icon name="food" size={Math.round(size * 0.5)} color={colors.muted} />
    </View>
  );
}

type Seg = "exchange" | "giveaway" | "signature" | "tips";

const SEGMENTS: { key: Seg; label: string; kind?: FoodOfferKind }[] = [
  { key: "exchange", label: "Wymiana", kind: "exchange" },
  { key: "giveaway", label: "Oddam", kind: "giveaway" },
  { key: "signature", label: "Popisowe", kind: "signature" },
  { key: "tips", label: "Inspiracje" },
];

export default function FoodTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [seg, setSeg] = useState<Seg>("exchange");
  const [offers, setOffers] = useState<FoodOffer[] | null>(null);
  const [tips, setTips] = useState<CookingTip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [placeDetail, setPlaceDetail] = useState("");
  const [portions, setPortions] = useState("1");
  const [allergenKeys, setAllergenKeys] = useState<string[]>([]);
  const [dealMode, setDealMode] = useState<FoodDealMode | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [quota, setQuota] = useState<PhotoQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [detail, setDetail] = useState<FoodOffer | CookingTip | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const loadQuota = useCallback(async () => {
    try { setQuota(await photoQuotaStatus(FREE_PHOTO_SLOTS)); } catch { /* migracja 017 */ }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const pos = await getCurrentPosition();
      if (!pos) {
        setError("location_required");
        setOffers([]);
        setTips([]);
        return;
      }
      if (seg === "tips") setTips(await listCookingTipsNearby(pos.lat, pos.lng));
      else {
        const kind = SEGMENTS.find((s) => s.key === seg)?.kind ?? "exchange";
        setOffers(await listFoodOffersNearby(kind, pos.lat, pos.lng));
      }
      await loadQuota();
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [seg, loadQuota]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetCompose = () => {
    setTitle(""); setBody(""); setCity(""); setStreet(""); setPlaceDetail("");
    setPortions("1"); setAllergenKeys([]); setDealMode(null); setPhoto(null);
  };

  const startChat = async (otherId: string) => {
    if (!otherId) return;
    if (otherId === session?.user.id) return toast("To Twoja oferta", "info");
    setChatBusy(true);
    try {
      const convId = await openDirect(otherId);
      setDetail(null);
      router.push(`/chat/${convId}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setChatBusy(false);
    }
  };

  const addPhoto = async (source: "gallery" | "camera") => {
    const uid = session?.user.id;
    if (!uid) return;
    try {
      const url = await pickPinPhoto(uid, source, { enforceSlots: true, quotaLimit: FREE_PHOTO_SLOTS });
      if (url) {
        setPhoto(url);
        await loadQuota();
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const openOfferDetail = async (item: FoodOffer) => {
    setDetailBusy(true);
    try {
      const full = await foodOfferDetails(item.id);
      setDetail(full ?? item);
    } catch {
      setDetail(item);
    } finally {
      setDetailBusy(false);
    }
  };

  const publish = async () => {
    if (title.trim().length < 2) return toast("Podaj tytuł", "error");
    if (seg === "tips" && body.trim().length < 10) return toast("Opisz trik (min. 10 znaków)", "error");
    if (seg !== "tips") {
      if (!allergenKeys.length) return toast("Zaznacz alergeny albo „Brak alergenów”", "error");
      if (!city.trim() || !street.trim()) return toast("Podaj miasto i ulicę", "error");
      if (!placeDetail.trim()) return toast("Podaj miejsce odbioru (np. przed sklepem)", "error");
      if (seg === "signature" && !dealMode) return toast("Wybierz formę współpracy (wynagrodzenie lub składniki + podział)", "error");
    }
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) throw new Error("location_required");
      if (seg === "tips") {
        await createCookingTip(title, body, photo, pos.lat, pos.lng);
      } else {
        const kind = SEGMENTS.find((s) => s.key === seg)?.kind ?? "exchange";
        const n = Math.max(1, Math.min(200, parseInt(portions, 10) || 1));
        await createFoodOffer({
          kind,
          title,
          description: body,
          photoUrl: photo,
          allergens: allergenKeys,
          portions: n,
          city,
          street,
          placeDetail,
          lat: pos.lat,
          lng: pos.lng,
          dealMode: kind === "signature" ? dealMode : null,
        });
      }
      toast("Opublikowano", "success");
      setCompose(false);
      resetCompose();
      await load();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const composeLabel =
    seg === "tips" ? "Dodaj inspirację"
      : seg === "giveaway" ? "Oddaj jedzenie"
        : seg === "signature" ? "Dodaj popisowe danie"
          : "Zaproponuj wymianę";

  const isOfferDetail = detail && "portions" in detail;
  const isTipDetail = detail && "body" in detail && !("portions" in detail);

  return (
    <View testID="food-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", gap: spacing.sm }}>
        <Title size={28} testID="food-title">Jedzenie</Title>
        <Button testID="food-compose-toggle" title={compose ? "Anuluj" : composeLabel} variant={compose ? "ghost" : "primary"} onPress={() => { setCompose((v) => !v); if (compose) resetCompose(); }} style={{ alignSelf: "stretch" }} />
      </View>
      <ChipRow testID="food-segments">
        {SEGMENTS.map((s) => (
          <Chip key={s.key} testID={`food-seg-${s.key}`} label={s.label} selected={seg === s.key} onPress={() => { setSeg(s.key); setCompose(false); resetCompose(); }} />
        ))}
      </ChipRow>

      {compose ? (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}>
          <Body muted>
            {seg === "tips"
              ? "Podziel się sprawdzonym trikiem. Widzą go użytkownicy w promieniu 20 km."
              : "Oferta widoczna w 20 km od Ciebie. GPS zapisuje lokalizację publikacji. Alergeny obowiązkowe."}
          </Body>
          <Field testID="food-title" label="Tytuł" value={title} onChangeText={setTitle} placeholder={seg === "tips" ? "np. Chrupiące ziemniaki" : "np. Domowa lasagne"} />
          <Field testID="food-body" label={seg === "tips" ? "Opis triku" : "Opis"} value={body} onChangeText={setBody} multiline
            placeholder={seg === "tips" ? "Jak to zrobić i dlaczego działa…" : "Skład, warunki…"} style={{ minHeight: 100 }} />
          {seg !== "tips" ? (
            <>
              <Field testID="food-portions" label="Liczba porcji" value={portions} onChangeText={setPortions} keyboardType="number-pad" placeholder="1" />
              <Body>Alergeny</Body>
              <View style={{ gap: spacing.xs }}>
                {FOOD_ALLERGENS.map((a) => {
                  const on = allergenKeys.includes(a.key);
                  return (
                    <Pressable
                      key={a.key}
                      testID={`food-allergen-${a.key}`}
                      onPress={() => setAllergenKeys((prev) => toggleAllergen(prev, a.key))}
                      style={{
                        paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md,
                        backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary,
                        borderWidth: 1, borderColor: on ? colors.brandPrimary : colors.border,
                      }}
                    >
                      <Body style={{ color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: 13 }}>{a.label}</Body>
                    </Pressable>
                  );
                })}
              </View>
              {seg === "signature" ? (
                <View style={{ gap: spacing.sm }}>
                  <Body>Forma współpracy</Body>
                  <Body muted>Jak chcesz ugotować to danie dla innych?</Body>
                  {FOOD_DEAL_MODES.map((m) => {
                    const on = dealMode === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        testID={`food-deal-${m.key}`}
                        onPress={() => setDealMode(m.key)}
                        style={{
                          padding: spacing.md, borderRadius: radius.md,
                          backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary,
                          borderWidth: 1, borderColor: on ? colors.brandPrimary : colors.border, gap: 4,
                        }}
                      >
                        <Body style={{ color: on ? colors.onBrandPrimary : colors.onSurface, fontFamily: fonts.display }}>{m.label}</Body>
                        <Body style={{ color: on ? colors.onBrandPrimary : colors.muted, fontSize: 13 }}>{m.hint}</Body>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Field testID="food-city" label="Miasto" value={city} onChangeText={setCity} placeholder="np. Kraków" />
              <Field testID="food-street" label="Ulica" value={street} onChangeText={setStreet} placeholder="np. Floriańska 12" />
              <Field testID="food-place-detail" label="Miejsce odbioru" value={placeDetail} onChangeText={setPlaceDetail} placeholder="np. przed wejściem do sklepu" />
            </>
          ) : null}
          {photo ? <Image source={{ uri: photo }} style={{ width: "100%", height: 180, borderRadius: radius.lg }} contentFit="cover" /> : null}
          {quota ? (
            <Body muted>Aktywne sloty zdjęć: {quota.used}/{quota.limit} (zwolnienie 48 h po końcu oferty/misji)</Body>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="food-photo-camera" title="Zrób zdjęcie" variant="secondary" onPress={() => void addPhoto("camera")} style={{ flex: 1 }} />
            <Button testID="food-photo-gallery" title="Galeria" variant="secondary" onPress={() => void addPhoto("gallery")} style={{ flex: 1 }} />
          </View>
          <Button testID="food-publish" title="Opublikuj" loading={busy} onPress={() => void publish()} />
        </KeyboardAwareScrollView>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={load} />
      ) : seg === "tips" ? (
        tips === null ? <Loading /> : (
          <FlatList
            data={tips}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.sm }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
            ListEmptyComponent={<EmptyState testID="food-tips-empty" icon="lightbulb-on-outline" title="Brak inspiracji w 20 km" text="Dodaj pierwszy kulinarny trik albo zbliż się do innych." />}
            renderItem={({ item }) => (
              <Pressable
                testID={`food-tip-${item.id}`}
                onPress={() => setDetail(item)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: spacing.md,
                  paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                  borderBottomWidth: 1, borderBottomColor: colors.border,
                }}
              >
                <DishThumb uri={item.photo_url} />
                <Title size={15} style={{ flex: 1 }} numberOfLines={1}>{item.title}</Title>
              </Pressable>
            )}
          />
        )
      ) : offers === null ? <Loading /> : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="food-offers-empty"
              icon="food"
              title="Brak ofert w 20 km"
              text={seg === "giveaway" ? "Nikt w okolicy nie oddaje jedzenia." : seg === "signature" ? "Brak popisowych dań w okolicy." : "Zaproponuj pierwszą wymianę w okolicy."}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`food-offer-${item.id}`}
              onPress={() => void openOfferDetail(item)}
              style={{
                flexDirection: "row", alignItems: "center", gap: spacing.md,
                paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                borderBottomWidth: 1, borderBottomColor: colors.border,
              }}
            >
              <DishThumb uri={item.photo_url} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Title size={15} numberOfLines={1}>{item.title}</Title>
              </View>
              <Body muted style={{ fontFamily: fonts.display }}>{item.portions_left}/{item.portions} porcji</Body>
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + spacing.md }}>
          <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Title size={22}>{isOfferDetail ? "Oferta" : "Inspiracja"}</Title>
            <Button testID="food-detail-close" title="Zamknij" variant="ghost" onPress={() => setDetail(null)} />
          </View>
          {detailBusy ? <Loading /> : (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
              {detail?.photo_url ? (
                <Image source={{ uri: detail.photo_url }} style={{ width: "100%", height: 220, borderRadius: radius.lg }} contentFit="cover" />
              ) : (
                <View style={{ width: "100%", height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="food-variant" size={56} color={colors.muted} />
                  <Body muted>Brak zdjęcia dania</Body>
                </View>
              )}
              <Title size={22}>{detail?.title}</Title>
              {isOfferDetail ? (
                <>
                  <Body muted>{(detail as FoodOffer).owner?.display_name ?? (detail as FoodOffer).owner_name ?? "Yummiter"} · {(detail as FoodOffer).portions_left}/{(detail as FoodOffer).portions} porcji</Body>
                  {(detail as FoodOffer).deal_mode ? (
                    <Body>Forma: {foodDealLabel((detail as FoodOffer).deal_mode)}</Body>
                  ) : null}
                  {(detail as FoodOffer).description ? <Body>{(detail as FoodOffer).description}</Body> : null}
                  {(detail as FoodOffer).allergens?.length ? (
                    <View style={{ gap: spacing.xs }}>
                      <Body muted>Alergeny</Body>
                      {(detail as FoodOffer).allergens.map((k) => (
                        <Body key={k}>• {allergenLabel(k)}</Body>
                      ))}
                    </View>
                  ) : null}
                  <Body muted>Odbiór</Body>
                  <Body>
                    {[
                      (detail as FoodOffer).city,
                      (detail as FoodOffer).street,
                      (detail as FoodOffer).place_detail ?? (detail as FoodOffer).pickup_place_public,
                    ].filter(Boolean).join(", ") || "—"}
                  </Body>
                  {(detail as FoodOffer).owner_id && (detail as FoodOffer).owner_id !== session?.user.id ? (
                    <Button
                      testID="food-offer-chat"
                      title="Napisz na czacie"
                      icon="chat"
                      loading={chatBusy}
                      onPress={() => void startChat((detail as FoodOffer).owner_id)}
                    />
                  ) : null}
                </>
              ) : null}
              {isTipDetail ? (
                <>
                  <Body muted>{(detail as CookingTip).author?.display_name ?? (detail as CookingTip).author_name ?? "Yummiter"}</Body>
                  <Body>{(detail as CookingTip).body}</Body>
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

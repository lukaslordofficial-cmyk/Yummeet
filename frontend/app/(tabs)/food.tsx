import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Field, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  createCookingTip, createFoodOffer, listCookingTips, listFoodOffers,
  type CookingTip, type FoodOffer, type FoodOfferKind,
} from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { pickPinPhoto } from "@/src/lib/storage";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/providers/AuthProvider";
import { radius, spacing, useTheme } from "@/src/theme";

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
  const [place, setPlace] = useState("");
  const [allergens, setAllergens] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      if (seg === "tips") setTips(await listCookingTips());
      else {
        const kind = SEGMENTS.find((s) => s.key === seg)?.kind ?? "exchange";
        setOffers(await listFoodOffers(kind));
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [seg]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPhoto = async () => {
    const uid = session?.user.id;
    if (!uid) return;
    try {
      const url = await pickPinPhoto(uid, "gallery");
      if (url) setPhoto(url);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const publish = async () => {
    if (title.trim().length < 2) return toast("Podaj tytuł", "error");
    if (seg === "tips" && body.trim().length < 10) return toast("Opisz trik (min. 10 znaków)", "error");
    setBusy(true);
    try {
      if (seg === "tips") {
        await createCookingTip(title, body, photo);
      } else {
        const kind = SEGMENTS.find((s) => s.key === seg)?.kind ?? "exchange";
        const pos = await getCurrentPosition();
        await createFoodOffer({
          kind,
          title,
          description: body,
          photoUrl: photo,
          allergens: allergens.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
          pickupPlace: place || undefined,
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
        });
      }
      toast("Opublikowano", "success");
      setCompose(false);
      setTitle(""); setBody(""); setPlace(""); setAllergens(""); setPhoto(null);
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

  return (
    <View testID="food-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Title size={28}>Jedzenie</Title>
        <Button testID="food-compose-toggle" title={compose ? "Anuluj" : composeLabel} variant={compose ? "ghost" : "primary"} onPress={() => setCompose((v) => !v)} />
      </View>
      <ChipRow testID="food-segments">
        {SEGMENTS.map((s) => (
          <Chip key={s.key} testID={`food-seg-${s.key}`} label={s.label} selected={seg === s.key} onPress={() => { setSeg(s.key); setCompose(false); }} />
        ))}
      </ChipRow>

      {compose ? (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}>
          <Body muted>
            {seg === "tips"
              ? "Podziel się sprawdzonym trikiem kuchennym."
              : seg === "giveaway"
                ? "Oddaj nadwyżkę — podaj alergeny, miejsce odbioru (publiczne) i warunki. Bez pól ceny w aplikacji."
                : seg === "signature"
                  ? "Popisowe danie do wymiany — opis, zdjęcie, alergeny."
                  : "Wymiana obiadów — ustalenia finansowe tylko poza aplikacją. Alergeny obowiązkowe."}
          </Body>
          <Field testID="food-title" label="Tytuł" value={title} onChangeText={setTitle} placeholder={seg === "tips" ? "np. Chrupiące ziemniaki" : "np. Domowa lasagne"} />
          <Field testID="food-body" label={seg === "tips" ? "Opis triku" : "Opis"} value={body} onChangeText={setBody} multiline
            placeholder={seg === "tips" ? "Jak to zrobić i dlaczego działa…" : "Skład, porcje, warunki…"} />
          {seg !== "tips" ? (
            <>
              <Field testID="food-allergens" label="Alergeny (po przecinku)" value={allergens} onChangeText={setAllergens} placeholder="gluten, mleko…" />
              <Field testID="food-place" label="Miejsce odbioru (publiczne)" value={place} onChangeText={setPlace} placeholder="np. przed sklepem na rynku" />
            </>
          ) : null}
          {photo ? <Image source={{ uri: photo }} style={{ width: "100%", height: 160, borderRadius: radius.lg }} contentFit="cover" /> : null}
          <Button testID="food-photo" title="Dodaj zdjęcie" variant="secondary" onPress={() => void addPhoto()} />
          <Button testID="food-publish" title="Opublikuj" loading={busy} onPress={() => void publish()} />
        </KeyboardAwareScrollView>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : seg === "tips" ? (
        tips === null ? <Loading /> : (
          <FlatList
            data={tips}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
            ListEmptyComponent={<EmptyState testID="food-tips-empty" icon="lightbulb-on-outline" title="Brak inspiracji" text="Dodaj pierwszy kulinarny trik." />}
            renderItem={({ item }) => (
              <Card testID={`food-tip-${item.id}`}>
                <Title size={17}>{item.title}</Title>
                <Body muted>{item.author?.display_name ?? "Yummiter"}</Body>
                <Body>{item.body}</Body>
                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={{ width: "100%", height: 140, borderRadius: radius.md, marginTop: spacing.sm }} contentFit="cover" /> : null}
              </Card>
            )}
          />
        )
      ) : offers === null ? <Loading /> : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="food-offers-empty"
              icon="food"
              title="Brak ofert"
              text={seg === "giveaway" ? "Nikt jeszcze nie oddaje jedzenia w okolicy." : seg === "signature" ? "Brak popisowych dań." : "Zaproponuj pierwszą wymianę."}
            />
          }
          renderItem={({ item }) => (
            <Card testID={`food-offer-${item.id}`} onPress={() => router.push(`/user/${item.owner_id}`)}>
              {item.photo_url ? <Image source={{ uri: item.photo_url }} style={{ width: "100%", height: 140, borderRadius: radius.md }} contentFit="cover" /> : null}
              <Title size={17}>{item.title}</Title>
              <Body muted>{item.owner?.display_name ?? "Yummiter"} · {item.portions_left}/{item.portions} porcji</Body>
              {item.description ? <Body numberOfLines={3}>{item.description}</Body> : null}
              {item.allergens?.length ? <Body muted>Alergeny: {item.allergens.join(", ")}</Body> : null}
              {item.pickup_place_public ? <Body muted>Odbiór: {item.pickup_place_public}</Body> : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}

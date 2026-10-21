import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Chip, ChipRow, Field, IconButton, Title, useToast } from "@/src/components/ui";
import { viewToBBox } from "@/src/domain/rules";
import { errorMessage } from "@/src/lib/api";
import { CUISINES, cuisinePinStyle } from "@/src/lib/cuisines";
import { pinsInBBox } from "@/src/lib/data";
import { usesNativeTabs } from "@/src/navigation";
import { radius, spacing, useTheme } from "@/src/theme";
import type { PinMarker } from "@/src/types";

export default function Discover() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");
  const [pins, setPins] = useState<PinMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const view = useRef({ lat: 52.2297, lng: 21.0122, zoom: 13 });
  const [center, setCenter] = useState(view.current);
  const [followToken, setFollowToken] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const priceFilter = useMemo(
    () => (priceMin != null || priceMax != null ? { min: priceMin, max: priceMax } : null),
    [priceMin, priceMax],
  );
  const priceActive = priceFilter != null;
  const priceChipLabel =
    priceMin != null && priceMax != null
      ? `${priceMin}–${priceMax} zł`
      : priceMin != null
        ? `od ${priceMin} zł`
        : priceMax != null
          ? `do ${priceMax} zł`
          : "Ceny";

  const load = useCallback(async () => {
    try {
      const v = view.current;
      const data = await pinsInBBox(viewToBBox(v.lat, v.lng, v.zoom), cuisine, priceFilter);
      setError(null);
      setPins((prev) => (prev.map((p) => p.id).join() === data.map((p) => p.id).join() ? prev : data));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [cuisine, priceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onViewChange = useCallback(
    (v: { lat: number; lng: number; zoom: number }) => {
      view.current = v;
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(load, 700);
    },
    [load],
  );

  const markers = useMemo(
    () =>
      pins.map((p) => {
        const style = cuisinePinStyle(p.cuisine);
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.title,
          label: p.title,
          color: style.color,
          glyph: style.glyph,
          official: p.is_official,
          coverUrl: p.cover_url || undefined,
        };
      }),
    [pins],
  );

  const locate = async () => {
    const cur = await Location.getForegroundPermissionsAsync();
    const perm = cur.granted ? cur : cur.canAskAgain ? await Location.requestForegroundPermissionsAsync() : cur;
    if (!perm.granted) return toast("Bez lokalizacji pokażemy mapę Warszawy.", "info");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    view.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14 };
    setCenter(view.current);
    setFollowToken(Date.now());
    load();
  };

  const openPrice = () => {
    setDraftMin(priceMin != null ? String(priceMin) : "");
    setDraftMax(priceMax != null ? String(priceMax) : "");
    setPriceOpen(true);
  };

  const applyPrice = () => {
    const minRaw = draftMin.trim();
    const maxRaw = draftMax.trim();
    const minN = minRaw === "" ? null : Number(minRaw);
    const maxN = maxRaw === "" ? null : Number(maxRaw);
    if (minN != null && (!Number.isFinite(minN) || minN < 0)) return toast("Kwota „od” musi być liczbą ≥ 0", "error");
    if (maxN != null && (!Number.isFinite(maxN) || maxN < 0)) return toast("Kwota „do” musi być liczbą ≥ 0", "error");
    if (minN != null && maxN != null && maxN < minN) return toast("„Do” nie może być niższe niż „od”", "error");
    if (minN == null && maxN == null) {
      setPriceMin(null);
      setPriceMax(null);
    } else {
      setPriceMin(minN != null ? Math.round(minN) : null);
      setPriceMax(maxN != null ? Math.round(maxN) : null);
    }
    setPriceOpen(false);
  };

  const clearPrice = () => {
    setPriceMin(null);
    setPriceMax(null);
    setDraftMin("");
    setDraftMax("");
    setPriceOpen(false);
  };

  return (
    <View testID="discover-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppMapView
        center={center}
        zoom={center.zoom}
        markers={markers}
        fitBounds={false}
        followCenterToken={followToken}
        onMarkerPress={(id) => router.push(`/pin/${id}`)}
        onViewChange={onViewChange}
      />
      <View style={{ pointerEvents: "box-none", position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm }}>
        <View
          style={{
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.lg,
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Title size={20}>Odkrywaj</Title>
            <Body muted testID="discover-pin-count">
              {error ? error : `${pins.length} miejsc · pin tylko z GPS na miejscu`}
            </Body>
          </View>
          <IconButton testID="discover-locate-button" icon="crosshairs-gps" onPress={locate} />
        </View>
        <ChipRow testID="discover-cuisine-chips">
          <Chip testID="price-chip" label={priceChipLabel} selected={priceActive} onPress={openPrice} />
          {CUISINES.map((c) => (
            <Chip key={c.label} testID={`cuisine-chip-${c.key ?? "all"}`} label={`${cuisinePinStyle(c.key).glyph} ${c.label}`} selected={cuisine === c.key} onPress={() => setCuisine(c.key)} />
          ))}
        </ChipRow>
      </View>
      <View
        style={{
          pointerEvents: "box-none",
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: bottomChrome + spacing.lg,
          flexDirection: "row",
          gap: spacing.md,
        }}
      >
        <Button testID="discover-route-button" title="Gastro-Trasa" icon="map-marker-path" style={{ flex: 1 }} onPress={() => router.push("/route")} />
        <Button testID="discover-add-pin-button" title="Pin" icon="map-marker-plus" variant="secondary" onPress={() => router.push("/pin/new")} />
      </View>

      <Modal visible={priceOpen} transparent animationType="fade" onRequestClose={() => setPriceOpen(false)}>
        <Pressable
          testID="price-modal-backdrop"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg }}
          onPress={() => setPriceOpen(false)}
        >
          <View
            style={{
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Title size={20}>Budżet na posiłek</Title>
            <Body muted>
              Pokaż lokale w Twoim budżecie (zł). Lokale bez wpisanych cen i tak zawsze będą widoczne.
            </Body>
            <Field
              testID="price-filter-min"
              label="Od (zł)"
              value={draftMin}
              onChangeText={setDraftMin}
              keyboardType="number-pad"
              placeholder="np. 20"
            />
            <Field
              testID="price-filter-max"
              label="Do (zł)"
              value={draftMax}
              onChangeText={setDraftMax}
              keyboardType="number-pad"
              placeholder="np. 50"
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID="price-filter-clear" title="Wyczyść" variant="ghost" style={{ flex: 1 }} onPress={clearPrice} />
              <Button testID="price-filter-apply" title="Zastosuj" style={{ flex: 1 }} onPress={applyPrice} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

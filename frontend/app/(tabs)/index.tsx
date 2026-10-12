import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMapView } from "@/src/components/map/AppMapView";
import { Body, Button, Chip, ChipRow, IconButton, Title, useToast } from "@/src/components/ui";
import { viewToBBox } from "@/src/domain/rules";
import { errorMessage } from "@/src/lib/api";
import { CUISINES } from "@/src/lib/cuisines";
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
  const [pins, setPins] = useState<PinMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const view = useRef({ lat: 52.2297, lng: 21.0122, zoom: 13 });
  const [center, setCenter] = useState(view.current);
  const [followToken, setFollowToken] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const v = view.current;
      const data = await pinsInBBox(viewToBBox(v.lat, v.lng, v.zoom), cuisine);
      setError(null);
      setPins((prev) => (prev.map((p) => p.id).join() === data.map((p) => p.id).join() ? prev : data));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [cuisine]);

  useEffect(() => { load(); }, [load]);

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
      pins.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        title: p.title,
        label: p.title,
        color: p.is_official ? colors.rarityLegendary : colors.brandPrimary,
        coverUrl: p.cover_url || undefined,
      })),
    [pins, colors],
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
        <View style={{ marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Title size={20}>Odkrywaj</Title>
            <Body muted testID="discover-pin-count">{error ? error : `${pins.length} miejsc · pin tylko z GPS na miejscu`}</Body>
          </View>
          <IconButton testID="discover-locate-button" icon="crosshairs-gps" onPress={locate} />
        </View>
        <ChipRow testID="discover-cuisine-chips">
          {CUISINES.map((c) => (
            <Chip key={c.label} testID={`cuisine-chip-${c.key ?? "all"}`} label={c.label} selected={cuisine === c.key} onPress={() => setCuisine(c.key)} />
          ))}
        </ChipRow>
      </View>
      <View style={{ pointerEvents: "box-none", position: "absolute", left: spacing.lg, right: spacing.lg, bottom: bottomChrome + spacing.lg, flexDirection: "row", gap: spacing.md }}>
        <Button testID="discover-route-button" title="Gastro-Trasa" icon="map-marker-path" style={{ flex: 1 }} onPress={() => router.push("/route")} />
        <Button testID="discover-add-pin-button" title="Pin" icon="map-marker-plus" variant="secondary" onPress={() => router.push("/pin/new")} />
      </View>
    </View>
  );
}

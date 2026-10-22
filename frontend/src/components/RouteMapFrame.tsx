import type { ReactNode } from "react";
import { View } from "react-native";

import { AppMapView } from "@/src/components/map/AppMapView";
import type { MapMarker } from "@/src/components/map/leafletHtml";
import { IconButton } from "@/src/components/ui";
import { ROUTE_TILES } from "@/src/lib/mapTiles";
import { radius, spacing } from "@/src/theme";

type Point = { lat: number; lng: number };

type Props = {
  tall: number;
  edgeToEdge: boolean;
  tracking: boolean;
  center: Point;
  line: Point[];
  markers: MapMarker[];
  followToken: number;
  fitToken: number;
  locateToken: number;
  full: boolean;
  onRecenter: () => void;
  onToggleFull: () => void;
  onHide: () => void;
  onMarkerPress: (id: string) => void;
  children?: ReactNode;
};

/** Mapa Gastro-Trasy. Zoom zostaje taki, jaki ustawił użytkownik. */
export function RouteMapFrame({
  tall, edgeToEdge, tracking, center, line, markers, followToken, fitToken, locateToken,
  full, onRecenter, onToggleFull, onHide, onMarkerPress, children,
}: Props) {
  return (
    <View style={{ height: tall, marginHorizontal: edgeToEdge ? 0 : spacing.lg, borderRadius: edgeToEdge ? 0 : radius.lg, overflow: "hidden" }}>
      <AppMapView
        tileUrl={ROUTE_TILES}
        polylineColor="#1A73E8"
        gpsFollow={tracking}
        keepZoom={tracking}
        zoom={16}
        center={center}
        polyline={line}
        markers={markers}
        fitToken={fitToken}
        locateToken={locateToken}
        followCenterToken={followToken}
        onMarkerPress={onMarkerPress}
      />
      <View style={{ position: "absolute", zIndex: 2, top: spacing.sm, right: spacing.sm, gap: spacing.sm }}>
        <IconButton testID="route-map-locate" icon="crosshairs-gps" tone="sheet" onPress={onRecenter} />
        <IconButton testID={full ? "route-map-window" : "route-map-full"} icon={full ? "arrow-collapse" : "arrow-expand"} tone="sheet" onPress={onToggleFull} />
        <IconButton testID="route-map-hide" icon="eye-off" tone="sheet" onPress={onHide} />
      </View>
      {children ? (
        <View style={{ position: "absolute", zIndex: 2, left: 0, right: 56, bottom: 0 }}>{children}</View>
      ) : null}
    </View>
  );
}

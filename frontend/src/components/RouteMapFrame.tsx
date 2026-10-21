import { View } from "react-native";

import { AppMapView } from "@/src/components/map/AppMapView";
import type { MapMarker } from "@/src/components/map/leafletHtml";
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
  onMarkerPress: (id: string) => void;
};

/** Mapa Gastro-Trasy: w planowaniu cały przebieg, w jeździe kadr jak w nawigacji. */
export function RouteMapFrame({ tall, edgeToEdge, tracking, center, line, markers, followToken, onMarkerPress }: Props) {
  return (
    <View style={{ height: tall, marginHorizontal: edgeToEdge ? 0 : spacing.lg, borderRadius: edgeToEdge ? 0 : radius.lg, overflow: "hidden" }}>
      <AppMapView
        tileUrl={ROUTE_TILES}
        polylineColor="#1A73E8"
        gpsFollow={tracking}
        zoom={tracking ? 16 : 13}
        center={center}
        polyline={line}
        markers={markers}
        fitBounds={!tracking}
        followCenterToken={followToken}
        onMarkerPress={onMarkerPress}
      />
    </View>
  );
}

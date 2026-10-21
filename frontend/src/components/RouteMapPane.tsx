import { Modal, View } from "react-native";

import { RouteMapFrame } from "@/src/components/RouteMapFrame";
import { Button } from "@/src/components/ui";
import type { MapMarker } from "@/src/components/map/leafletHtml";
import { spacing, useTheme } from "@/src/theme";

export type RouteMapMode = "window" | "hidden" | "full";

type Point = { lat: number; lng: number };

type Props = {
  mode: RouteMapMode;
  onMode: (mode: RouteMapMode) => void;
  tall: number;
  edgeToEdge: boolean;
  tracking: boolean;
  center: Point;
  line: Point[];
  markers: MapMarker[];
  followToken: number;
  onMarkerPress: (id: string) => void;
  windowHeight: number;
  topInset: number;
};

function MapActions({ mode, onMode }: { mode: RouteMapMode; onMode: (mode: RouteMapMode) => void }) {
  if (mode === "hidden") {
    return <Button testID="route-map-show" title="Pokaż mapę" variant="secondary" onPress={() => onMode("window")} />;
  }
  const full = mode === "full";
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Button
        testID={full ? "route-map-window" : "route-map-full"}
        title={full ? "Okno" : "Pełny ekran"}
        variant="secondary"
        onPress={() => onMode(full ? "window" : "full")}
        style={{ flex: 1 }}
      />
      <Button testID="route-map-hide" title="Schowaj" variant="ghost" onPress={() => onMode("hidden")} style={{ flex: 1 }} />
    </View>
  );
}

/** Mapa trasy: okno, pełny ekran albo całkowicie schowana. */
export function RouteMapPane(props: Props) {
  const { colors } = useTheme();
  const frame = (tall: number, edgeToEdge: boolean) => (
    <RouteMapFrame
      tall={tall}
      edgeToEdge={edgeToEdge}
      tracking={props.tracking}
      center={props.center}
      line={props.line}
      markers={props.markers}
      followToken={props.followToken}
      onMarkerPress={props.onMarkerPress}
    />
  );

  return (
    <>
      {props.mode === "hidden" ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <MapActions mode="hidden" onMode={props.onMode} />
        </View>
      ) : null}
      {props.mode === "window" ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <MapActions mode="window" onMode={props.onMode} />
          </View>
          {frame(props.tall, props.edgeToEdge)}
        </View>
      ) : null}
      <Modal visible={props.mode === "full"} animationType="fade" onRequestClose={() => props.onMode("window")} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          {props.mode === "full" ? frame(props.windowHeight, true) : null}
          <View style={{ position: "absolute", zIndex: 2, top: props.topInset + spacing.sm, left: spacing.md, right: spacing.md }}>
            <MapActions mode="full" onMode={props.onMode} />
          </View>
        </View>
      </Modal>
    </>
  );
}

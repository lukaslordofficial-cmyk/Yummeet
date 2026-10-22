import type { ReactNode } from "react";
import { Modal, View } from "react-native";

import { RouteMapFrame } from "@/src/components/RouteMapFrame";
import { IconButton } from "@/src/components/ui";
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
  fitToken: number;
  locateToken: number;
  onRecenter: () => void;
  onMarkerPress: (id: string) => void;
  windowHeight: number;
  topInset: number;
  overlay?: ReactNode;
};

/** Mapa trasy: okno, pełny ekran albo schowana. Sterowanie jest ikonami na mapie. */
export function RouteMapPane(props: Props) {
  const { colors } = useTheme();
  const frame = (tall: number, edgeToEdge: boolean, full: boolean) => (
    <RouteMapFrame
      tall={tall}
      edgeToEdge={edgeToEdge}
      tracking={props.tracking}
      center={props.center}
      line={props.line}
      markers={props.markers}
      followToken={props.followToken}
      fitToken={props.fitToken}
      locateToken={props.locateToken}
      full={full}
      onRecenter={props.onRecenter}
      onToggleFull={() => props.onMode(full ? "window" : "full")}
      onHide={() => props.onMode("hidden")}
      onMarkerPress={props.onMarkerPress}
    >
      {props.overlay}
    </RouteMapFrame>
  );

  return (
    <>
      {props.mode === "hidden" ? (
        <View style={{ paddingHorizontal: spacing.lg, alignItems: "flex-end" }}>
          <IconButton testID="route-map-show" icon="map" tone="sheet" onPress={() => props.onMode("window")} />
        </View>
      ) : null}
      {props.mode === "window" ? frame(props.tall, props.edgeToEdge, false) : null}
      <Modal visible={props.mode === "full"} animationType="fade" onRequestClose={() => props.onMode("window")} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: props.topInset }}>
          {props.mode === "full" ? frame(props.windowHeight - props.topInset, true, true) : null}
        </View>
      </Modal>
    </>
  );
}

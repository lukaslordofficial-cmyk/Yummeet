import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";

import { MAP_TILES } from "@/src/lib/mapTiles";

import { buildLeafletHtml, type LeafletOptions, type MapShape, type MapUpdatePayload } from "./leafletHtml";

export interface MapViewProps extends LeafletOptions {
  style?: ViewStyle;
  onMarkerPress?: (id: string) => void;
  onMapPress?: (lat: number, lng: number) => void;
  onMapDblClick?: (lat: number, lng: number) => void;
  onAreaDrawn?: (shape: MapShape) => void;
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  followCenterToken?: number | string;
  /** Śledzenie jak w nawigacji: kamera za kierowcą, niżej w kadrze. */
  gpsFollow?: boolean;
  /** Dopasuj kadr tylko gdy ta wartość się zmieni, nie przy każdym odświeżeniu pinów. */
  fitToken?: number;
  /** Wróć do podanego zoomu (znacznik bieżącej lokalizacji). */
  locateToken?: number;
  /** Przy śledzeniu GPS zostaw zoom ustawiony palcami. */
  keepZoom?: boolean;
}

export function handleMapMessage(data: any, h: Pick<MapViewProps, "onMarkerPress" | "onMapPress" | "onMapDblClick" | "onAreaDrawn" | "onViewChange">) {
  if (!data || !data.type) return;
  if (data.type === "markerPress") h.onMarkerPress?.(data.id);
  if (data.type === "mapPress") h.onMapPress?.(data.lat, data.lng);
  if (data.type === "mapDblClick") h.onMapDblClick?.(data.lat, data.lng);
  if (data.type === "areaDrawn") h.onAreaDrawn?.(data.shape);
  if (data.type === "view") h.onViewChange?.({ lat: data.lat, lng: data.lng, zoom: data.zoom });
}

export function AppMapView({
  style,
  onMarkerPress,
  onMapPress,
  onMapDblClick,
  onAreaDrawn,
  onViewChange,
  followCenterToken,
  center,
  zoom = 12,
  markers = [],
  polyline = [],
  showUser = false,
  pickMode = false,
  emitClicks = false,
  fitBounds = false,
  shape = null,
  drawMode = null,
  tileUrl,
  polylineColor,
  gpsFollow = false,
  fitToken,
  locateToken,
  keepZoom = false,
}: MapViewProps) {
  const frameRef = useRef<any>(null);
  const ready = useRef(false);
  const handlerRef = useRef({ onMarkerPress, onMapPress, onMapDblClick, onAreaDrawn, onViewChange });
  handlerRef.current = { onMarkerPress, onMapPress, onMapDblClick, onAreaDrawn, onViewChange };
  const initial = useRef({ center, zoom, pickMode, emitClicks, drawMode, tileUrl, gpsFollow });
  const lastFollow = useRef(followCenterToken);
  const lastFit = useRef<number | undefined>(undefined);
  const lastLocate = useRef<number | undefined>(undefined);

  const html = useMemo(
    () =>
      buildLeafletHtml({
        tileUrl: initial.current.tileUrl || MAP_TILES.tileUrl,
        maxZoom: MAP_TILES.maxZoom,
        center: initial.current.center,
        zoom: initial.current.zoom,
        markers: [],
        polyline: [],
        showUser: false,
        pickMode: initial.current.pickMode,
        emitClicks: initial.current.emitClicks,
        drawMode: initial.current.drawMode,
        fitBounds: false,
        shape: null,
        gps: !!initial.current.gpsFollow,
      }),
    [],
  );

  const pushUpdate = (extra: Partial<MapUpdatePayload> = {}) => {
    const win = frameRef.current?.contentWindow;
    if (!win || !ready.current || typeof win.__updateMap !== "function") return;
    const shouldFollow = followCenterToken !== undefined && followCenterToken !== lastFollow.current;
    if (shouldFollow) lastFollow.current = followCenterToken;
    const shouldFit = fitToken !== undefined && fitToken !== lastFit.current;
    if (shouldFit) lastFit.current = fitToken;
    const shouldLocate = locateToken !== undefined && locateToken !== lastLocate.current;
    if (shouldLocate) lastLocate.current = locateToken;
    const payload: MapUpdatePayload = {
      markers,
      polyline,
      center,
      zoom: shouldLocate ? zoom : zoom,
      showUser,
      pickMode,
      emitClicks,
      shape,
      polylineColor,
      gps: gpsFollow && !shouldLocate,
      setView: shouldLocate || shouldFollow,
      keepZoom: shouldLocate ? false : keepZoom && shouldFollow,
      fitBounds: shouldLocate || shouldFollow ? false : fitToken === undefined
        ? !!fitBounds && ((polyline?.length ?? 0) > 1 || (markers?.length ?? 0) > 1)
        : shouldFit && ((polyline?.length ?? 0) > 1 || (markers?.length ?? 0) > 1),
      ...extra,
    };
    win.__updateMap(payload);
  };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (frameRef.current && event.source !== frameRef.current.contentWindow) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "ready") {
          ready.current = true;
          pushUpdate({ setView: false });
          return;
        }
        handleMapMessage(data, handlerRef.current);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pushUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, polyline, polylineColor, center, zoom, showUser, pickMode, emitClicks, shape, fitBounds, followCenterToken, gpsFollow, fitToken, locateToken, keepZoom]);

  return (
    <View style={[styles.web, style]}>
      {/* @ts-ignore - iframe is a real DOM element on react-native-web */}
      <iframe ref={frameRef} title="map" srcDoc={html} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#F2E6DD", overflow: "hidden" },
});

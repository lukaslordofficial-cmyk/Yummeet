import { useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { MAP_TILES } from "@/src/lib/mapTiles";

import { buildLeafletHtml, type LeafletOptions, type MapShape, type MapUpdatePayload } from "./leafletHtml";

export interface MapViewProps extends LeafletOptions {
  style?: ViewStyle;
  onMarkerPress?: (id: string) => void;
  onMapPress?: (lat: number, lng: number) => void;
  /** Double-tap / double-click on empty map (e.g. add pin). */
  onMapDblClick?: (lat: number, lng: number) => void;
  onAreaDrawn?: (shape: MapShape) => void;
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  /** Bump this (e.g. Date.now()) when you want the map to fly to `center`. */
  followCenterToken?: number | string;
  /** Śledzenie jak w nawigacji: kamera za kierowcą, niżej w kadrze. */
  gpsFollow?: boolean;
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
}: MapViewProps) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const initial = useRef({ center, zoom, pickMode, emitClicks, drawMode, fitBounds, tileUrl, gpsFollow });
  const lastFollow = useRef(followCenterToken);

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

  useEffect(() => {
    if (!ready.current) return;
    const shouldFollow = followCenterToken !== undefined && followCenterToken !== lastFollow.current;
    if (shouldFollow) lastFollow.current = followCenterToken;
    const payload: MapUpdatePayload = {
      markers,
      polyline,
      center,
      zoom,
      showUser,
      pickMode,
      emitClicks,
      shape,
      polylineColor,
      gps: gpsFollow,
      setView: shouldFollow,
      fitBounds: shouldFollow ? false : fitBounds && !!polyline?.length,
    };
    const js = `window.__updateMap && window.__updateMap(${JSON.stringify(payload)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, [markers, polyline, polylineColor, center, zoom, showUser, pickMode, emitClicks, shape, fitBounds, followCenterToken, gpsFollow]);

  return (
    <WebView
      ref={webRef}
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://localhost" }}
      style={[styles.web, style]}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "ready") {
            ready.current = true;
            const payload: MapUpdatePayload = {
              markers,
              polyline,
              center,
              zoom,
              showUser,
              pickMode,
              emitClicks,
              shape,
              polylineColor,
              gps: gpsFollow,
              setView: false,
              fitBounds: fitBounds && ((markers?.length ?? 0) > 1 || (polyline?.length ?? 0) > 1),
            };
            webRef.current?.injectJavaScript(`window.__updateMap && window.__updateMap(${JSON.stringify(payload)}); true;`);
            return;
          }
          if (data.type === "markerPress") onMarkerPress?.(data.id);
          if (data.type === "mapPress") onMapPress?.(data.lat, data.lng);
          if (data.type === "mapDblClick") onMapDblClick?.(data.lat, data.lng);
          if (data.type === "areaDrawn") onAreaDrawn?.(data.shape);
          if (data.type === "view") onViewChange?.({ lat: data.lat, lng: data.lng, zoom: data.zoom });
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#F2E6DD" },
});

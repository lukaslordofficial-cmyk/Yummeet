import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { buildLeafletHtml, type LeafletOptions, type MapShape } from './leafletHtml';
import { MAP_TILES } from '@/src/lib/mapTiles';

export interface MapViewProps extends LeafletOptions {
  style?: ViewStyle;
  onMarkerPress?: (id: string) => void;
  onMapPress?: (lat: number, lng: number) => void;
  onAreaDrawn?: (shape: MapShape) => void;
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
}

export function handleMapMessage(data: any, h: Pick<MapViewProps, 'onMarkerPress' | 'onMapPress' | 'onAreaDrawn' | 'onViewChange'>) {
  if (!data || !data.type) return;
  if (data.type === 'markerPress') h.onMarkerPress?.(data.id);
  if (data.type === 'mapPress') h.onMapPress?.(data.lat, data.lng);
  if (data.type === 'areaDrawn') h.onAreaDrawn?.(data.shape);
  if (data.type === 'view') h.onViewChange?.({ lat: data.lat, lng: data.lng, zoom: data.zoom });
}

export function AppMapView({ style, onMarkerPress, onMapPress, onAreaDrawn, onViewChange, ...opts }: MapViewProps) {
  const provider = MAP_TILES;
  const html = buildLeafletHtml({ tileUrl: provider.tileUrl, maxZoom: provider.maxZoom, ...opts });
  const frameRef = useRef<any>(null);
  const handlerRef = useRef({ onMarkerPress, onMapPress, onAreaDrawn, onViewChange });
  handlerRef.current = { onMarkerPress, onMapPress, onAreaDrawn, onViewChange };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Several maps can be mounted: only react to messages from our own iframe.
      if (frameRef.current && event.source !== frameRef.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        handleMapMessage(data, handlerRef.current);
      } catch {}
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <View style={[styles.web, style]}>
      {/* @ts-ignore - iframe is a real DOM element on react-native-web */}
      <iframe
        ref={frameRef}
        title="map"
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#F2E6DD', overflow: 'hidden' },
});

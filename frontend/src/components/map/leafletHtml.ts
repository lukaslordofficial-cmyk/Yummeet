export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  /** Optional short text shown inside the marker (e.g. "A", "B", "3"). */
  label?: string;
}

export type MapShape =
  | { type: "circle"; lat: number; lng: number; radiusM: number }
  | { type: "rect"; south: number; west: number; north: number; east: number };

export interface LeafletOptions {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  showUser?: boolean;
  pickMode?: boolean;
  polyline?: { lat: number; lng: number }[];
  shape?: MapShape | null;
  drawMode?: "circle" | "rect" | null;
  emitClicks?: boolean;
  fitBounds?: boolean;
  tileUrl?: string;
  maxZoom?: number;
}

/** Payload injected into a live map without remounting the WebView. */
export type MapUpdatePayload = {
  markers?: MapMarker[];
  polyline?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** When true, fly/setView to center (e.g. "locate me"). Default false. */
  setView?: boolean;
  fitBounds?: boolean;
  pickMode?: boolean;
  emitClicks?: boolean;
  showUser?: boolean;
  shape?: MapShape | null;
};

export function buildLeafletHtml(opts: LeafletOptions): string {
  const {
    center,
    zoom = 12,
    markers = [],
    showUser = false,
    pickMode = false,
    polyline = [],
    shape = null,
    drawMode = null,
    emitClicks = false,
    fitBounds = true,
    tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom = 19,
  } = opts;
  const cfg = JSON.stringify({
    center,
    zoom,
    markers,
    showUser,
    pickMode,
    emitClicks,
    fitBounds,
    tileUrl,
    maxZoom,
    drawMode,
    shape,
    polyline: polyline.map((p) => [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5))]),
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background:#F2E6DD; }
    .pin-dot { background:#E05F36; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 0 2px rgba(224,95,54,0.35); }
    .pin-label { min-width:22px; height:22px; padding:0 4px; border-radius:11px; border:2px solid #fff; color:#fff; font:700 11px/18px -apple-system,Segoe UI,Roboto,sans-serif; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); box-sizing:border-box; }
    .user-dot { background:#38A342; width:14px; height:14px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 0 6px rgba(56,163,66,0.25); }
    .draw-dot { background:#FF9F43; width:12px; height:12px; border-radius:50%; border:2px solid #fff; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function send(obj){
      var s = JSON.stringify(obj);
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(s); }
      else if (window.parent) { window.parent.postMessage(s, '*'); }
    }
    var C = ${cfg};
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([C.center.lat, C.center.lng], C.zoom);
    L.tileLayer(C.tileUrl, { maxZoom: C.maxZoom, subdomains: 'abc' }).addTo(map);

    function pinIcon(color, label){
      if (label) {
        return L.divIcon({ className:'', html:'<div class="pin-label" style="background:'+(color||'#E05F36')+'">'+label+'</div>', iconSize:[22,22], iconAnchor:[11,11] });
      }
      return L.divIcon({ className:'', html:'<div class="pin-dot" style="background:'+(color||'#E05F36')+'"></div>', iconSize:[16,16], iconAnchor:[8,8] });
    }

    var markerLayer = L.layerGroup().addTo(map);
    var polyLayer = L.layerGroup().addTo(map);
    var userLayer = L.layerGroup().addTo(map);
    var shapeLayerGroup = L.layerGroup().addTo(map);
    var pickMarker = null;
    var pickModeOn = !!C.pickMode;
    var emitClicksOn = !!C.emitClicks;

    function clearGroup(g){ g.clearLayers(); }

    function renderMarkers(list){
      clearGroup(markerLayer);
      (list||[]).forEach(function(m){
        var mk = L.marker([m.lat, m.lng], { icon: pinIcon(m.color, m.label) });
        if (m.title) mk.bindTooltip(m.title);
        mk.on('click', function(){ send({ type:'markerPress', id: m.id }); });
        markerLayer.addLayer(mk);
      });
    }

    function renderPolyline(line){
      clearGroup(polyLayer);
      if (line && line.length > 1) {
        polyLayer.addLayer(L.polyline(line, { color:'#E05F36', weight:5, opacity:0.85 }));
      }
    }

    function renderUser(show, c){
      clearGroup(userLayer);
      if (show && c) {
        userLayer.addLayer(L.marker([c.lat, c.lng], { icon: L.divIcon({ className:'', html:'<div class="user-dot"></div>', iconSize:[14,14], iconAnchor:[7,7] }) }));
      }
    }

    function drawShape(s, style){
      if (!s) return null;
      if (s.type === 'circle') return L.circle([s.lat, s.lng], Object.assign({ radius: s.radiusM }, style));
      return L.rectangle([[s.south, s.west],[s.north, s.east]], style);
    }

    function renderShape(s){
      clearGroup(shapeLayerGroup);
      var layer = drawShape(s, { color:'#FF9F43', weight:2, fillColor:'#FF9F43', fillOpacity:0.12 });
      if (layer) shapeLayerGroup.addLayer(layer);
    }

    function ensurePickMarker(lat, lng){
      if (!pickModeOn) {
        if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
        return;
      }
      if (!pickMarker) {
        pickMarker = L.marker([lat, lng], { draggable: true, icon: pinIcon('#FF9F43') }).addTo(map);
        pickMarker.on('dragend', function(e){ var ll = e.target.getLatLng(); send({ type:'mapPress', lat: ll.lat, lng: ll.lng }); });
      } else {
        pickMarker.setLatLng([lat, lng]);
      }
    }

    map.on('click', function(e){
      if (pickModeOn) {
        ensurePickMarker(e.latlng.lat, e.latlng.lng);
        send({ type:'mapPress', lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      if (emitClicksOn && !C.drawMode) {
        send({ type:'mapPress', lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    if (C.drawMode) {
      var first = null, firstMk = null, preview = null;
      var shapeStyle = { color:'#FF9F43', weight:2, fillColor:'#FF9F43', fillOpacity:0.12 };
      map.on('click', function(e){
        if (!first) {
          first = e.latlng;
          firstMk = L.marker(first, { icon: L.divIcon({ className:'', html:'<div class="draw-dot"></div>', iconSize:[12,12], iconAnchor:[6,6] }) }).addTo(map);
          send({ type:'drawStart' });
          return;
        }
        var s;
        if (C.drawMode === 'circle') {
          s = { type:'circle', lat: first.lat, lng: first.lng, radiusM: Math.max(200, map.distance(first, e.latlng)) };
        } else {
          s = { type:'rect', south: Math.min(first.lat, e.latlng.lat), north: Math.max(first.lat, e.latlng.lat), west: Math.min(first.lng, e.latlng.lng), east: Math.max(first.lng, e.latlng.lng) };
        }
        if (preview) map.removeLayer(preview);
        preview = drawShape(s, shapeStyle); if (preview) preview.addTo(map);
        map.removeLayer(firstMk); first = null;
        send({ type:'areaDrawn', shape: s });
      });
    }

    // Initial paint
    renderMarkers(C.markers);
    renderPolyline(C.polyline);
    renderUser(C.showUser, C.center);
    renderShape(C.shape);
    if (C.pickMode) ensurePickMarker(C.center.lat, C.center.lng);

    if (C.fitBounds) {
      var b = [];
      if (C.polyline && C.polyline.length > 1) b = b.concat(C.polyline);
      (C.markers||[]).forEach(function(m){ b.push([m.lat, m.lng]); });
      if (b.length > 1) { try { map.fitBounds(b, { padding:[30,30], maxZoom: 14 }); } catch(e){} }
    }

    window.__updateMap = function(U){
      if (!U) return;
      if (typeof U.pickMode === 'boolean') pickModeOn = U.pickMode;
      if (typeof U.emitClicks === 'boolean') emitClicksOn = U.emitClicks;
      if (U.markers) renderMarkers(U.markers);
      if (U.polyline) {
        var line = U.polyline.map(function(p){ return [p.lat, p.lng]; });
        renderPolyline(line);
      }
      if (U.shape !== undefined) renderShape(U.shape);
      if (U.showUser !== undefined) renderUser(!!U.showUser, U.center || map.getCenter());
      if (pickModeOn && U.center) ensurePickMarker(U.center.lat, U.center.lng);
      if (!pickModeOn && pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
      if (U.setView && U.center) {
        map.setView([U.center.lat, U.center.lng], U.zoom != null ? U.zoom : map.getZoom());
      }
      if (U.fitBounds && U.markers && U.markers.length > 1) {
        try {
          map.fitBounds(U.markers.map(function(m){ return [m.lat, m.lng]; }), { padding:[30,30], maxZoom: 14 });
        } catch(e){}
      }
      if (U.fitBounds && U.polyline && U.polyline.length > 1) {
        try {
          map.fitBounds(U.polyline.map(function(p){ return [p.lat, p.lng]; }), { padding:[30,30], maxZoom: 14 });
        } catch(e){}
      }
    };

    map.on('moveend', function(){ var c = map.getCenter(); send({ type:'view', lat: c.lat, lng: c.lng, zoom: map.getZoom() }); });
    send({ type:'ready' });
  </script>
</body>
</html>`;
}

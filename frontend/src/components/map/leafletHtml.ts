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
  | { type: 'circle'; lat: number; lng: number; radiusM: number }
  | { type: 'rect'; south: number; west: number; north: number; east: number };

export interface LeafletOptions {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  showUser?: boolean;
  pickMode?: boolean; // shows a single draggable pin the user can move
  polyline?: { lat: number; lng: number }[];
  shape?: MapShape | null;
  drawMode?: 'circle' | 'rect' | null; // two taps draw an area -> 'areaDrawn' message
  emitClicks?: boolean; // send 'mapPress' for every tap
  fitBounds?: boolean; // default true
  tileUrl?: string;
  maxZoom?: number;
}

export function buildLeafletHtml(opts: LeafletOptions): string {
  const {
    center, zoom = 12, markers = [], showUser = false, pickMode = false, polyline = [], shape = null,
    drawMode = null, emitClicks = false, fitBounds = true,
    tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom = 19,
  } = opts;
  const cfg = JSON.stringify({
    center, zoom, markers, showUser, pickMode, emitClicks, fitBounds, tileUrl, maxZoom, drawMode, shape,
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
    var bounds = [];

    if (C.showUser) {
      L.marker([C.center.lat, C.center.lng], { icon: L.divIcon({ className:'', html:'<div class="user-dot"></div>', iconSize:[14,14], iconAnchor:[7,7] }) }).addTo(map);
    }

    if (C.polyline.length > 1) {
      L.polyline(C.polyline, { color:'#E05F36', weight:5, opacity:0.85 }).addTo(map);
      bounds = bounds.concat(C.polyline);
    }

    function drawShape(s, style){
      if (!s) return null;
      if (s.type === 'circle') return L.circle([s.lat, s.lng], Object.assign({ radius: s.radiusM }, style)).addTo(map);
      return L.rectangle([[s.south, s.west],[s.north, s.east]], style).addTo(map);
    }
    var shapeStyle = { color:'#FF9F43', weight:2, fillColor:'#FF9F43', fillOpacity:0.12 };
    var shapeLayer = drawShape(C.shape, shapeStyle);
    if (shapeLayer) { try { var sb = shapeLayer.getBounds(); bounds.push([sb.getSouth(), sb.getWest()]); bounds.push([sb.getNorth(), sb.getEast()]); } catch(e){} }

    if (C.pickMode) {
      var picked = L.marker([C.center.lat, C.center.lng], { draggable: true, icon: pinIcon('#FF9F43') }).addTo(map);
      picked.on('dragend', function(e){ var ll = e.target.getLatLng(); send({ type:'mapPress', lat: ll.lat, lng: ll.lng }); });
      map.on('click', function(e){ picked.setLatLng(e.latlng); send({ type:'mapPress', lat: e.latlng.lat, lng: e.latlng.lng }); });
    } else {
      C.markers.forEach(function(m){
        var mk = L.marker([m.lat, m.lng], { icon: pinIcon(m.color, m.label) }).addTo(map);
        if (m.title) mk.bindTooltip(m.title);
        mk.on('click', function(){ send({ type:'markerPress', id: m.id }); });
        if (!C.polyline.length && !C.shape) bounds.push([m.lat, m.lng]);
      });
      if (C.emitClicks && !C.drawMode) {
        map.on('click', function(e){ send({ type:'mapPress', lat: e.latlng.lat, lng: e.latlng.lng }); });
      }
    }

    // Two-tap area drawing: circle (center, edge) or rectangle (corner, corner)
    if (C.drawMode) {
      var first = null, firstMk = null, preview = null;
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
        preview = drawShape(s, shapeStyle);
        map.removeLayer(firstMk); first = null;
        send({ type:'areaDrawn', shape: s });
      });
      map.on('mousemove', function(e){
        if (!first) return;
        if (preview) map.removeLayer(preview);
        var s = C.drawMode === 'circle'
          ? { type:'circle', lat: first.lat, lng: first.lng, radiusM: map.distance(first, e.latlng) }
          : { type:'rect', south: Math.min(first.lat, e.latlng.lat), north: Math.max(first.lat, e.latlng.lat), west: Math.min(first.lng, e.latlng.lng), east: Math.max(first.lng, e.latlng.lng) };
        preview = drawShape(s, { color:'#FF9F43', weight:2, dashArray:'6 6', fillOpacity:0.06 });
      });
    }

    if (C.fitBounds && bounds.length > 1) { try { map.fitBounds(bounds, { padding:[30,30], maxZoom: 14 }); } catch(e){} }

    map.on('moveend', function(){ var c = map.getCenter(); send({ type:'view', lat: c.lat, lng: c.lng, zoom: map.getZoom() }); });
    send({ type:'ready' });
  </script>
</body>
</html>`;
}

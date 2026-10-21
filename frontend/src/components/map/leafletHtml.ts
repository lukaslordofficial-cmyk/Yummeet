export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  /** Optional short text shown inside the marker (e.g. "A", "B", "3"). */
  label?: string;
  coverUrl?: string;
  /** Emoji / glyph for cuisine-styled teardrop pins. */
  glyph?: string;
  official?: boolean;
  /** Compass degrees. When set, the marker is a navigation arrow instead of a teardrop. */
  bearing?: number;
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
  polylineColor?: string;
  emitClicks?: boolean;
  fitBounds?: boolean;
  tileUrl?: string;
  maxZoom?: number;
  /** Podczas jazdy: kierowca w dolnej części kadru, kamera jedzie za nim. */
  gps?: boolean;
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
  polylineColor?: string;
  /** Płynne śledzenie z kierowcą w dolnej trzeciej części mapy. */
  gps?: boolean;
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
    polylineColor = "#1A73E8",
    gps = false,
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
    polylineColor,
    gps,
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
    .pin-stack { display:flex; flex-direction:column; align-items:center; gap:2px; }
    .pin-label { max-width:110px; min-height:14px; padding:2px 6px; border-radius:8px; border:1px solid #fff; color:#fff; font:700 10px/12px -apple-system,Segoe UI,Roboto,sans-serif; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.25); box-sizing:border-box; white-space:normal; overflow:hidden; word-break:break-word; max-height:28px; }
    .gpin { position:relative; }
    .gpin svg { display:block; }
    .gpin-face { position:absolute; left:50%; top:14%; transform:translateX(-50%); border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.15); }
    .gpin-face img { width:100%; height:100%; object-fit:cover; display:block; }
    .gpin-glyph { font-size:inherit; line-height:1; }
    .gpin-official { position:absolute; right:-2px; top:2px; width:10px; height:10px; border-radius:50%; background:#D4AF37; border:1.5px solid #fff; box-sizing:border-box; }
    .user-dot { background:#2F7D3E; width:14px; height:14px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 4px rgba(47,125,62,0.25); }
    .draw-dot { background:#FF9F43; width:14px; height:14px; border-radius:50%; border:2px solid #fff; }
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
    var LABEL_ZOOM = 18;
    var map = L.map('map', { zoomControl: true, attributionControl: false, doubleClickZoom: !C.emitClicks }).setView([C.center.lat, C.center.lng], C.zoom);
    L.tileLayer(C.tileUrl, { maxZoom: C.maxZoom, subdomains: 'abc' }).addTo(map);
    if (String(C.tileUrl).indexOf('arcgisonline.com') >= 0) {
      L.control.attribution({ position: 'bottomright', prefix: false }).addAttribution('© Esri').addTo(map);
    }

    function esc(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    /** Mała łezka: kolor widać z daleka, emoji dopiero przy zbliżeniu. */
    function pinScale(z){
      var t = Math.max(0, Math.min(1, (z - 13) / 6));
      var w = Math.round(11 + t * 17);
      var h = Math.round(w * 1.42);
      var face = 0, font = 0;
      if (z >= 17) {
        face = Math.round(w * 0.46);
        font = Math.round(face * 0.72);
        if (font < 7) { face = 0; font = 0; }
      }
      return { w: w, h: h, face: face, font: font, label: z >= LABEL_ZOOM };
    }
    var iconCache = {};
    function navArrow(bearing, color){
      var deg = Math.round(bearing);
      var key = 'arrow|' + color + '|' + (Math.round(deg / 10) * 10);
      if (iconCache[key]) return iconCache[key];
      var icon = L.divIcon({
        className: '',
        html: '<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center">'
          + '<div style="width:34px;height:34px;border-radius:50%;background:rgba(26,115,232,0.22);box-shadow:0 0 0 8px rgba(26,115,232,0.12);display:flex;align-items:center;justify-content:center">'
          + '<div style="transform:rotate('+deg+'deg);line-height:0">'
          + '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 L21 22 L12 16.2 L3 22 Z" fill="'+color+'" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>'
          + '</div></div></div>',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      iconCache[key] = icon;
      return icon;
    }
    function pinIcon(color, label, coverUrl, showLabel, scale, glyph, official){
      var bg = color || '#C9412A';
      var sc = scale || pinScale(13);
      var text = esc(label || '');
      var w = sc.w, h = sc.h, face = sc.face, font = sc.font;
      var usePhoto = !!(coverUrl && face >= 12);
      var g = face > 0 ? esc(glyph || '') : '';
      var withLabel = !!(showLabel && label && sc.label);
      var key = [bg, w, h, face, font, usePhoto ? coverUrl : '', g, official ? 1 : 0, withLabel ? text : ''].join('|');
      if (iconCache[key]) return iconCache[key];
      var faceInner = usePhoto
        ? '<img src="'+esc(coverUrl)+'" alt=""/>'
        : (g ? '<span class="gpin-glyph">'+g+'</span>' : '');
      var badge = official ? '<div class="gpin-official"></div>' : '';
      var box = Math.max(w, 22);
      var boxH = Math.max(h, 22);
      var pinHtml = '<div class="gpin" style="width:'+box+'px;height:'+boxH+'px;display:flex;align-items:flex-end;justify-content:center">'
        + '<div style="position:relative;width:'+w+'px;height:'+h+'px">'
        + '<svg viewBox="0 0 24 36" width="'+w+'" height="'+h+'" aria-hidden="true">'
        + '<path d="M12 1.4C6.7 1.4 2.4 5.7 2.4 11c0 7.4 9.6 23.2 9.6 23.2S21.6 18.4 21.6 11C21.6 5.7 17.3 1.4 12 1.4z" fill="'+bg+'" stroke="#fff" stroke-width="2.4"/>'
        + '</svg>'
        + '<div class="gpin-face" style="width:'+face+'px;height:'+face+'px;font-size:'+font+'px">'+faceInner+'</div>'
        + badge
        + '</div></div>';
      var icon;
      if (withLabel) {
        icon = L.divIcon({
          className: '',
          html: '<div class="pin-stack">'+pinHtml+'<div class="pin-label" style="background:'+bg+'" title="'+text+'">'+text+'</div></div>',
          iconSize: [Math.max(box, 96), boxH + 16],
          iconAnchor: [Math.max(box, 96) / 2, boxH],
        });
      } else {
        icon = L.divIcon({ className:'', html: pinHtml, iconSize:[box, boxH], iconAnchor:[box / 2, boxH] });
      }
      iconCache[key] = icon;
      return icon;
    }

    var markerLayer = L.layerGroup().addTo(map);
    var polyLayer = L.layerGroup().addTo(map);
    var userLayer = L.layerGroup().addTo(map);
    var shapeLayerGroup = L.layerGroup().addTo(map);
    var pickMarker = null;
    var pickModeOn = !!C.pickMode;
    var emitClicksOn = !!C.emitClicks;
    var lastMarkers = C.markers || [];
    var lastPinZoom = null;

    function clearGroup(g){ g.clearLayers(); }

    function renderMarkers(list, force){
      if (list) lastMarkers = list;
      var z = map.getZoom();
      var bucket = Math.round(z);
      if (!force && !list && lastPinZoom === bucket) return;
      lastPinZoom = bucket;
      var scale = pinScale(z);
      var showLabel = z >= LABEL_ZOOM;
      var markers = lastMarkers || [];
      var batch = new Array(markers.length);
      for (var i = 0; i < markers.length; i++) {
        let m = markers[i];
        let icon = (typeof m.bearing === 'number' && isFinite(m.bearing))
          ? navArrow(m.bearing, m.color || '#1A73E8')
          : pinIcon(m.color, m.label, m.coverUrl, showLabel, scale, m.glyph, m.official);
        let mk = L.marker([m.lat, m.lng], { icon: icon, keyboard: false });
        if (m.title) mk.bindTooltip(m.title, { direction: 'top', opacity: 0.95 });
        mk.on('click', function(){ send({ type:'markerPress', id: m.id }); });
        batch[i] = mk;
      }
      map.removeLayer(markerLayer);
      markerLayer = L.layerGroup(batch).addTo(map);
      [userLayer, shapeLayerGroup].forEach(function(group){
        if (map.hasLayer(group)) { map.removeLayer(group); group.addTo(map); }
      });
    }

    var routeColor = C.polylineColor || '#1A73E8';
    function renderPolyline(line){
      clearGroup(polyLayer);
      if (line && line.length > 1) {
        var casing = { weight: 11, opacity: 0.96, lineCap: 'round', lineJoin: 'round' };
        polyLayer.addLayer(L.polyline(line, Object.assign({ color: '#ffffff' }, casing)));
        polyLayer.addLayer(L.polyline(line, Object.assign({ color: routeColor, weight: 6, opacity: 0.95 }, { lineCap: 'round', lineJoin: 'round' })));
      }
    }
    function focusDriver(lat, lng, z, gps){
      var ll = L.latLng(lat, lng);
      var sizeY = map.getSize().y || 0;
      if (gps && sizeY > 40) {
        var pt = map.project(ll, z);
        pt.y -= Math.round(sizeY * 0.22);
        ll = map.unproject(pt, z);
      }
      map.stop();
      map.setView(ll, z, { animate: !!gps, duration: 0.45 });
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
      }
    });
    map.on('dblclick', function(e){
      if (pickModeOn || C.drawMode) return;
      if (emitClicksOn) {
        L.DomEvent.stopPropagation(e);
        send({ type:'mapDblClick', lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });
    map.on('zoomend', function(){ renderMarkers(null); });

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

    if (C.gps) map.whenReady(function(){ focusDriver(C.center.lat, C.center.lng, map.getZoom(), true); });

    if (C.fitBounds) {
      var b = [];
      if (C.polyline && C.polyline.length > 1) b = b.concat(C.polyline);
      (C.markers||[]).forEach(function(m){ b.push([m.lat, m.lng]); });
      if (b.length > 1) { try { map.fitBounds(b, { padding:[30,30], maxZoom: 14 }); } catch(e){} }
    }

    window.__updateMap = function(U){
      if (!U) return;
      if (typeof U.pickMode === 'boolean') pickModeOn = U.pickMode;
      if (typeof U.emitClicks === 'boolean') {
        emitClicksOn = U.emitClicks;
        if (U.emitClicks) map.doubleClickZoom.disable();
        else map.doubleClickZoom.enable();
      }
      if (U.markers) renderMarkers(U.markers);
      if (U.polylineColor) routeColor = U.polylineColor;
      if (U.polyline) {
        var line = U.polyline.map(function(p){ return [p.lat, p.lng]; });
        renderPolyline(line);
      }
      if (U.shape !== undefined) renderShape(U.shape);
      if (U.showUser !== undefined) renderUser(!!U.showUser, U.center || map.getCenter());
      if (pickModeOn && U.center) ensurePickMarker(U.center.lat, U.center.lng);
      if (!pickModeOn && pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
      if (U.setView && U.center) {
        focusDriver(U.center.lat, U.center.lng, U.zoom != null ? U.zoom : map.getZoom(), !!U.gps);
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

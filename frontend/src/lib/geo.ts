// Lightweight geo helpers (no external deps) used by route planning & area search.
export interface LatLng { lat: number; lng: number; }
export interface BBox { south: number; west: number; north: number; east: number; }

export type AreaShape =
  | { type: 'circle'; lat: number; lng: number; radiusM: number }
  | { type: 'rect'; south: number; west: number; north: number; east: number };

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance (m) from point p to segment a-b using a local equirectangular projection. */
function pointToSegmentM(p: LatLng, a: LatLng, b: LatLng): { d: number; t: number } {
  const k = Math.cos(rad(p.lat));
  const ax = a.lng * k, ay = a.lat, bx = b.lng * k, by = b.lat, px = p.lng * k, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = { lat: ay + t * dy, lng: (ax + t * dx) / k };
  return { d: haversineM(p, proj), t };
}

/** Min distance to a polyline + fractional index along it (used to order places "along the way"). */
export function distanceToPolyline(p: LatLng, line: LatLng[]): { distanceM: number; along: number } {
  if (line.length === 0) return { distanceM: Infinity, along: 0 };
  if (line.length === 1) return { distanceM: haversineM(p, line[0]), along: 0 };
  let best = Infinity, along = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const { d, t } = pointToSegmentM(p, line[i], line[i + 1]);
    if (d < best) { best = d; along = i + t; }
  }
  return { distanceM: best, along };
}

export function bboxOf(points: LatLng[], padKm = 0): BBox {
  let south = 90, north = -90, west = 180, east = -180;
  points.forEach((p) => {
    south = Math.min(south, p.lat); north = Math.max(north, p.lat);
    west = Math.min(west, p.lng); east = Math.max(east, p.lng);
  });
  const dLat = padKm / 111;
  const midLat = (south + north) / 2;
  const dLng = padKm / (111 * Math.max(0.1, Math.cos(rad(midLat))));
  return { south: south - dLat, north: north + dLat, west: west - dLng, east: east + dLng };
}

export function shapeBBox(s: AreaShape): BBox {
  if (s.type === 'rect') return { south: s.south, west: s.west, north: s.north, east: s.east };
  return bboxOf([{ lat: s.lat, lng: s.lng }], s.radiusM / 1000);
}

export function inShape(p: LatLng, s: AreaShape): boolean {
  if (s.type === 'rect') return p.lat >= s.south && p.lat <= s.north && p.lng >= s.west && p.lng <= s.east;
  return haversineM(p, { lat: s.lat, lng: s.lng }) <= s.radiusM;
}

/** Keep at most `max` points of a long polyline (uniform sampling, endpoints kept). */
export function simplify(line: LatLng[], max = 600): LatLng[] {
  if (line.length <= max) return line;
  const step = (line.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i++) out.push(line[Math.round(i * step)]);
  return out;
}

/** Greedy nearest-neighbour ordering starting from the first point. */
export function nearestNeighbourOrder<T extends LatLng>(points: T[]): T[] {
  if (points.length < 3) return points;
  const rest = points.slice(1);
  const out: T[] = [points[0]];
  while (rest.length) {
    const last = out[out.length - 1];
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => { const d = haversineM(last, p); if (d < bd) { bd = d; bi = i; } });
    out.push(rest.splice(bi, 1)[0]);
  }
  return out;
}

export function formatKm(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

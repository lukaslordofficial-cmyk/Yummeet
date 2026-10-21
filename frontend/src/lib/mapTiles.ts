// Tile provider (from pinonmap): free OSM-compatible tiles, no API key. Swap here to change provider.
// Note: OSM public tiles have a fair-use policy — for production traffic use a paid/self-hosted tile service.
export const MAP_TILES = { tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19 };

/**
 * Jaśniejsza mapa nawigacji — tylko Gastro-Trasa.
 * Carto Voyager wymaga już klucza. Esri World Street rysuje ulice jak nawigacja samochodowa.
 */
export const ROUTE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

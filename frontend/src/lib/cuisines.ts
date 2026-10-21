export type CuisineOpt = { key: string | null; label: string };

/** Wbudowane kategorie + użytkownik może dopisać własną przy pinie. */
export const CUISINES: CuisineOpt[] = [
  { key: "polish", label: "Polska" },
  { key: "italian", label: "Włoska" },
  { key: "japanese", label: "Japońska" },
  { key: "chinese", label: "Chińska" },
  { key: "asian", label: "Azjatycka" },
  { key: "indian", label: "Indyjska" },
  { key: "thai", label: "Tajska" },
  { key: "vietnamese", label: "Wietnamska" },
  { key: "korean", label: "Koreańska" },
  { key: "mexican", label: "Meksykańska" },
  { key: "american", label: "Amerykańska" },
  { key: "burger", label: "Burgery" },
  { key: "pizza", label: "Pizza" },
  { key: "sushi", label: "Sushi" },
  { key: "seafood", label: "Owoce morza" },
  { key: "steakhouse", label: "Steakhouse" },
  { key: "turkish", label: "Turecka / kebab" },
  { key: "greek", label: "Grecka" },
  { key: "french", label: "Francuska" },
  { key: "spanish", label: "Hiszpańska" },
  { key: "georgian", label: "Gruzińska" },
  { key: "middle_east", label: "Bliski Wschód" },
  { key: "vegan", label: "Wegańska" },
  { key: "gluten_free", label: "Bez glutenu" },
  { key: "cafe", label: "Kawiarnia" },
  { key: "dessert", label: "Desery" },
  { key: "bar", label: "Bar / pub" },
  { key: "wine", label: "Wine bar" },
  { key: "fast_food", label: "Fast food" },
  { key: "brunch", label: "Brunch" },
  { key: "international", label: "Międzynarodowa" },
  { key: "bakery_only", label: "Piekarnia" },
  { key: "pastry", label: "Cukiernia" },
  { key: "food_share", label: "Jadłodzielnia" },
  { key: "other", label: "Inne" },
];

/** Tagi oferty (obok kategorii kuchni) — misje Detektywa / Strażnika. */
export const PIN_TAGS: { key: string; label: string }[] = [
  { key: "tanie", label: "Tanie" },
  { key: "happy_hour", label: "Happy-Hour" },
  { key: "duze_porcje", label: "Duże porcje" },
  { key: "wegetarianskie", label: "Wegetariańskie" },
  { key: "weganskie", label: "Wegańskie" },
  { key: "bezglutenowe", label: "Bezglutenowe" },
  { key: "nocne", label: "Nocne" },
  { key: "grupowe", label: "Grupowe" },
  { key: "sniadania", label: "Śniadania" },
  { key: "tgtg", label: "Paczki TGTG" },
  { key: "przeceny", label: "Przeceny" },
  { key: "deser", label: "Deser" },
];

/** Stare piny zostają na mapie, ale tych kategorii nie ma już w filtrze. */
const RETIRED_CUISINE_LABELS: Record<string, string> = {
  vegetarian: "Wegetariańska",
  bakery: "Piekarnia / cukiernia",
  street_food: "Street food",
  food_truck: "Food truck",
  fine_dining: "Fine dining",
};

export function cuisineLabel(key: string | null | undefined): string {
  if (!key) return "lokal";
  return CUISINES.find((c) => c.key === key)?.label ?? RETIRED_CUISINE_LABELS[key] ?? key;
}

export type CuisinePinStyle = { color: string; glyph: string };

/** Kolor + glyph łezki na mapie — każdy styl kulinarny ma własny znacznik. */
const CUISINE_PINS: Record<string, CuisinePinStyle> = {
  polish: { color: "#C41E3A", glyph: "🥟" },
  italian: { color: "#008C45", glyph: "🍝" },
  japanese: { color: "#1B1B1B", glyph: "🍱" },
  chinese: { color: "#D42B2B", glyph: "🥡" },
  asian: { color: "#0F766E", glyph: "🍜" },
  indian: { color: "#E07C24", glyph: "🍛" },
  thai: { color: "#7C3AED", glyph: "🍲" },
  vietnamese: { color: "#15803D", glyph: "🥗" },
  korean: { color: "#B91C1C", glyph: "🥘" },
  mexican: { color: "#EA580C", glyph: "🌮" },
  american: { color: "#1D4ED8", glyph: "🌭" },
  burger: { color: "#92400E", glyph: "🍔" },
  pizza: { color: "#DC2626", glyph: "🍕" },
  sushi: { color: "#0F172A", glyph: "🍣" },
  seafood: { color: "#0284C7", glyph: "🦐" },
  steakhouse: { color: "#7C2D12", glyph: "🥩" },
  turkish: { color: "#B45309", glyph: "🥙" },
  greek: { color: "#1D4ED8", glyph: "🫒" },
  french: { color: "#1E3A8A", glyph: "🥐" },
  spanish: { color: "#C2410C", glyph: "🥘" },
  georgian: { color: "#9F1239", glyph: "🧀" },
  middle_east: { color: "#A16207", glyph: "🧆" },
  vegetarian: { color: "#16A34A", glyph: "🥬" },
  vegan: { color: "#65A30D", glyph: "🌱" },
  gluten_free: { color: "#CA8A04", glyph: "🌾" },
  cafe: { color: "#78350F", glyph: "☕" },
  bakery: { color: "#DB2777", glyph: "🧁" },
  bakery_only: { color: "#BE185D", glyph: "🍞" },
  pastry: { color: "#E11D48", glyph: "🍰" },
  dessert: { color: "#EC4899", glyph: "🍨" },
  bar: { color: "#6B21A8", glyph: "🍺" },
  wine: { color: "#7F1D1D", glyph: "🍷" },
  fast_food: { color: "#F59E0B", glyph: "🍟" },
  street_food: { color: "#F97316", glyph: "🌯" },
  food_truck: { color: "#0891B2", glyph: "🚚" },
  fine_dining: { color: "#111827", glyph: "🥂" },
  brunch: { color: "#FB7185", glyph: "🥞" },
  international: { color: "#0D9488", glyph: "🌍" },
  food_share: { color: "#22C55E", glyph: "♻️" },
  other: { color: "#C9412A", glyph: "🍽️" },
};

const FALLBACK_PIN_COLORS = ["#C9412A", "#2F7D3E", "#0F766E", "#B7791F", "#722F37", "#2E8B57", "#A0153E", "#1D4ED8"];

function hashHue(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_PIN_COLORS[h % FALLBACK_PIN_COLORS.length];
}

export function cuisinePinStyle(key: string | null | undefined): CuisinePinStyle {
  if (!key) return { color: "#C9412A", glyph: "🍽️" };
  return CUISINE_PINS[key] ?? { color: hashHue(key), glyph: "🍴" };
}

/** Slug z własnej nazwy kategorii. */
export function customCuisineKey(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return s || "custom";
}

export type CuisineOpt = { key: string | null; label: string };

/** Wbudowane kategorie + użytkownik może dopisać własną przy pinie. */
export const CUISINES: CuisineOpt[] = [
  { key: null, label: "Wszystko" },
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
  { key: "vegetarian", label: "Wegetariańska" },
  { key: "vegan", label: "Wegańska" },
  { key: "gluten_free", label: "Bez glutenu" },
  { key: "cafe", label: "Kawiarnia" },
  { key: "bakery", label: "Piekarnia / cukiernia" },
  { key: "dessert", label: "Desery" },
  { key: "bar", label: "Bar / pub" },
  { key: "wine", label: "Wine bar" },
  { key: "fast_food", label: "Fast food" },
  { key: "street_food", label: "Street food" },
  { key: "food_truck", label: "Food truck" },
  { key: "fine_dining", label: "Fine dining" },
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

export function cuisineLabel(key: string | null | undefined): string {
  if (!key) return "lokal";
  return CUISINES.find((c) => c.key === key)?.label ?? key;
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

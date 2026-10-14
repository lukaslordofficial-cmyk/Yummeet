/** 14 alergenów UE + brak — do ofert Jedzenie. */
export const FOOD_ALLERGENS = [
  { key: "gluten", label: "Zboża zawierające gluten (pszenica, żyto, jęczmień, owies)" },
  { key: "milk", label: "Mleko i nabiał (w tym laktoza)" },
  { key: "eggs", label: "Jaja" },
  { key: "fish", label: "Ryby" },
  { key: "crustaceans", label: "Skorupiaki (krewetki, kraby, homary)" },
  { key: "molluscs", label: "Mięczaki (małże, kalmary, ośmiornice)" },
  { key: "nuts", label: "Orzechy (włoskie, laskowe, nerkowce, migdały itp.)" },
  { key: "peanuts", label: "Orzeszki ziemne (arachidowe)" },
  { key: "soy", label: "Soja" },
  { key: "celery", label: "Seler" },
  { key: "mustard", label: "Gorczyca (składnik musztardy, marynat i wędlin)" },
  { key: "sesame", label: "Nasiona sezamu" },
  { key: "lupin", label: "Łubin (częsty w żywności wege i bezglutenowej)" },
  { key: "sulphites", label: "Dwutlenek siarki i siarczyny (suszone owoce, wino)" },
  { key: "none", label: "Brak alergenów" },
] as const;

export type AllergenKey = (typeof FOOD_ALLERGENS)[number]["key"];

export function allergenLabel(key: string): string {
  return FOOD_ALLERGENS.find((a) => a.key === key)?.label ?? key;
}

/** Zaznaczanie: „Brak alergenów” wyklucza pozostałe. */
export function toggleAllergen(selected: string[], key: string): string[] {
  if (key === "none") return selected.includes("none") ? [] : ["none"];
  const withoutNone = selected.filter((k) => k !== "none");
  return withoutNone.includes(key) ? withoutNone.filter((k) => k !== key) : [...withoutNone, key];
}

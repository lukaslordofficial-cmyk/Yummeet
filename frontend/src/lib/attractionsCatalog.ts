export type AttractionCategory = "questions" | "games" | "challenges";

export const ATTR_CATEGORY_HINTS: Record<AttractionCategory, string> = {
  questions:
    "Organizator dodaje pytania do wspólnej puli. Każdy uczestnik losuje pytania, na które odpowiada. Liczbę ustala organizator.",
  games: "Gry towarzyskie na speed friending: dwie prawdy, znajdź kogoś, wspólna historia i zgadywanie.",
  challenges: "Wyzwania zostały wycofane z planu spotkania.",
};

export const TABLE_ATTRACTION_TABS: { key: Exclude<AttractionCategory, "challenges">; label: string }[] = [
  { key: "questions", label: "Pytania" },
  { key: "games", label: "Gry towarzyskie" },
];

export type AttractionSuggestion = {
  id: string;
  category: AttractionCategory;
  title: string;
  body: string;
  sort: number;
};

export { FALLBACK_ATTRACTIONS, fallbackAttractions } from "./meetingPlan";

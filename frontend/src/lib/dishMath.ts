/** Średnia karty dania: średnia wypełnionych cech 1–10. Puste cechy nie wchodzą do liczenia. */

export const DISH_AXES = [
  ["taste", "Smak"],
  ["look", "Wygląd"],
  ["texture", "Tekstura"],
  ["aroma", "Aromat"],
  ["composition", "Kompozycja"],
  ["technique", "Technika"],
  ["value", "Cena/jakość"],
] as const;

export type DishAxis = (typeof DISH_AXES)[number][0];
export type DishScores = Partial<Record<DishAxis, number | null>>;

export function cardScore(row: DishScores): number | null {
  const vals = DISH_AXES.map(([key]) => row[key]).filter((n): n is number => typeof n === "number" && n >= 1 && n <= 10);
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

export type DishCard = DishScores & { name: string; description?: string | null; note?: string | null };

/** Jedna pozycja na nazwę dania. Średnia z kart, liczba to liczba kart. */
export function summarizeDishes(cards: DishCard[]) {
  const groups = new Map<string, { name: string; description: string; scores: number[]; count: number }>();
  for (const card of cards) {
    const score = cardScore(card);
    if (score == null) continue;
    const key = card.name.trim().toLocaleLowerCase("pl");
    const cur = groups.get(key) ?? { name: card.name.trim(), description: "", scores: [], count: 0 };
    if (card.description?.trim()) cur.description = card.description.trim();
    cur.scores.push(score);
    cur.count += 1;
    groups.set(key, cur);
  }
  return [...groups.values()].map((g) => ({
    name: g.name,
    description: g.description,
    average: Math.round((g.scores.reduce((a, b) => a + b, 0) / g.scores.length) * 10) / 10,
    ratingCount: g.count,
  })).sort((a, b) => b.average - a.average || b.ratingCount - a.ratingCount);
}

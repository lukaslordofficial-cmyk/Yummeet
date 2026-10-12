export type AttractionCategory = "questions" | "games" | "challenges";

export const ATTR_CATEGORY_HINTS: Record<AttractionCategory, string> = {
  questions:
    "Pytania do gości przy stole — ice-breakery, kulinarne, osobiste (np. ulubione danie, podróże, anegdoty). Możesz wybrać propozycje albo dopisać własne.",
  games:
    "Gry i zabawy na spotkanie: planszowe, karciane, ruchowe, komputerowe (szachy, makao, Twister, LoL…). Wybierz, w co chcecie grać.",
  challenges:
    "Wyzwania / warunki udziału przy stole — np. 20 pompek, zamówienie nowego dania, krótka anegdota. Gość wie, czego się spodziewać.",
};

export type AttractionSuggestion = {
  id: string;
  category: AttractionCategory;
  title: string;
  body: string;
  sort: number;
};

/** Lokalne propozycje — działają nawet gdy tabela w Supabase jeszcze nie istnieje. */
export const FALLBACK_ATTRACTIONS: AttractionSuggestion[] = [
  { id: "fq1", category: "questions", title: "Ulubione danie z dzieciństwa?", body: "Co gotowano u Ciebie w domu najczęściej?", sort: 1 },
  { id: "fq2", category: "questions", title: "Gdybyś otworzył restaurację…", body: "Jaki motyw przewodni i danie specjalności?", sort: 2 },
  { id: "fq3", category: "questions", title: "Podróż smaków", body: "Jakie miasto zaskoczyło Cię kulinarne najbardziej?", sort: 3 },
  { id: "fq4", category: "questions", title: "Najdziwniejsze danie", body: "Co zamówiłeś/aś „na odwagę” i jak wyszło?", sort: 4 },
  { id: "fg1", category: "games", title: "Szachy", body: "Klasyczna partia — 15–20 min na rundę.", sort: 1 },
  { id: "fg2", category: "games", title: "Makao", body: "Karcianka dla 3–6 osób.", sort: 2 },
  { id: "fg3", category: "games", title: "Twister", body: "Wymaga miejsca na podłodze / na zewnątrz.", sort: 3 },
  { id: "fg4", category: "games", title: "League of Legends", body: "Wspólny ranked po kolacji.", sort: 4 },
  { id: "fc1", category: "challenges", title: "20 pompek", body: "Zrób 20 pompek, zanim usiądziesz do stołu.", sort: 1 },
  { id: "fc2", category: "challenges", title: "Zamów coś nowego", body: "Danie, którego nigdy nie próbowałeś.", sort: 2 },
  { id: "fc3", category: "challenges", title: "Opowiedz anegdotę", body: "30 sekund o najgorszej kolacji w życiu.", sort: 3 },
];

export function fallbackAttractions(category: AttractionCategory): AttractionSuggestion[] {
  return FALLBACK_ATTRACTIONS.filter((a) => a.category === category).sort((a, b) => a.sort - b.sort);
}

/** Katalog spotkań. Szablon jest tylko podpowiedzią — wydarzenie trzyma własną kopię. */

export type MeetingFormat = "standard" | "one_dish" | "shared_dishes";

export type MeetingTemplate = {
  key: string;
  name: string;
  blurb: string;
  capacity: number;
  durationMin: number;
  agenda: string[];
};

export type MeetingSubcategory = {
  key: string;
  label: string;
  blurb: string;
  /** Rodzaj zapisywany w events.kind, żeby stary zapis i check-in dalej działały. */
  kind: string;
  format: MeetingFormat;
  templates: MeetingTemplate[];
};

export type MeetingCategory = {
  key: string;
  label: string;
  blurb: string;
  subs: MeetingSubcategory[];
};

const idea = (
  key: string, name: string, blurb: string, capacity: number, durationMin: number, agenda: string[],
): MeetingTemplate => ({ key, name, blurb, capacity, durationMin, agenda });

export const MEETING_CATEGORIES: MeetingCategory[] = [
  {
    key: "poznaj",
    label: "Speed Friending",
    blurb: "Poznawanie nowych ludzi, poprzez rozmowy lub gry i zabawy towarzyskie",
    subs: [
      {
        key: "otwarty_stol", label: "Otwarty stół", kind: "open_table", format: "standard",
        blurb: "Luźne spotkanie przy wspólnym stole — każdy może dołączyć.",
        templates: [],
      },
      {
        key: "nowi_w_miescie", label: "Nowi w mieście", kind: "open_table", format: "standard",
        blurb: "Dla osób, które dopiero się wprowadziły i szukają towarzystwa.",
        templates: [],
      },
      {
        key: "kolacja_nieznajomych", label: "Kolacja dla nieznajomych", kind: "dinner", format: "standard",
        blurb: "Wspólny posiłek bez wcześniejszej znajomości.",
        templates: [],
      },
    ],
  },
  {
    key: "randki",
    label: "Randki",
    blurb: "Spotkania tylko we dwoje lub speed dating.",
    subs: [
      {
        key: "randka_w_lokalu", label: "Randka w lokalu", kind: "dinner", format: "standard",
        blurb: "Spokojne spotkanie we dwoje w publicznym miejscu.",
        templates: [idea("dwoje", "Kolacja we dwoje", "Jedno miejsce, dwie osoby, bez niespodzianek.", 2, 90, ["Wybierz lokal publiczny", "Ustal godzinę", "Po spotkaniu każdy decyduje sam"])],
      },
      {
        key: "speed_dating", label: "Speed dating", kind: "speed_friending", format: "standard",
        blurb: "Kilka krótkich rozmów i zmiana miejsc.",
        templates: [idea("speed", "Speed dating przy stole", "Rundy we dwoje, potem wspólna przerwa.", 10, 80, ["Pary przy stolikach", "5 minut rozmowy", "Zmiana miejsc", "Przerwa i swobodne zostawanie"])],
      },
      {
        key: "degustacja_we_dwoje", label: "Degustacja we dwoje", kind: "dinner", format: "standard",
        blurb: "Wspólne danie na spokojnym spotkaniu. To nie jest karta krytyka.",
        templates: [idea("wspolne", "Jedno danie na spółkę", "Zamawiacie coś do podziału i rozmawiacie.", 2, 80, ["Wybierz lokal", "Jedno danie do podziału", "Reszta wieczoru bez programu"])],
      },
    ],
  },
  {
    key: "oceniaj",
    label: "Oceniaj restauracje",
    blurb: "Zbierz grupę degustatorów i oceniajcie razem potrawy z wybranego lokalu.",
    subs: [
      {
        key: "jedno_danie", label: "Jedno danie, wiele opinii", kind: "tasting", format: "one_dish",
        blurb: "Cała grupa zamawia to samo danie i każdy wypełnia własną kartę.",
        templates: [idea("jedno", "To samo danie", "Jedna pozycja z menu, wiele niezależnych ocen.", 6, 75, ["Wybierz lokal i danie", "Każdy zamawia tę samą pozycję", "Karta dania w telefonie", "Porównanie średniej"])],
      },
      {
        key: "wiele_dan", label: "Wiele dań i dzielenie porcji", kind: "tasting", format: "shared_dishes",
        blurb: "Różne dania na stole. Porcje krążą, każdy ocenia to, czego spróbował.",
        templates: [idea("dzielenie", "Stół do dzielenia", "Kilka dań, wspólne próbowanie, osobne karty.", 6, 100, ["Ustal listę dań", "Podzielcie porcje", "Oceń tylko to, czego próbowałeś", "Ulubieniec grupy po średniej"])],
      },
    ],
  },
  {
    key: "gry",
    label: "Gry i rozrywka",
    blurb: "Jedzenie jest pretekstem. Gra jest powodem, żeby zostać dłużej.",
    subs: [
      { key: "planszowe", label: "Planszowe", kind: "open_table", format: "standard", blurb: "Planszówka przy jedzeniu, także dla osób, które grają pierwszy raz.", templates: [idea("plansza", "Jedna planszówka", "Organizator przynosi grę i tłumaczy zasady.", 5, 120, ["Wybierz grę na 60–90 min", "Krótkie zasady przed jedzeniem", "Partia przy stole"])] },
      { key: "karciane", label: "Karciane", kind: "open_table", format: "standard", blurb: "Talia kart i kilka osób. Bez własnego sprzętu.", templates: [idea("karty", "Karty na stole", "Jedna prosta gra, którą da się wyjaśnić w pięć minut.", 6, 90, ["Ustal grę", "Rozdanie po zamówieniu", "Kolejna partia, jeśli stół chce"])] },
      { key: "szachy", label: "Szachy", kind: "open_table", format: "standard", blurb: "Partie dla grających i dla osób, które dopiero siadają.", templates: [idea("szachy", "Szachy przy kawie", "Kilka szachownic, tempo krótkie.", 8, 90, ["Szachownice na stole", "Partie po 10–15 min", "Można tylko oglądać"])] },
      { key: "komputerowe", label: "Komputerowe", kind: "open_table", format: "standard", blurb: "Wspólna gra po jedzeniu albo w lokalu, który na to pozwala.", templates: [idea("ekran", "Wspólna gra", "Ustalcie tytuł wcześniej, żeby każdy mógł dołączyć.", 5, 120, ["Tytuł i platforma w opisie", "Jedzenie najpierw", "Jedna sesja po posiłku"])] },
      { key: "inne", label: "Inne", kind: "open_table", format: "standard", blurb: "Quiz, karaoke albo coś, czego nie ma na liście.", templates: [idea("luz", "Wieczór bez kategorii", "Organizator opisuje, co właściwie będzie się działo.", 8, 90, ["Napisz w opisie, na czym polega spotkanie", "Spotkanie w miejscu publicznym"])] },
    ],
  },
  {
    key: "pasje",
    label: "Pasje i wspólne działanie",
    blurb: "Nauka języków, wymiana umiejętności lub przedmiotów, wolontariat lokalny i wiele innych.",
    subs: [
      { key: "jezyki", label: "Rozmowa w językach obcych", kind: "open_table", format: "standard", blurb: "Ćwiczenie języka przy jedzeniu. Poziom napisz w opisie.", templates: [idea("jezyk", "Stół językowy", "Jeden język, mieszane poziomy.", 8, 90, ["Język i poziom w tytule", "Krótkie pary", "Wspólna rozmowa pod koniec"])] },
      { key: "wolontariat", label: "Wolontariat", kind: "volunteer", format: "standard", blurb: "Konkretna, mała pomoc. Miejsce i zakres w opisie.", templates: [idea("akcja", "Mała akcja", "Jedno zadanie, które da się skończyć tego dnia.", 8, 150, ["Opisz, co dokładnie robicie", "Spotkanie w miejscu publicznym", "Krótki koniec: co zostało zrobione"])] },
      { key: "wymiana", label: "Wymiana ugotowanych potraw", kind: "food_exchange", format: "standard", blurb: "Każdy przynosi coś swojego i bierze coś od innych.", templates: [idea("garnek", "Wymiana garnków", "Porcja do podziału, alergeny w opisie.", 8, 90, ["Każdy przynosi jedną rzecz", "Alergeny napisane przy daniu", "Wymiana i krótka historia przepisu"])] },
      { key: "inne", label: "Inne", kind: "open_table", format: "standard", blurb: "Pasja, której nie ma wyżej. Opisz ją w tytule.", templates: [idea("swoje", "Własny temat", "Tytuł mówi, po co się schodzicie.", 6, 90, ["Tytuł i opis wystarczą", "Miejsce publiczne", "Reszta według grupy"])] },
    ],
  },
];

export function categoryByKey(key: string | null | undefined) {
  return MEETING_CATEGORIES.find((c) => c.key === key) ?? null;
}

export function subcategoryByKey(categoryKey: string | null | undefined, subKey: string | null | undefined) {
  return categoryByKey(categoryKey)?.subs.find((s) => s.key === subKey) ?? null;
}

export function subcategoryLabel(subKey: string | null | undefined) {
  if (!subKey) return null;
  for (const c of MEETING_CATEGORIES) {
    const sub = c.subs.find((s) => s.key === subKey);
    if (sub) return sub.label;
  }
  return null;
}

export function isTastingFormat(format: MeetingFormat | null | undefined) {
  return format === "one_dish" || format === "shared_dishes";
}

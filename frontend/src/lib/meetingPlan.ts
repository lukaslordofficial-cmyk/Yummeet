import type { AttractionCategory, AttractionSuggestion } from "./attractionsCatalog";

export const PLAN_NOTE_TITLE = "Notatka organizatora";
export const PLAN_LIMIT_TITLE = "Pytania na osobę";
export const CUSTOM_PROMPT_PREFIX = "Znajdź kogoś: ";
export const QUESTION_RULES =
  "Organizator dodaje pytania do wspólnej puli. Każdy uczestnik losuje po jednym pytaniu, na które może odpowiedzieć. Organizator ustala, ile pytań może wylosować każda osoba.";

export const ACTIVITY_LINE = "Zabawa w pytania";

export function gameActivityLine(title: string) {
  return title;
}

export function questionInstruction(limit: number) {
  return `Instrukcja: Organizator dodaje pytania do puli. Każdy uczestnik losuje pytania, na które może udzielić odpowiedzi, ale nie musi. Pytań na osobę ${limit}.`;
}

const GAME_INSTRUCTIONS: Record<string, string> = {
  "two-truths": "Instrukcja: Każdy podaje trzy zdania o sobie. Dwie są prawdziwe, jedna zmyślona. Reszta typuje kłamstwo, a organizator może podać telefon dalej.",
  "find-someone": "Instrukcja: Każdy typuje osobę do zdania. Wskazana osoba może odpowiedzieć „to prawda”, „to nieprawda” albo „pasuję”, ale nie musi zdradzać sekretu.",
  "runaway-story": "Instrukcja: Organizator wybiera zdanie startowe. Każdy dopisuje dokładnie jedno zdanie i zostawia haczyk dla kolejnej osoby. Aplikacja pilnuje kolejki.",
};

export function gameInstruction(title: string) {
  const game = SOCIAL_GAMES.find((entry) => entry.title === title);
  return (game && GAME_INSTRUCTIONS[game.id]) || "";
}

export function isActivityParagraph(text: string) {
  const line = text.trim();
  return line.startsWith("Organizator przeprowadzi dla uczestników") || line === ACTIVITY_LINE || SOCIAL_GAMES.some((game) => game.title === line);
}

export const BUILTIN_QUESTIONS = [
  "Jaką najgłupszą rzecz zrobiłeś/aś, próbując komuś zaimponować?",
  "Jaka jest twoja najbardziej absurdalna historia z imprezy?",
  "Jaki był twój najgorszy zakup pod wpływem impulsu?",
  "Jaki jest najbardziej absurdalny powód, dla którego kiedyś się obraziłeś/aś?",
  "Za co znajomi najbardziej cię cenią, a za co najczęściej mają cię dość?",
  "Jaka cecha u innych ludzi natychmiast cię do nich przekonuje?",
  "Jaką zakazaną rzecz byś zrobił/a, gdybyś wiedział/a że na pewno ujdzie ci to na sucho?",
  "Gdybyś mógł/mogła wybrać jedną super-moc, co byś wybrał/a i dlaczego?",
  "Jaki najbardziej spontaniczny pomysł rzeczywiście zrealizowałeś/aś?",
  "Którą ze znanych i żyjących osób zaprosiłbyś na randkę i dlaczego?",
  "Którą sławną ale nieżyjącą już osobą, z dowolnych czasów, wybrałbyś/wybrałabyś na partnera/partnerkę i dlaczego?",
  "Gdyby złota rybka dała ci tylko jedno życzenie, ale nie mógłbyś poprosić o nic dla siebie, co byś wybrał/a i dlaczego?",
  "Gdybyś mógł/mogła wysłać teraz do piekła jedną osobę, kogo posłałbyś do diabła i dlaczego?",
  "Kiedy ostatnio zrobiłeś/aś coś pierwszy raz w życiu i co to było?",
  "Jak wyglądałby twój idealny dzień bez obowiązków?",
  "Jaka jest najbardziej kompromitująca rzecz, na której ktoś cię przyłapał?",
  "Gdybyś mógł na jeden dzień zamienić się życiem z dowolną osobą na świecie, kim byś został i co zrobił jako pierwsze?",
  "Gdybyś mógł usunąć z rzeczywistości jedną powszechnie akceptowaną zasadę społeczną, co by to było i dlaczego?",
  "Gdybyś dostał milion złotych, ale musiał je wydać w 24 godziny na coś, czego nie można później odsprzedać, co byś zrobił?",
  "Gdybyś miał stworzyć własne święto narodowe, co byśmy wtedy obchodzili i jak wyglądałaby ta uroczystość?",
] as const;

export type SocialGame = { id: string; title: string; blurb: string; rules: string };

export const SOCIAL_GAMES: SocialGame[] = [
  {
    id: "two-truths",
    title: "Dwie prawdy i jedno kłamstwo",
    blurb: "Każdy podaje trzy rzeczy o sobie. Reszta wskazuje kłamstwo.",
    rules: "Każdy uczestnik mówi o sobie trzy rzeczy. Dwie są prawdziwe, jedna zmyślona. Zapisuje, co jest prawdą, a co kłamstwem. Pozostali typują, które zdanie jest kłamstwem. Jeśli nikt nie zgadnie, grupa zrzuca się na napój albo przekąskę wybraną przez autora rundy — bez obowiązku alkoholu. Kolejność ustala organizator: losowo, alfabetycznie albo od najstarszej osoby.\n\nNa jednym telefonie: autor wpisuje trzy zdania i zaznacza kłamstwo. Grupa typuje, zanim aplikacja odkryje odpowiedź. Trafiony typ daje punkt. Tryb bez punktów też jest dostępny. Tajne głosy z kilku telefonów naraz będą w kolejnym etapie.",
  },
  {
    id: "find-someone",
    title: "Znajdź kogoś, kto…",
    blurb: "Typujesz osoby do zdań, a one mówią: prawda, nieprawda albo pasuję.",
    rules: "Każdy dostaje listę cech. Dopisuje osobę, do której jego zdaniem pasuje opis, czyta zdanie na głos, a wskazana osoba odpowiada: „to prawda”, „to nieprawda” albo „pasuję”. Prawda daje typującemu +1 punkt, nieprawda −1. „Pasuję” nie zmienia wyniku i nie wymaga sekretu. Można wstrzymać się od typowania. Osoba z największą liczbą punktów może poprosić o napój lub przekąskę, na które składa się reszta. Domyślnie nie wskazuje się siebie.",
  },
  {
    id: "runaway-story",
    title: "Historia, która wymknęła się spod kontroli",
    blurb: "Jedna wspólna opowieść. Każde zdanie zostawia haczyk dla kolejnej osoby.",
    rules: "Grupa tworzy jedną historię. Organizator wybiera albo losuje zdanie startowe. Każdy dopisuje dokładnie jedno zdanie: rozwija to, co było, i zostawia haczyk, czyli początek myśli dla następnej osoby. Nie wolno unieważniać wcześniejszych wydarzeń. Można pokazać, że znaczyły coś innego. Nie planujemy zakończenia. Po rundzie grupa może nadać historii tytuł.\n\nDopisz ciąg dalszy, ale nie zostawiaj następnej osobie pustej kartki. Zostaw jej haczyk. W tej wersji zdania wpisujecie ręcznie. Aplikacja pilnuje kolejki, zapisuje historię i oznacza kolorem, kto co dopisał. Dyktowanie będzie w wersji premium.",
  },
];

export type PromptPack = { id: string; title: string; prompts: string[] };

export const FIND_PACKS: PromptPack[] = [
  {
    id: "weird",
    title: "Podejrzani o dziwne akcje",
    prompts: [
      "…najprawdopodobniej ma na koncie historię, której nie opowiedziałby przy własnej rodzinie.",
      "…kiedyś zrobił coś tak głupiego, że do dziś zastanawia się, jakim cudem uszło mu to na sucho.",
      "…najprawdopodobniej ma w telefonie zdjęcie, którego pochodzenia sam nie potrafi już wyjaśnić.",
      "…mógłby napisać autobiografię, ale połowę historii trzeba by ocenzurować.",
      "…ma jakąś absurdalną umiejętność, o której nie wspomniałby podczas rozmowy o pracę.",
    ],
  },
  {
    id: "flirt",
    title: "Miłość, flirt i romantyczne katastrofy",
    prompts: [
      "…potrafiłby wrócić do byłego partnera, mimo że wcześniej przysięgał wszystkim, że nigdy więcej.",
      "…najprawdopodobniej ma za sobą randkę, którą można by przerobić na komedię romantyczną z kategorią wiekową 18+.",
      "…najłatwiej dałby się namówić na spontaniczną randkę z nieznajomym.",
      "…mógłby mieć najbardziej zaskakującą historię o tym, jak poznał swojego byłego partnera lub byłą partnerkę.",
    ],
  },
  {
    id: "secrets",
    title: "Kto tu coś ukrywa?",
    prompts: [
      "…ma największą szansę prowadzić jakieś hobby, zainteresowanie lub fascynację, o których mało kto tutaj by pomyślał.",
      "…potrafiłby zachować pokerową twarz, nawet gdyby wszyscy wokół wiedzieli, że kłamie.",
      "…najlepiej poradziłby sobie w podwójnym życiu, gdyby nagle musiał prowadzić dwie zupełnie różne tożsamości.",
    ],
  },
  {
    id: "ego",
    title: "Ego, ambicja i podejrzane decyzje",
    prompts: [
      "…najprawdopodobniej wydał kiedyś pieniądze na coś tak bezsensownego, że do dziś nie potrafi tego racjonalnie uzasadnić.",
      "…potrafiłby rzucić wszystko i wyjechać, gdyby wpadł na wystarczająco szalony pomysł.",
      "…najłatwiej przekonałby innych, że ma wszystko pod kontrolą, chociaż improwizowałby na bieżąco.",
      "…potrafiłby dla realizacji marzenia zaryzykować coś, czego większość ludzi nie odważyłaby się poświęcić.",
      "…najprędzej kupiłby bilet w jedną stronę, zanim jeszcze sprawdziłby, gdzie dokładnie leci.",
    ],
  },
  {
    id: "most",
    title: "Kto jest najbardziej…?",
    prompts: [
      "…najprędzej zostałby wyrzucony z reality show za powiedzenie na głos tego, co wszyscy myślą.",
      "…najprędzej przypadkiem stałby się lokalną legendą po jednej imprezie.",
      "…najbardziej prawdopodobnie miałby własną sektę, gdyby przez przypadek zyskał zbyt wielu obserwujących.",
    ],
  },
  {
    id: "psych",
    title: "Psychologiczne strzały w ciemno",
    prompts: [
      "…najprędzej zerwałby kontakt bez wyjaśnienia, gdyby ktoś przekroczył jego granice.",
      "…najtrudniej przyznałby się do tego, że czegoś nie potrafi.",
      "…najprawdopodobniej ma marzenie, które odkłada tak długo, że zaczyna się przyzwyczajać do myśli, że go nie spełni.",
      "…najłatwiej wybacza innym błędy, ale sobie przypomina je przez następne dziesięć lat.",
    ],
  },
];

export const TRUTH_HINTS = [
  "najdziwniejsza praca",
  "nieoczekiwany talent",
  "wpadka z przeszłości",
  "danie, którego żałujesz",
  "podróż, która wymknęła się spod kontroli",
];

export const STORY_HOOKS = [
  "…ale wtedy okazało się, że…",
  "…i właśnie wtedy ktoś…",
  "…a największym problemem było to, że…",
  "…po czym usłyszałem słowa, których nigdy nie zapomnę:",
  "…jednak nikt nie wiedział, że…",
  "…właśnie wtedy do pokoju wszedł ktoś, kto…",
  "…a kiedy otworzyłem kopertę, zobaczyłem…",
  "…wtedy z telefonu dobiegł głos, który oznajmił, że…",
];

export const STORY_WORDS: Record<"rzeczownik" | "czasownik" | "nazwa", string[]> = {
  rzeczownik: ["paragon", "teściowa", "helikopter", "ziemniak", "korona", "walizka", "gołąb", "fasola", "traktor", "kebab"],
  czasownik: ["zdradzić", "uciec", "zapukać", "podpisać", "zgubić", "przywołać", "ewakuować"],
  nazwa: ["Bałkany", "Europa", "poniedziałek", "komendant", "cesarz"],
};

export const STORY_STARTERS: { title: string; text: string }[] = [
  { title: "Sąsiad i nielegalny biznes", text: "W poniedziałek rano odkryłem/am, że mój sąsiad od trzech lat prowadzi nielegalny biznes, ale najdziwniejsze było to, że jego klientami byli wszyscy mieszkańcy naszej ulicy. Kiedy zapukałem/am do drzwi jednego z nich i zapytałem/am, co właściwie kupują od sąsiada, ten rozejrzał się nerwowo i wyszeptał, że…" },
  { title: "Tajemnica dziadka", text: "Po śmierci mojego dziadka dostałem/am klucz i list z instrukcją: «Otwórz szafę dopiero wtedy, gdy wszyscy w domu zaczną mówić do ciebie po imieniu, którego nigdy nie miałeś». Następnego ranka przy śniadaniu moja matka spojrzała na mnie i powiedziała, że…" },
  { title: "List z przyszłości", text: "Na poczcie znalazłem/am list zaadresowany do mnie, datowany na 17 lat po mojej śmierci, a w środku było tylko jedno zdanie: «Nie ufaj człowiekowi, który siedzi teraz po twojej lewej stronie». Powoli odwróciłem/am głowę i zobaczyłem/am, że siedzący obok mnie nieznajomy właśnie wyciąga z kieszeni…" },
  { title: "Pokój numer cztery", text: "Właściciel mieszkania uprzedził mnie, żebym nigdy nie otwierał drzwi do pokoju numer cztery, ale w umowie najmu były tylko trzy pokoje. Pewnej nocy usłyszałem/am zza ściany przesuwanie mebli, a potem ktoś zapukał od środka i zapytał, czy…" },
  { title: "CV do mafii", text: "Wszystko zaczęło się od tego, że przez pomyłkę wysłałem/am swoje CV do mafii, a następnego dnia dostałem zaproszenie na rozmowę kwalifikacyjną. Kiedy wszedłem/weszłam do gabinetu, szef mafii przejrzał moje doświadczenie zawodowe i powiedział, że mam idealne kwalifikacje do zadania, które polega na…" },
  { title: "Kebab i państwo na Bałkanach", text: "Kiedy zamówiłem/am kebaba z podwójnym mięsem, nie spodziewałem/am się, że dostawca wręczy mi również akt własności małego państwa na Bałkanach. Zanim zdążyłem/am zaprotestować, wyciągnął z torby koronę, paszport dyplomatyczny i oznajmił, że za piętnaście minut muszę podpisać traktat z…" },
  { title: "Tajny eksperymentalny oddział", text: "Podczas rozmowy o pracę przypadkiem przyznałem/am, że nie mam żadnych kwalifikacji, a rekruter odpowiedział: «Świetnie, dokładnie takiej osoby szukaliśmy do zarządzania naszym tajnym eksperymentalnym oddziałem». Następnie otworzył drzwi do laboratorium i pokazał mi kilkunastu pracowników w garniturach, którzy wszyscy mieli…" },
  { title: "Obrażony gołąb", text: "Pewnego ranka wszyscy ludzie na świecie obudzili się z magiczną mocą, ale moja pozwalała mi wyłącznie przywoływać jednego, bardzo obrażonego gołębia. Po tygodniu gołąb wreszcie przemówił, wręczył mi maleńką kopertę i oznajmił, że zostałem wybrany/a do wykonania misji, która polegała na…" },
  { title: "Czarodziej i regulamin", text: "Czarodziej obiecał spełnić moje trzy życzenia, ale uprzedził, że wszystkie zostaną zinterpretowane zgodnie z regulaminem napisanym drobnym drukiem. Kiedy zażyczyłem/am sobie ogromnego bogactwa, z sufitu spadła walizka pełna pieniędzy, a zaraz za nią do mojego mieszkania weszli prawnicy, którzy oznajmili, że…" },
  { title: "Cesarz planety", text: "Kosmici przybyli na Ziemię, żeby spotkać się z przywódcą ludzkości, ale przez błąd nawigacji wylądowali na moim podwórku i uznali mnie za cesarza planety. Ich dowódca uklęknął, podał mi dokumenty kapitulacji całej galaktyki i poprosił, żebym natychmiast wydał rozkaz dotyczący…" },
  { title: "Nieznajomy z autobusu", text: "Od tygodnia śnił mi się ten sam nieznajomy, aż pewnego dnia usiadł naprzeciwko mnie w autobusie i powiedział: «Wreszcie przestałeś/aś się spóźniać». Następnie wręczył mi zegarek, który odliczał czas wstecz, i ostrzegł, że kiedy wskazówki dojdą do zera, wydarzy się wtedy…" },
  { title: "Tajemnicza prezentacja", text: "Na spotkaniu zarządu mojej firmy, przez przypadek puściłem/am prezentację, która miała pozostać tajemnicą. Na pierwszym slajdzie pojawiło się zdjęcie papieża, na drugim mapa tajnego bunkra, a na trzecim lista gości z dopiskiem, że jedna z obecnych osób…" },
  { title: "Siedem puszek fasoli", text: "Kiedy ogłoszono ewakuację miasta, zorientowałem/am się, że jestem jedyną osobą, która wie, dlaczego wszyscy mieszkańcy od miesięcy kupują dokładnie po siedem puszek fasoli dziennie. Pobiegłem/am do piwnicy, w której ukryłem/am swoje notatki, ale na drzwiach wisiała już kartka z ostrzeżeniem, że jeśli ktokolwiek otworzy ostatnią puszkę, to…" },
  { title: "Pięćdziesiąt tysięcy i trzy zęby", text: "Znalazłem w kieszeni kurtki 50 tysięcy złotych, trzy zęby i kartkę z napisem: «Nie przypominaj sobie, co wydarzyło się w środę». Właśnie wtedy zadzwonił telefon, a nieznajomy głos poinformował mnie, że jeśli chcę odzyskać pozostałe pieniądze, muszę dostarczyć brakujący ząb do…" },
  { title: "Basen ratujący świat", text: "W dniu, w którym postanowiłem zmienić swoje życie, zadzwonił do mnie człowiek podający się za mojego przyszłego siebie i kazał mi natychmiast kupić basen. Kiedy zapytałem, po co mu basen, odpowiedział, że za trzy dni woda zacznie padać świecący deszcz, który…" },
  { title: "Traktor w centrum handlowym", text: "Kiedy policjant zapytał mnie, dlaczego jadę traktorem przez centrum handlowe, po raz pierwszy w życiu naprawdę nie znałem/am odpowiedzi. Nagle wszystkie sklepy zamknęły rolety, z głośników rozległ się alarm, ze…" },
];

export const STORY_COLOR_KEYS = ["brandPrimary", "success", "info", "error", "classChef", "onBrandTertiary", "rarityCommon", "classCritic"] as const;

export function storyColorKey(authorId: string) {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) hash = (hash * 31 + authorId.charCodeAt(i)) >>> 0;
  return STORY_COLOR_KEYS[hash % STORY_COLOR_KEYS.length];
}

export function storyTurnIndex(lineCount: number, seats: number) {
  if (seats <= 0) return 0;
  const count = Math.max(0, Math.floor(lineCount));
  return count % seats;
}

export function catalogGame(title: string) {
  return SOCIAL_GAMES.find((g) => g.title === title) ?? null;
}

export type PlanItem = { key: string; category: AttractionCategory; title: string; body: string };

export function clampLimit(raw: string | undefined) {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, Math.round(n)));
}

export function splitPlan<T extends { category: string; title: string; body?: string | null }>(items: T[]) {
  const note = items.find((i) => i.title === PLAN_NOTE_TITLE) ?? null;
  const limitRow = items.find((i) => i.title === PLAN_LIMIT_TITLE) ?? null;
  const questions = items.filter((i) => i.category === "questions" && i.title !== PLAN_NOTE_TITLE && i.title !== PLAN_LIMIT_TITLE);
  const prompts = items.filter((i) => i.category === "games" && i.title.startsWith(CUSTOM_PROMPT_PREFIX));
  const games = items.filter((i) => i.category === "games" && !i.title.startsWith(CUSTOM_PROMPT_PREFIX));
  const legacy = items.filter((i) => i.category === "challenges");
  return { note, limit: clampLimit(limitRow?.body ?? undefined), questions, prompts, games, legacy };
}

function withoutTitle(items: PlanItem[], title: string) {
  return items.filter((i) => i.title !== title);
}

export function setPlanNote(items: PlanItem[], text: string): PlanItem[] {
  const rest = withoutTitle(items, PLAN_NOTE_TITLE);
  const clean = text.trim().slice(0, 8000);
  if (!clean) return rest;
  const prev = items.find((i) => i.title === PLAN_NOTE_TITLE);
  return [...rest, { key: prev?.key ?? "plan-note", category: "questions", title: PLAN_NOTE_TITLE, body: clean }];
}

export function setPlanLimit(items: PlanItem[], value: number): PlanItem[] {
  const rest = withoutTitle(items, PLAN_LIMIT_TITLE);
  const prev = items.find((i) => i.title === PLAN_LIMIT_TITLE);
  return [...rest, { key: prev?.key ?? "plan-limit", category: "questions", title: PLAN_LIMIT_TITLE, body: String(clampLimit(String(value))) }];
}

export function toggleQuestion(items: PlanItem[], title: string): PlanItem[] {
  const hit = items.find((i) => i.category === "questions" && i.title === title);
  if (hit) return items.filter((i) => i.key !== hit.key);
  return [...items, { key: `q:${title}`, category: "questions", title, body: "" }];
}

export function addCustomQuestion(items: PlanItem[], title: string): PlanItem[] {
  const clean = title.trim().slice(0, 200);
  if (clean.length < 5) return items;
  if (items.some((i) => i.title === clean)) return items;
  return [...items, { key: `custom:${clean}`, category: "questions", title: clean, body: "własne" }];
}

export function toggleGame(items: PlanItem[], game: SocialGame): PlanItem[] {
  const hit = items.find((i) => i.category === "games" && i.title === game.title);
  if (hit) return items.filter((i) => i.key !== hit.key);
  return [...items, { key: `game:${game.id}`, category: "games", title: game.title, body: game.blurb }];
}

export function addCustomPrompt(items: PlanItem[], prompt: string): PlanItem[] {
  const clean = prompt.trim().slice(0, 500);
  if (clean.length < 5) return items;
  const title = `${CUSTOM_PROMPT_PREFIX}${clean}`.slice(0, 200);
  if (items.some((i) => i.title === title)) return items;
  return [...items, { key: `prompt:${clean}`, category: "games", title, body: clean }];
}

export function togglePrompt(items: PlanItem[], prompt: string): PlanItem[] {
  const clean = prompt.trim();
  const hit = items.find((item) => item.category === "games" && (item.body === clean || item.title === `${CUSTOM_PROMPT_PREFIX}${clean}`.slice(0, 200)));
  if (hit) return items.filter((item) => item.key !== hit.key);
  return addCustomPrompt(items, clean);
}

function isManagedNoteLine(line: string) {
  const text = line.trim();
  return !text || isActivityParagraph(text) || text.startsWith("Instrukcja:") || text.startsWith("• ") || text.startsWith("Pytań na osobę");
}

/** Własny tekst organizatora, bez akapitów dokładanych przez plan. */
export function freeNoteText(body: string) {
  return body.split("\n").map((line) => line.trim()).filter((line) => line && !isManagedNoteLine(line)).join("\n\n");
}

/** Instrukcja każdej zabawy, bez powtarzania listy pytań. */
export function syncPlanNote(items: PlanItem[]): PlanItem[] {
  const plan = splitPlan(items);
  const extra = freeNoteText(plan.note?.body ?? "");
  const blocks: string[] = [];
  if (plan.questions.length) {
    blocks.push([ACTIVITY_LINE, questionInstruction(plan.limit)].join("\n\n"));
  }
  const findSomeone = SOCIAL_GAMES.find((game) => game.id === "find-someone")?.title;
  const games = [...plan.games];
  if (plan.prompts.length && findSomeone && !games.some((game) => game.title === findSomeone)) {
    games.push({ key: "find-note", category: "games", title: findSomeone, body: "" });
  }
  for (const game of games) {
    const lines = [gameActivityLine(game.title)];
    const intro = gameInstruction(game.title);
    if (intro) lines.push(intro);
    if (game.title === findSomeone) lines.push(...plan.prompts.map((prompt) => `• ${prompt.body || prompt.title}`));
    blocks.push(lines.join("\n\n"));
  }
  return setPlanNote(items, [...blocks, extra].filter(Boolean).join("\n\n"));
}

export const FALLBACK_ATTRACTIONS: AttractionSuggestion[] = [
  ...BUILTIN_QUESTIONS.map((title, i) => ({ id: `q${i + 1}`, category: "questions" as const, title, body: "", sort: i + 1 })),
  ...SOCIAL_GAMES.map((g, i) => ({ id: g.id, category: "games" as const, title: g.title, body: g.blurb, sort: i + 1 })),
];

export function fallbackAttractions(category: AttractionCategory): AttractionSuggestion[] {
  return FALLBACK_ATTRACTIONS.filter((a) => a.category === category).sort((a, b) => a.sort - b.sort);
}

export function drawIndex(length: number, random = Math.random) {
  if (length <= 0) return -1;
  return Math.min(length - 1, Math.floor(random() * length));
}

import type { AttractionCategory, AttractionSuggestion } from "./attractionsCatalog";

export const PLAN_NOTE_TITLE = "Notatka organizatora";
export const PLAN_LIMIT_TITLE = "Pytania na osobę";
export const CUSTOM_PROMPT_PREFIX = "Znajdź kogoś: ";
export const CUSTOM_HEADING_PREFIX = "Nagłówek: ";
export const CUSTOM_BODY_PREFIX = "Treść: ";
export const QUESTION_RULES =
  "Organizator dodaje pytania do wspólnej puli. Każdy uczestnik losuje po jednym pytaniu, na które może odpowiedzieć. Organizator ustala, ile pytań może wylosować każda osoba.";

export const ACTIVITY_LINE = "Organizator przeprowadzi dla uczestników Zabawę w pytania.";
export const STORY_STARTER_PREFIX = "Początek historii: ";

export function gameActivityLine(title: string) {
  return `Organizator przeprowadzi dla uczestników zabawę w: ${title}.`;
}

export function questionInstruction(limit: number) {
  return `Instrukcja: Organizator dodaje pytania do puli. Każdy uczestnik losuje pytania, na które może udzielić odpowiedzi, ale nie musi. Pytań na osobę ${limit}.`;
}

export const TWO_TRUTHS_TITLE = "Prawda czy kłamstwo";
export const TWO_TRUTHS_TITLE_LEGACY = "Dwie prawdy i jedno kłamstwo";
export const TRUTH_LIMIT_TITLE = "Zdania prawda czy kłamstwo";
export const TWO_TRUTHS_INSTRUCTION =
  "Wpisz prawdziwe lub fałszywe zdania na swój temat. Inni uczestnicy zrobią to samo. Gdy zapiszesz swoje odpowiedzi, spróbujesz ustalić co jest prawdą a co kłamstwem, w przypadku innych uczestników. Trafienie daje +1 pkt, pudło odejmuje 1 pkt. Można wstrzymać się od odpowiedzi. Aplikacja podliczy punkty i pokaże wyniki.";
export const TWO_TRUTHS_GUESS_INSTRUCTION =
  "Spróbuj odgadnąć co jest kłamstwem w przypadku pozostałych uczestników.";
export const TWO_TRUTHS_NO_PRIZE =
  "Nie wszyscy uczestnicy zgodzili się na kupno nagrody dla zwycięzcy, więc gracie tylko dla zabawy.";
export const TWO_TRUTHS_TIE =
  "W przypadku remisu na pierwszym miejscu zwycięzcę wyłoni pojedynek w papier nożyce kamień.";
export const FIND_SOMEONE_GUESS_INSTRUCTION =
  "Dodaj znakiem + tych uczestników, którzy twoim zdaniem, odpowiedzieli na poniższe zdania twierdząco.";

export const FIND_SOMEONE_INSTRUCTION =
  "Każdy uczestnik odpowiada „tak” lub „nie” na pytania, wybrane przez organizatora. W kolejnej turze, przy tych samych pytaniach, zaznacza kto jego zdaniem odpowiedział na te pytania twierdząco. Poprawna odpowiedź daje 1 pkt. Negatywna odejmuje 1 pkt. Można wstrzymać się od odpowiedzi, by nie ryzykować utraty punktów. Aplikacja podlicza punkty i ogłasza zwycięzcę.";

export const RUNAWAY_STORY_INSTRUCTION =
  "Organizator wybiera zdanie/a startowe, lub ustawia dobór losowy spośród wybranych propozycji. Każdy dopisuje dokładnie jedno zdanie i zostawia haczyk dla kolejnej osoby. Aplikacja pilnuje kolejki, notuje kto jakie zdanie dopisał, pokazuje wszystkim aktualną treść historii, i daje podpowiedzi na żądanie.";

export const QUESTION_PLAY_INSTRUCTION =
  "Przeczytaj wylosowane pytanie na głos. Możesz udzielić na nie odpowiedzi, ale możesz też powiedzieć Pas, jeśli nie chcesz tego robić.";

export const QUESTION_POOL_GUEST_HEADER = "Pula pytań";

export const FIND_SOMEONE_PLAY_INSTRUCTION =
  "Odpowiedz tak przy zdaniach, które są prawdziwe w stosunku do Ciebie. W kolejnej turze, zaznacz przy tych samych pytaniach, imiona osób, które twoim zdaniem, odpowiedziały na te pytania twierdząco. Poprawna odpowiedź daje 1 pkt, negatywna -1 pkt. Można wstrzymać się od odpowiedzi, by nie ryzykować utraty punktów. Aplikacja podlicza punkty i ogłasza zwycięzcę.";

export const RUNAWAY_STORY_PLAY_ORGANIZER =
  "Wybierz zdanie startowe, lub naciśnij przycisk Wylosuj pierwsze zdanie. Gdy nadejdzie twoja kolej, dodaj zdanie rozwijające historię. Rozpocznij też kolejne zdanie budujące nowy wątek i urwij je, dając możliwość dokończenia go kolejnemu użytkownikowi.";

export const RUNAWAY_STORY_PLAY_GUEST =
  "Poczekaj aż organizator wybierze początek historii. Gdy nadejdzie twoja kolej, dodaj zdanie rozwijające historię. Rozpocznij też kolejne zdanie budujące nowy wątek i urwij je, dając możliwość dokończenia go kolejnemu użytkownikowi.";

const GAME_INSTRUCTIONS: Record<string, string> = {
  "two-truths": `Instrukcja: ${TWO_TRUTHS_INSTRUCTION}`,
  "find-someone": `Instrukcja: ${FIND_SOMEONE_INSTRUCTION}`,
  "runaway-story": `Instrukcja: ${RUNAWAY_STORY_INSTRUCTION}`,
};

export function gameInstruction(title: string) {
  const game = catalogGame(title);
  return (game && GAME_INSTRUCTIONS[game.id]) || "";
}

export function isCustomHeadingTitle(title: string) {
  return title.startsWith(CUSTOM_HEADING_PREFIX);
}

export function isCustomBodyTitle(title: string) {
  return title.startsWith(CUSTOM_BODY_PREFIX);
}

export function isActivityParagraph(text: string, headings: string[] = []) {
  const line = text.trim();
  return line.startsWith("Organizator przeprowadzi") || line === "Zabawa w pytania" || line === ACTIVITY_LINE || SOCIAL_GAMES.some((game) => game.title === line) || headings.some((heading) => heading === line);
}

export function isStoryStarterTitle(title: string) {
  if (title.startsWith(STORY_STARTER_PREFIX)) return true;
  return STORY_STARTERS.some((starter) => starter.title === title);
}

export function storyStarterLabel(title: string) {
  return title.startsWith(STORY_STARTER_PREFIX) ? title.slice(STORY_STARTER_PREFIX.length) : title;
}

export function isQuestionPoolItem(item: { category: string; title: string }) {
  return item.category === "questions" && item.title !== PLAN_NOTE_TITLE && item.title !== PLAN_LIMIT_TITLE && item.title !== TRUTH_LIMIT_TITLE && !isStoryStarterTitle(item.title) && !isCustomHeadingTitle(item.title) && !isCustomBodyTitle(item.title);
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
    title: TWO_TRUTHS_TITLE,
    blurb: "Każdy podaje prawdziwe rzeczy o sobie i jedno kłamstwo. Reszta zgaduje.",
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
      "Masz na koncie historię, której nie opowiedziałbyś/łabyś przy własnej rodzinie?",
      "Zrobiłeś/aś kiedyś coś tak głupiego, że do dziś zastanawiasz się jakim cudem uszło ci to na sucho?",
      "Masz w telefonie zdjęcie, którego pochodzenia sam/sama nie potrafisz już wyjaśnić?",
      "Mógłbyś/mogłabyś napisać autobiografię, ale połowę historii trzeba by ocenzurować?",
      "Masz jakąś absurdalną umiejętność, o której nie wspomniałbyś/łabyś podczas rozmowy o pracę?",
    ],
  },
  {
    id: "flirt",
    title: "Miłość, flirt i romantyczne katastrofy",
    prompts: [
      "Potrafiłbyś/łabyś wrócić do byłego partnera albo byłej partnerki, mimo że wcześniej przysięgałeś/aś wszystkim, że nigdy więcej?",
      "Masz za sobą randkę, którą można by przerobić na komedię romantyczną z kategorią wiekową 18+?",
      "Dałbyś/dałabyś się namówić na spontaniczną randkę z nieznajomym albo nieznajomą?",
      "Masz najbardziej zaskakującą historię o tym, jak poznałeś/aś swojego byłego partnera albo byłą partnerkę?",
    ],
  },
  {
    id: "secrets",
    title: "Kto tu coś ukrywa?",
    prompts: [
      "Masz hobby, zainteresowanie albo fascynację, o których mało kto tutaj by pomyślał?",
      "Potrafisz zachować pokerową twarz, nawet gdy wszyscy wokół wiedzą, że kłamiesz?",
      "Poradziłbyś/łabyś sobie w podwójnym życiu, gdybyś nagle musiał/a prowadzić dwie zupełnie różne tożsamości?",
    ],
  },
  {
    id: "ego",
    title: "Ego, ambicja i podejrzane decyzje",
    prompts: [
      "Wydałeś/aś kiedyś pieniądze na coś tak bezsensownego, że do dziś nie potrafisz tego racjonalnie uzasadnić?",
      "Potrafiłbyś/łabyś rzucić wszystko i wyjechać, gdybyś wpadł/a na wystarczająco szalony pomysł?",
      "Przekonałbyś/łabyś innych, że masz wszystko pod kontrolą, chociaż improwizowałbyś/łabyś na bieżąco?",
      "Dla realizacji marzenia zaryzykowałbyś/łabyś coś, czego większość ludzi nie odważyłaby się poświęcić?",
      "Kupiłbyś/kupiłabyś bilet w jedną stronę, zanim jeszcze sprawdziłbyś/łabyś, gdzie dokładnie lecisz?",
    ],
  },
  {
    id: "most",
    title: "Kto jest najbardziej…?",
    prompts: [
      "Zostałbyś/łabyś wyrzucony/a z reality show za powiedzenie na głos tego, co wszyscy myślą?",
      "Stałbyś/stałabyś się przypadkiem lokalną legendą po jednej imprezie?",
      "Miałbyś/miałabyś własną sektę, gdybyś przez przypadek zyskał/a zbyt wielu obserwujących?",
    ],
  },
  {
    id: "psych",
    title: "Psychologiczne strzały w ciemno",
    prompts: [
      "Zerwałbyś/łabyś kontakt bez wyjaśnienia, gdyby ktoś przekroczył twoje granice?",
      "Trudno ci przyznać się do tego, że czegoś nie potrafisz?",
      "Masz marzenie, które odkładasz tak długo, że zaczynasz przyzwyczajać się do myśli, że go nie spełnisz?",
      "Łatwo wybaczasz innym błędy, ale sobie przypominasz je przez następne dziesięć lat?",
    ],
  },
];

const FIND_PROMPT_SUMMARIES: Record<string, string> = {
  "Masz na koncie historię, której nie opowiedziałbyś/łabyś przy własnej rodzinie?": "…ma na koncie historię, której nie opowiedziałby/łaby przy własnej rodzinie.",
  "Zrobiłeś/aś kiedyś coś tak głupiego, że do dziś zastanawiasz się jakim cudem uszło ci to na sucho?": "…zrobił/a kiedyś coś tak głupiego, że do dziś zastanawia się, jakim cudem uszło mu/jej to na sucho.",
  "Masz w telefonie zdjęcie, którego pochodzenia sam/sama nie potrafisz już wyjaśnić?": "…ma w telefonie zdjęcie, którego pochodzenia sam/sama nie potrafi już wyjaśnić.",
  "Mógłbyś/mogłabyś napisać autobiografię, ale połowę historii trzeba by ocenzurować?": "…mógłby/mogłaby napisać autobiografię, ale połowę historii trzeba by ocenzurować.",
  "Masz jakąś absurdalną umiejętność, o której nie wspomniałbyś/łabyś podczas rozmowy o pracę?": "…ma jakąś absurdalną umiejętność, o której nie wspomniałby/łaby podczas rozmowy o pracę.",
  "Potrafiłbyś/łabyś wrócić do byłego partnera albo byłej partnerki, mimo że wcześniej przysięgałeś/aś wszystkim, że nigdy więcej?": "…potrafiłby/łaby wrócić do byłego partnera albo byłej partnerki, mimo że wcześniej przysięgał/a wszystkim, że nigdy więcej.",
  "Masz za sobą randkę, którą można by przerobić na komedię romantyczną z kategorią wiekową 18+?": "…ma za sobą randkę, którą można by przerobić na komedię romantyczną z kategorią wiekową 18+.",
  "Dałbyś/dałabyś się namówić na spontaniczną randkę z nieznajomym albo nieznajomą?": "…dałby/dałaby się namówić na spontaniczną randkę z nieznajomym albo nieznajomą.",
  "Masz najbardziej zaskakującą historię o tym, jak poznałeś/aś swojego byłego partnera albo byłą partnerkę?": "…ma najbardziej zaskakującą historię o tym, jak poznał/a swojego byłego partnera albo byłą partnerkę.",
  "Masz hobby, zainteresowanie albo fascynację, o których mało kto tutaj by pomyślał?": "…ma hobby, zainteresowanie albo fascynację, o których mało kto tutaj by pomyślał.",
  "Potrafisz zachować pokerową twarz, nawet gdy wszyscy wokół wiedzą, że kłamiesz?": "…potrafi zachować pokerową twarz, nawet gdy wszyscy wokół wiedzą, że kłamie.",
  "Poradziłbyś/łabyś sobie w podwójnym życiu, gdybyś nagle musiał/a prowadzić dwie zupełnie różne tożsamości?": "…poradziłby/łaby sobie w podwójnym życiu, gdyby nagle musiał/a prowadzić dwie zupełnie różne tożsamości.",
  "Wydałeś/aś kiedyś pieniądze na coś tak bezsensownego, że do dziś nie potrafisz tego racjonalnie uzasadnić?": "…wydał/a kiedyś pieniądze na coś tak bezsensownego, że do dziś nie potrafi tego racjonalnie uzasadnić.",
  "Potrafiłbyś/łabyś rzucić wszystko i wyjechać, gdybyś wpadł/a na wystarczająco szalony pomysł?": "…potrafiłby/łaby rzucić wszystko i wyjechać, gdyby wpadł/a na wystarczająco szalony pomysł.",
  "Przekonałbyś/łabyś innych, że masz wszystko pod kontrolą, chociaż improwizowałbyś/łabyś na bieżąco?": "…przekonałby/łaby innych, że ma wszystko pod kontrolą, chociaż improwizowałby/łaby na bieżąco.",
  "Dla realizacji marzenia zaryzykowałbyś/łabyś coś, czego większość ludzi nie odważyłaby się poświęcić?": "…dla realizacji marzenia zaryzykowałby/łaby coś, czego większość ludzi nie odważyłaby się poświęcić.",
  "Kupiłbyś/kupiłabyś bilet w jedną stronę, zanim jeszcze sprawdziłbyś/łabyś, gdzie dokładnie lecisz?": "…kupiłby/kupiłaby bilet w jedną stronę, zanim jeszcze sprawdziłby/łaby, gdzie dokładnie leci.",
  "Zostałbyś/łabyś wyrzucony/a z reality show za powiedzenie na głos tego, co wszyscy myślą?": "…zostałby/łaby wyrzucony/a z reality show za powiedzenie na głos tego, co wszyscy myślą.",
  "Stałbyś/stałabyś się przypadkiem lokalną legendą po jednej imprezie?": "…stałby/stałaby się przypadkiem lokalną legendą po jednej imprezie.",
  "Miałbyś/miałabyś własną sektę, gdybyś przez przypadek zyskał/a zbyt wielu obserwujących?": "…miałby/miałaby własną sektę, gdyby przez przypadek zyskał/a zbyt wielu obserwujących.",
  "Zerwałbyś/łabyś kontakt bez wyjaśnienia, gdyby ktoś przekroczył twoje granice?": "…zerwałby/łaby kontakt bez wyjaśnienia, gdyby ktoś przekroczył jego/jej granice.",
  "Trudno ci przyznać się do tego, że czegoś nie potrafisz?": "…trudno mu/jej przyznać się do tego, że czegoś nie potrafi.",
  "Masz marzenie, które odkładasz tak długo, że zaczynasz przyzwyczajać się do myśli, że go nie spełnisz?": "…ma marzenie, które odkłada tak długo, że zaczyna się przyzwyczajać do myśli, że go nie spełni.",
  "Łatwo wybaczasz innym błędy, ale sobie przypominasz je przez następne dziesięć lat?": "…łatwo wybacza innym błędy, ale sobie przypomina je przez następne dziesięć lat.",
};

/** W podsumowaniu „Znajdź kogoś” zdania wracają do formy „…ma…” */
export function findPromptSummary(prompt: string) {
  const text = prompt.trim();
  if (FIND_PROMPT_SUMMARIES[text]) return FIND_PROMPT_SUMMARIES[text];
  if (text.startsWith("…") || text.startsWith("...")) return text;
  return text;
}

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
  if (title === TWO_TRUTHS_TITLE || title === TWO_TRUTHS_TITLE_LEGACY) {
    return SOCIAL_GAMES.find((g) => g.id === "two-truths") ?? null;
  }
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
  const truthRow = items.find((i) => i.title === TRUTH_LIMIT_TITLE) ?? null;
  const custom = items.filter((i) => isCustomHeadingTitle(i.title) || isCustomBodyTitle(i.title));
  const questions = items.filter((i) => isQuestionPoolItem(i));
  const starters = items.filter((i) => (i.category === "questions" || i.category === "games") && isStoryStarterTitle(i.title));
  const prompts = items.filter((i) => i.category === "games" && i.title.startsWith(CUSTOM_PROMPT_PREFIX));
  const games = items.filter((i) => i.category === "games" && !i.title.startsWith(CUSTOM_PROMPT_PREFIX) && !isStoryStarterTitle(i.title));
  const legacy = items.filter((i) => i.category === "challenges");
  return { note, limit: clampLimit(limitRow?.body ?? undefined), truthLimit: clampTruthLimit(truthRow?.body ?? undefined), questions, prompts, starters, games, legacy, custom };
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

export function clampTruthLimit(raw: string | undefined) {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return 3;
  return Math.min(9, Math.max(3, Math.round(n)));
}

export function setTruthLimit(items: PlanItem[], value: number): PlanItem[] {
  const rest = withoutTitle(items, TRUTH_LIMIT_TITLE);
  const prev = items.find((i) => i.title === TRUTH_LIMIT_TITLE);
  const game = SOCIAL_GAMES.find((entry) => entry.id === "two-truths");
  const withGame = game && !rest.some((item) => catalogGame(item.title)?.id === "two-truths") ? toggleGame(rest, game) : rest;
  return [...withGame, { key: prev?.key ?? "truth-limit", category: "questions", title: TRUTH_LIMIT_TITLE, body: String(clampTruthLimit(String(value))) }];
}

export function toggleQuestion(items: PlanItem[], title: string): PlanItem[] {
  const hit = items.find((i) => i.category === "questions" && i.title === title);
  if (hit) return items.filter((i) => i.key !== hit.key);
  return [...items, { key: `q:${title}`, category: "questions", title, body: "" }];
}

/** Początek historii należy do zabawy „Historia, która wymknęła się spod kontroli”, nie do puli pytań. */
export function toggleStoryStarter(items: PlanItem[], starter: { title: string; text: string }): PlanItem[] {
  const title = starter.title.trim().slice(0, 200);
  const hit = items.find((i) => isStoryStarterTitle(i.title) && storyStarterLabel(i.title) === title);
  if (hit) return items.filter((i) => i.key !== hit.key);
  const text = starter.text.trim().slice(0, 8000);
  if (title.length < 2 || text.length < 5) return items;
  const game = SOCIAL_GAMES.find((entry) => entry.id === "runaway-story");
  const base = game && !items.some((i) => i.category === "games" && i.title === game.title) ? toggleGame(items, game) : items;
  return [...base, { key: `story:${title}`, category: "games", title: `${STORY_STARTER_PREFIX}${title}`.slice(0, 200), body: text }];
}

function questionNoteLine(item: { title: string; body?: string | null }) {
  const body = (item.body ?? "").trim();
  if (body && body !== "własne") return body;
  return item.title;
}

export function addCustomHeading(items: PlanItem[], title: string): PlanItem[] {
  const clean = title.trim().slice(0, 200);
  if (clean.length < 2) return items;
  return [...items, { key: `head:${clean}:${items.length}`, category: "questions", title: `${CUSTOM_HEADING_PREFIX}${clean}`.slice(0, 200), body: clean }];
}

export function addCustomBody(items: PlanItem[], text: string): PlanItem[] {
  const clean = text.trim().slice(0, 2000);
  if (clean.length < 1) return items;
  return [...items, { key: `body:${clean.slice(0, 40)}:${items.length}`, category: "questions", title: `${CUSTOM_BODY_PREFIX}${clean}`.slice(0, 200), body: clean }];
}

export function addCustomActivity(items: PlanItem[], title: string, body: string): PlanItem[] {
  const next = addCustomHeading(items, title);
  if (next === items) return items;
  const desc = body.trim();
  return desc ? addCustomBody(next, desc) : next;
}

export type CustomActivity = { key: string; title: string; body: string; keys: string[] };

export function customActivities(items: { key?: string; category: string; title: string; body?: string | null }[]): CustomActivity[] {
  const out: CustomActivity[] = [];
  for (const item of splitPlan(items).custom) {
    const text = (item.body ?? "").trim();
    const id = ("key" in item && item.key) ? String(item.key) : item.title;
    if (isCustomHeadingTitle(item.title)) {
      out.push({ key: id, title: text, body: "", keys: [id] });
    } else if (out.length) {
      const last = out[out.length - 1];
      last.body = [last.body, text].filter(Boolean).join("\n\n");
      last.keys.push(id);
    } else {
      out.push({ key: id, title: "", body: text, keys: [id] });
    }
  }
  return out;
}

export function removeCustomActivity(items: PlanItem[], keys: string[]): PlanItem[] {
  const drop = new Set(keys);
  return items.filter((item) => !drop.has(item.key));
}

export function addCustomQuestion(items: PlanItem[], title: string): PlanItem[] {
  const clean = title.trim().slice(0, 200);
  if (clean.length < 5) return items;
  if (items.some((i) => i.title === clean)) return items;
  return [...items, { key: `custom:${clean}`, category: "questions", title: clean, body: "własne" }];
}

export type StoryPickMode = "wybierz" | "losowo";

export function storyPickMode(items: { category: string; title: string; body?: string | null }[]): StoryPickMode {
  const game = SOCIAL_GAMES.find((entry) => entry.id === "runaway-story");
  const row = game ? items.find((item) => item.category === "games" && item.title === game.title) : null;
  return row?.body === "losowo" ? "losowo" : "wybierz";
}

/** Tryb doboru zdań startowych siedzi w treści pozycji tej zabawy. */
export function setStoryMode(items: PlanItem[], mode: StoryPickMode): PlanItem[] {
  const game = SOCIAL_GAMES.find((entry) => entry.id === "runaway-story");
  if (!game) return items;
  const base = items.some((item) => item.category === "games" && item.title === game.title) ? items : toggleGame(items, game);
  return base.map((item) => (item.category === "games" && item.title === game.title ? { ...item, body: mode } : item));
}

export function toggleGame(items: PlanItem[], game: SocialGame): PlanItem[] {
  const hit = items.find((i) => i.category === "games" && (i.title === game.title || catalogGame(i.title)?.id === game.id));
  if (hit) {
    const rest = items.filter((i) => i.key !== hit.key);
    if (game.id === "runaway-story") return rest.filter((i) => !isStoryStarterTitle(i.title));
    if (game.id === "find-someone") return rest.filter((i) => !i.title.startsWith(CUSTOM_PROMPT_PREFIX));
    if (game.id === "two-truths") return rest.filter((i) => i.title !== TRUTH_LIMIT_TITLE);
    return rest;
  }
  const next = [...items, { key: `game:${game.id}`, category: "games", title: game.title, body: game.blurb }];
  return game.id === "two-truths" ? setTruthLimit(next, 3) : next;
}

function withFindSomeone(items: PlanItem[]) {
  const game = SOCIAL_GAMES.find((entry) => entry.id === "find-someone");
  if (!game || items.some((item) => item.category === "games" && item.title === game.title)) return items;
  return toggleGame(items, game);
}

export function addCustomPrompt(items: PlanItem[], prompt: string): PlanItem[] {
  const clean = prompt.trim().slice(0, 500);
  if (clean.length < 5) return items;
  const title = `${CUSTOM_PROMPT_PREFIX}${clean}`.slice(0, 200);
  if (items.some((i) => i.title === title)) return items;
  return [...withFindSomeone(items), { key: `prompt:${clean}`, category: "games", title, body: clean }];
}

export function togglePrompt(items: PlanItem[], prompt: string): PlanItem[] {
  const clean = prompt.trim();
  const hit = items.find((item) => item.category === "games" && (item.body === clean || item.title === `${CUSTOM_PROMPT_PREFIX}${clean}`.slice(0, 200)));
  if (hit) return items.filter((item) => item.key !== hit.key);
  return addCustomPrompt(items, clean);
}

function isManagedNoteLine(line: string) {
  const text = line.trim();
  return !text || isActivityParagraph(text) || text.startsWith("Instrukcja:") || text.startsWith("• ") || text.startsWith("Pytań na osobę") || text.startsWith("Zdań na osobę") || isStoryStarterTitle(text);
}

export type PlanActivityBlock = { id?: string; title: string; instruction: string; bullets?: string[] };

/** Pary tytuł–instrukcja w kolejności planu, niezależnie od starej notatki. */
export function planActivityBlocks(items: PlanItem[]): PlanActivityBlock[] {
  const plan = splitPlan(items);
  const blocks: PlanActivityBlock[] = [];
  for (const item of plan.custom) {
    const text = item.body.trim();
    if (!text) continue;
    if (isCustomHeadingTitle(item.title)) {
      blocks.push({ id: "custom", title: text, instruction: "" });
    } else if (blocks.length && blocks[blocks.length - 1].id === "custom") {
      const last = blocks[blocks.length - 1];
      last.instruction = [last.instruction, text].filter(Boolean).join("\n\n");
    } else {
      blocks.push({ id: "custom", title: text, instruction: "" });
    }
  }
  if (plan.questions.length) {
    blocks.push({
      id: "questions",
      title: ACTIVITY_LINE,
      instruction: questionInstruction(plan.limit),
      bullets: plan.questions.map((question) => questionNoteLine(question)),
    });
  }
  const findSomeone = SOCIAL_GAMES.find((game) => game.id === "find-someone");
  const runaway = SOCIAL_GAMES.find((game) => game.id === "runaway-story");
  const games = [...plan.games];
  if (plan.prompts.length && findSomeone && !games.some((game) => catalogGame(game.title)?.id === "find-someone")) {
    games.push({ key: "find-note", category: "games", title: findSomeone.title, body: "" });
  }
  if (plan.starters.length && runaway && !games.some((game) => catalogGame(game.title)?.id === "runaway-story")) {
    games.push({ key: "story-note", category: "games", title: runaway.title, body: "" });
  }
  for (const game of games) {
    const catalog = catalogGame(game.title);
    const title = catalog?.title ?? game.title;
    const bullets: string[] = [];
    if (catalog?.id === "find-someone") bullets.push(...plan.prompts.map((prompt) => prompt.body || prompt.title));
    if (catalog?.id === "runaway-story") bullets.push(...plan.starters.map((starter) => storyStarterLabel(starter.title)));
    blocks.push({
      id: catalog?.id,
      title: gameActivityLine(title),
      instruction: gameInstruction(title) || catalog?.blurb || game.body,
      bullets,
    });
  }
  return blocks;
}

/** Własny tekst organizatora, bez akapitów dokładanych przez plan. */
export function freeNoteText(body: string) {
  return body.split("\n").map((line) => line.trim()).filter((line) => line && !isManagedNoteLine(line)).join("\n\n");
}

/** Zabawy w kolejności dodania do planu, nie w kolejności katalogu. */
export function plannedGameKeys(items: PlanItem[]): string[] {
  const keys: string[] = [];
  const add = (key: string) => {
    if (!keys.includes(key)) keys.push(key);
  };
  for (const item of items) {
    if (isQuestionPoolItem(item)) add("questions");
    const game = catalogGame(item.title);
    if (game) add(game.id);
    if (item.title.startsWith(CUSTOM_PROMPT_PREFIX)) add("find-someone");
    if (isStoryStarterTitle(item.title)) add("runaway-story");
  }
  return keys;
}

/** Wybrane pytania i zabawy trafiają do planu spotkania. */
export function syncPlanNote(items: PlanItem[]): PlanItem[] {
  const plan = splitPlan(items);
  const customBodies = new Set(plan.custom.map((item) => item.body.trim()).filter(Boolean));
  const extra = freeNoteText(plan.note?.body ?? "").split(/\n\n+/).map((part) => part.trim()).filter((part) => part && !customBodies.has(part)).join("\n\n");
  const blocks: string[] = [];
  if (plan.questions.length) {
    blocks.push([
      ACTIVITY_LINE,
      questionInstruction(plan.limit),
      ...plan.questions.map((question) => `• ${questionNoteLine(question)}`),
    ].join("\n\n"));
  }
  const findSomeone = SOCIAL_GAMES.find((game) => game.id === "find-someone")?.title;
  const runaway = SOCIAL_GAMES.find((game) => game.id === "runaway-story")?.title;
  const games = [...plan.games];
  if (plan.prompts.length && findSomeone && !games.some((game) => game.title === findSomeone)) {
    games.push({ key: "find-note", category: "games", title: findSomeone, body: "" });
  }
  if (plan.starters.length && runaway && !games.some((game) => game.title === runaway)) {
    games.push({ key: "story-note", category: "games", title: runaway, body: "" });
  }
  for (const game of games) {
    const lines = [gameActivityLine(game.title)];
    const instruction = gameInstruction(game.title);
    if (instruction) lines.push(instruction);
    if (game.title === findSomeone) lines.push(...plan.prompts.map((prompt) => `• ${prompt.body || prompt.title}`));
    if (game.title === runaway) lines.push(...plan.starters.map((starter) => `• ${storyStarterLabel(starter.title)}`));
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

function polishCount(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Ile pytań musi być w puli, żeby każda osoba wylosowała swoją liczbę bez powtórek. */
export function questionPoolNeed(seats: number, perPerson: number) {
  const people = Math.max(0, Math.floor(Number(seats)));
  return people * clampLimit(String(perPerson));
}

export function isQuestionPlanActive(items: { category: string; title: string }[]) {
  return items.some((item) => item.title === PLAN_LIMIT_TITLE) || splitPlan(items).questions.length > 0;
}

export function questionPoolWarning(seats: number, perPerson: number, poolSize: number) {
  const people = Math.max(0, Math.floor(Number(seats)));
  const each = clampLimit(String(perPerson));
  const have = Math.max(0, Math.floor(poolSize));
  const need = people * each;
  if (people < 1 || have >= need) return null;
  const peopleWord = polishCount(people, "osoby", "osób", "osób");
  const eachWord = polishCount(each, "pytanie", "pytania", "pytań");
  const needWord = polishCount(need, "pytanie", "pytania", "pytań");
  return `Dla ${people} ${peopleWord}, po ${each} ${eachWord} na osobę, przygotuj minimum ${need} ${needWord} do puli. Masz teraz ${have}.`;
}

export function unusedStoryStarters(usedBodies: string[], planned: { title: string; text: string }[] = []) {
  const used = new Set(usedBodies.map((body) => body.trim()).filter(Boolean));
  const fresh = (rows: { title: string; text: string }[]) => rows.filter((row) => row.text.trim() && !used.has(row.text.trim()));
  const pending = fresh(planned);
  if (pending.length) return pending;
  return fresh(STORY_STARTERS);
}

/** Najpierw niewykorzystane zaznaczone propozycje, potem reszta katalogu. */
export function drawStoryStarter(usedBodies: string[], planned: { title: string; text: string }[] = [], random = Math.random) {
  const bag = unusedStoryStarters(usedBodies, planned);
  const index = drawIndex(bag.length, random);
  return index < 0 ? null : bag[index];
}

export const JOURNAL_QUESTIONS_TITLE = "Organizator przeprowadził dla uczestników Zabawę w pytania.";
export const JOURNAL_TRUTHS_TITLE = "Organizator przeprowadził zabawę w Prawda czy kłamstwo?";
export const JOURNAL_FIND_TITLE = "Organizator przeprowadził dla uczestników zabawę w Znajdź kogoś kto…";
export const JOURNAL_STORY_TITLE = "Historia, która wymknęła się spod kontroli";

export type JournalRecapBlock = { title: string; lines: string[] };

export function journalRecapBlocks(entry: {
  question_draws?: Array<{ name: string; question: string; round?: number }>;
  truths?: Array<{ name: string; lines?: Array<{ text: string; truth: boolean }>; truths?: Array<string | null>; lie?: string; score?: number }>;
  truths_ranking?: Array<{ name: string; score: number }>;
  find_yes?: Array<{ prompt: string; names: string[] }>;
  find_answers?: Array<{ prompt: string; name: string; yes: boolean }>;
  find_scores?: Array<{ name: string; score: number }>;
  stories?: Array<{ title: string; lines: Array<{ author: string; body: string }> }>;
  story?: Array<{ author: string; body: string }>;
}): JournalRecapBlock[] {
  const blocks: JournalRecapBlock[] = [];
  if (entry.question_draws?.length) {
    blocks.push({
      title: JOURNAL_QUESTIONS_TITLE,
      lines: entry.question_draws.map((row) => `${row.name}: ${row.question}`),
    });
  }
  if (entry.truths?.length || entry.truths_ranking?.length) {
    const lines: string[] = [];
    for (const row of entry.truths ?? []) {
      if (row.lines?.length) {
        lines.push(row.name);
        for (const item of row.lines) {
          lines.push(`• ${item.text} — ${item.truth ? "prawda" : "fałsz"}`);
        }
        if (row.score != null) lines.push(`Punkty: ${row.score}`);
      } else {
        const truths = (row.truths ?? []).filter(Boolean).join("; ");
        lines.push(`${row.name}: prawdy — ${truths}. Kłamstwo — ${row.lie ?? ""}.`);
      }
    }
    if (entry.truths_ranking?.length) {
      lines.push("Ranking");
      entry.truths_ranking.forEach((row, index) => {
        lines.push(`${index + 1}. ${row.name}: ${row.score} pkt`);
      });
    }
    blocks.push({ title: JOURNAL_TRUTHS_TITLE, lines });
  }
  if (entry.find_yes?.length || entry.find_answers?.length || entry.find_scores?.length) {
    const lines: string[] = [];
    if (entry.find_yes?.length) {
      for (const row of entry.find_yes) {
        lines.push(findPromptSummary(row.prompt));
        lines.push(`Tak: ${row.names.length ? row.names.join(", ") : "nikt"}`);
      }
    } else {
      const byPrompt = new Map<string, string[]>();
      for (const row of entry.find_answers ?? []) {
        if (!row.yes) continue;
        const list = byPrompt.get(row.prompt) ?? [];
        list.push(row.name);
        byPrompt.set(row.prompt, list);
      }
      for (const [prompt, names] of byPrompt) {
        lines.push(findPromptSummary(prompt));
        lines.push(`Tak: ${names.join(", ")}`);
      }
    }
    if (entry.find_scores?.length) {
      lines.push("Ranking");
      entry.find_scores.forEach((row, index) => {
        lines.push(`${index + 1}. ${row.name}: ${row.score} pkt`);
      });
    }
    blocks.push({ title: JOURNAL_FIND_TITLE, lines });
  }
  const stories = [...(entry.stories ?? [])];
  if (entry.story?.length) {
    const current = entry.story.map((line) => line.body).join("\n");
    const already = stories.some((story) => (story.lines ?? []).map((line) => line.body).join("\n") === current);
    if (!already) stories.push({ title: JOURNAL_STORY_TITLE, lines: entry.story });
  }
  for (const story of stories) {
    blocks.push({
      title: story.title?.trim() || JOURNAL_STORY_TITLE,
      lines: (story.lines ?? []).map((line) => `${line.author}: ${line.body}`),
    });
  }
  return blocks;
}

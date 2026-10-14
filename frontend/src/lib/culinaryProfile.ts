export const CULINARY_LEVELS = [
  {
    level: 1,
    title: "Amator-Przetrwaniowiec",
    emoji: "🌱",
    blurb: "Nie umrę z głodu, ale mikrofala i Uber Eats to moi sprzymierzeńcy.",
  },
  {
    level: 2,
    title: "Domowy Eksperymentator",
    emoji: "🍳",
    blurb: "Makaron ze słoika podkręcam przyprawami — czasem wychodzi cuda, czasem pizza ratunkowa.",
  },
  {
    level: 3,
    title: "Niedzielny Szef Kuchni",
    emoji: "👨‍🍳",
    blurb: "Trzy dania naraz? Ogarniam. Kuchnia wygląda jak pole bitwy, ale smak rekompensuje.",
  },
  {
    level: 4,
    title: "Lokalny Magik Smaku",
    emoji: "👑",
    blurb: "Gotuję na oko, z lodówki jak MasterChef. W żyłach płynie beszamel.",
  },
  {
    level: 5,
    title: "Gastronomiczny Guru",
    emoji: "🚀",
    blurb: "Sous-vide, kimchi, serwis jak w premium — kandydat na gotowanie na zamówienie.",
  },
] as const;

export const DIET_STYLES = [
  { key: "omnivore", label: "Wszystkożerca" },
  { key: "veg", label: "Roślinożerca (wege/wegan)" },
  { key: "gluten_free", label: "Bezglutenowy Ninja" },
  { key: "keto", label: "Keto-Gepard" },
  { key: "fit", label: "Fit-Licznik" },
] as const;

export const SPICE_LABELS = [
  { key: "mild", label: "Łagodny jak baranek" },
  { key: "medium", label: "Pikantny, ale z klasą" },
  { key: "hot", label: "Smok Wawelski" },
] as const;

export const SUPERPOWERS = [
  "Desery & Wypieki",
  "Szybkie obiady (One-pot)",
  "Kuchnia azjatycka",
  "Zupy bogate w treść",
  "Fit przekąski",
  "Mączne szaleństwo (Pierogi/Kopytka)",
] as const;

export const COLLAB_FORMS = [
  { key: "meal_swap", label: "Zamiana posiłków" },
  { key: "cook_order", label: "Gotowanie na zamówienie" },
  { key: "cook_together", label: "Wspólne gotowanie i nauka" },
  { key: "cook_ingredients", label: "Gotowanie za zwrot kosztów składników" },
] as const;

export const PAID_COOKING_CONSENTS = [
  "Oświadczam, że zapoznałem/am się z wymogami prawa powszechnego w Polsce i moja domowa kuchnia spełnia standardy sanitarne stawiane przez Państwową Inspekcję Sanitarną (Sanepid) dla działalności gastronomicznej (w tym posiadam aktualne badanie do celów sanitarno-epidemiologicznych).",
  "Oświadczam, że biorę pełną odpowiedzialność prawną i finansową za bezpieczeństwo higieniczne i zdrowotne przygotowywanych przeze mnie posiłków.",
  "Rozumiem i akceptuję, że aplikacja nie jest stroną umowy sprzedaży, a rozliczenie podatków (np. w ramach działalności nierejestrowanej lub gospodarczej) leży wyłącznie po mojej stronie.",
] as const;

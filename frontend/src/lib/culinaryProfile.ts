export const CULINARY_LEVELS = [
  {
    level: 1,
    title: "Amator-Przetrwaniowiec",
    emoji: "🌱",
    description:
      "Nie umrę z głodu, ale jeśli muszę gotować sam, to mój portfel cierpi na Uber Eats. Mój szczyt kulinarny to idealnie nacięte parówki z mikrofali, jajecznica (bez skorupek!) i woda na herbatę, której nie przypalam.",
    forWhom:
      "Dla tych, którzy chcą głównie zamawiać gotowe posiłki od innych w zamian za opłatę, lub opłacenie kosztu produktów.",
  },
  {
    level: 2,
    title: "Domowy Eksperymentator",
    emoji: "🍳",
    description:
      "Makaron z sosem ze słoika potrafię podkręcić własnymi przyprawami. Znam różnicę między krojeniem w kostkę a w słupki. Czasem coś mi wyjdzie tak dobrze, że sam się dziwię, ale zdarza mi się też zamówić pizzę ratunkową, gdy eksperyment wymknie się spod kontroli.",
    forWhom:
      "Dla tych, którzy chcą głównie zamawiać gotowe posiłki od innych w zamian za opłatę, lub opłacenie kosztu produktów.",
  },
  {
    level: 3,
    title: "Niedzielny Szef Kuchni",
    emoji: "👨‍🍳",
    subtitle: "Średniozaawansowany",
    description:
      "Trzy dania obiadowe na raz? Żaden problem, ogarniam logistykę palników. Piekę własne ciasta (i rosną!), a znajomi chętnie wpadają do mnie na kolację. Moja kuchnia po gotowaniu wygląda jak pole bitwy, ale efekt końcowy jest tego wart.",
    forWhom:
      "Dla tych, którzy chcą zamieniać się potrawami, gotować na zamówienie, lub za opłacenie składników.",
  },
  {
    level: 4,
    title: "Lokalny Magik Smaku",
    emoji: "👑",
    description:
      "Gotuję bez przepisu, „na oko”, i zawsze wychodzi genialne. Potrafię zrobić coś z niczego (tzw. przegląd lodówki na poziomie MasterChefa). Posiadam w domu naczynia, których nazw większość ludzi nie potrafi wymówić, a w moich żyłach płynie sos beszamelowy.",
    forWhom:
      "Dla tych, którzy chcą wymieniać się potrawami, gotować na zamówienie i dzielić się bardziej zaawansowanym gotowaniem.",
  },
  {
    level: 5,
    title: "Gastronomiczny Guru",
    emoji: "🚀",
    description:
      "Konstruuję smaki, robię własne kimchi, a mięso piekę metodą sous-vide przez 48 godzin. Jeśli do mnie wpadniesz, jedzenie będzie nie tylko pyszne, ale też zbalansowane i zaserwowane jak w restauracji premium. Idealny kandydat na „Gotowanie na zamówienie”.",
    forWhom: "Dla osób gotujących na zamówienie i serwujących kuchnię na poziomie premium.",
  },
] as const;

export const DIET_STYLES = [
  {
    key: "omnivore",
    label: "Wszystkożerca",
    blurb: "Jem mięso, ryby, nabiał i warzywa — bez ścisłych ograniczeń dietetycznych.",
  },
  {
    key: "veg",
    label: "Roślinożerca (wege/wegan)",
    blurb: "Stawiam na kuchnię roślinną — wegetariańską lub wegańską, bez mięsa (i ewentualnie bez produktów odzwierzęcych).",
  },
  {
    key: "gluten_free",
    label: "Bezglutenowy Ninja",
    blurb: "Unikam glutenu (pszenica, żyto, jęczmień itd.) — szukam bezpiecznych zamienników i świadomych składów.",
  },
  {
    key: "keto",
    label: "Keto-Gepard",
    blurb: "Niska podaż węglowodanów, więcej tłuszczu i białka — posiłki pod dietę ketogeniczną / LCHF.",
  },
  {
    key: "fit",
    label: "Fit-Licznik",
    blurb: "Liczy się bilans: makro, kalorie i lekkie, sycące dania pod trening albo kontrolę wagi.",
  },
] as const;

export const SPICE_LABELS = [
  {
    key: "mild",
    label: "Łagodny jak baranek",
    blurb: "Bez ognia — wolę łagodne smaki, chili tylko symbolicznie albo wcale.",
  },
  {
    key: "medium",
    label: "Pikantny, ale z klasą",
    blurb: "Lubię wyraźną pikantność, ale wciąż komfortową — nie walkę o oddech.",
  },
  {
    key: "hot",
    label: "Smok Wawelski",
    blurb: "Im ostrzej, tym lepiej — ostre papryczki, sosy chili i wyzwania smakowe witane z uśmiechem.",
  },
] as const;

/** Propozycje na start — użytkownik może też dodać własne tagi. */
export const SUPERPOWERS = [
  "Desery & Wypieki",
  "Szybkie obiady (One-pot)",
  "Kuchnia azjatycka",
  "Zupy bogate w treść",
  "Fit przekąski",
  "Mączne szaleństwo (Pierogi/Kopytka)",
  "Ekspert od zup",
  "Dania obiadowe",
  "Przekąski",
] as const;

export const SUPERPOWERS_HINT =
  "Wybierz lub dopisz własne tagi swoich najbardziej rozwiniętych zdolności kulinarnych — np. ekspert od zup, dań obiadowych, przekąsek, wypieków.";

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

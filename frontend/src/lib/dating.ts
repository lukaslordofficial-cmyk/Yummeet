import { rpc } from "@/src/lib/api";
import { SOCIAL_GAMES } from "@/src/lib/meetingPlan";

export const DATING_QUESTIONS = [
  { id: "day-off", prompt: "Jak wygląda Twój idealny dzień wolny przy jedzeniu?" },
  { id: "cook", prompt: "Wolisz ugotować coś dla kogoś czy iść na kolację?" },
  { id: "taste", prompt: "Jakie jedzenie od razu poprawia Ci humor?" },
  { id: "table", prompt: "Wolisz stolik w knajpie, piknik czy kuchnię?" },
  { id: "appreciated", prompt: "Co sprawia, że czujesz się doceniany/a przy wspólnym stole?" },
  { id: "conflict", prompt: "Jak zazwyczaj rozwiązujesz nieporozumienia?" },
  { id: "kids", prompt: "Jak ważne jest dla Ciebie posiadanie dzieci?" },
  { id: "together", prompt: "Ile czasu lubisz spędzać razem, a ile osobno?" },
  { id: "money", prompt: "Jak podchodzisz do wspólnego płacenia za wyjścia?" },
  { id: "safe", prompt: "Co pomaga Ci poczuć się swobodnie przy nowej osobie?" },
] as const;

export const FOOD_FORMATS = [
  { key: "cafe", label: "Kawa i coś słodkiego" },
  { key: "dinner", label: "Kolacja" },
  { key: "picnic", label: "Piknik" },
  { key: "walk", label: "Spacer" },
] as const;

export const DATE_GOALS = [
  { key: "serious", label: "Stały związek" },
  { key: "casual", label: "Niezobowiązująco" },
  { key: "unsure", label: "Trudno określić" },
] as const;

export const GENDERS = [
  { key: "woman", label: "Kobieta" },
  { key: "man", label: "Mężczyzna" },
] as const;

export const SEEKING = [...GENDERS, { key: "any", label: "Bez znaczenia" }] as const;

export const KIDS = [
  { key: "want", label: "Chcę mieć dzieci" },
  { key: "dont", label: "Nie chcę" },
  { key: "unsure", label: "Nie wiem" },
  { key: "have", label: "Mam już dzieci" },
] as const;

export const MODELS = [
  { key: "mono", label: "Monogamia" },
  { key: "open", label: "Relacja otwarta" },
  { key: "discuss", label: "Chcę to omówić" },
] as const;

export const SPLITS = [
  { key: "half", label: "Po połowie" },
  { key: "host", label: "Organizator płaci" },
  { key: "guest", label: "Gość płaci" },
  { key: "separate", label: "Każdy za siebie" },
  { key: "later", label: "Ustalimy później" },
] as const;

export const FOOD_MISSIONS = [
  { id: "share-dessert", title: "Kawa i coś do podziału", body: "Jedno danie albo deser na spółkę przy pierwszym spotkaniu." },
  { id: "cook-snack", title: "Przekąska dla drugiej osoby", body: "Każde z Was przygotowuje jedną małą przekąskę." },
  { id: "picnic-swap", title: "Wymiana porcji w plenerze", body: "Drugie spotkanie: każde przynosi porcję i wymieniacie się na pikniku." },
] as const;

export const DATING_GAMES = SOCIAL_GAMES.filter((g) => ["two-truths", "find-someone", "runaway-story"].includes(g.id));

export type DatingPerson = {
  user_id: string;
  display_name: string;
  age: number;
  gender: string;
  photo_url: string;
  bio: string;
  goal: string;
  seeking_gender?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  area_label: string | null;
  distance_label: string | null;
  about: string | null;
  kids: string | null;
  relationship_model: string | null;
};

export type DatingProfile = {
  display_name: string;
  birth_date: string;
  age: number;
  gender: string;
  bio: string;
  goal: string;
  seeking_gender: string;
  age_min: number;
  age_max: number;
  max_km: number;
  photo_url: string;
  area_label: string | null;
  about: string | null;
  kids: string | null;
  relationship_model: string | null;
  show_extras: boolean;
  open_contacts: number;
};

export type DatingCard = {
  id: string;
  blurb: string;
  format: string;
  area_label: string | null;
  time_window: string | null;
  person: DatingPerson;
};

export type DatingListing = DatingCard & {
  status: string;
  mine: boolean;
  interests?: Array<{ id: string; status: string; created_at: string; person: DatingPerson }>;
  my_interest?: string | null;
};

export type DatingMine = {
  id: string;
  blurb: string;
  format: string;
  status: string;
  area_label: string | null;
  time_window: string | null;
  pending: number;
};

export type DatingContactRow = {
  id: string;
  status: string;
  listing_id: string;
  format: string;
  role: "host" | "guest";
  person: DatingPerson;
};

export type DatingQuestion = { id: string; prompt: string; answer: string | null; skipped: boolean };

export type DatingPlan = {
  meet_date: string | null;
  meet_time: string | null;
  place_kind: string | null;
  budget_note: string | null;
  split: string | null;
  game_ids: string[];
  mission_ids: string[];
};

export type DatingContact = {
  id: string;
  status: string;
  role: "host" | "guest";
  listing: { id: string; blurb: string; format: string; area_label: string | null; time_window: string | null; status: string };
  person: DatingPerson;
  questions: DatingQuestion[];
  my_decision: string | null;
  their_decision: string | null;
  plan_open: boolean;
  plan: DatingPlan | null;
};

const label = (rows: readonly { key: string; label: string }[], key: string | null | undefined) =>
  rows.find((r) => r.key === key)?.label ?? key ?? "";

const LEGACY_GOALS: Record<string, string> = { slow: "Bez pośpiechu" };
const LEGACY_FORMATS: Record<string, string> = { cook: "Wspólne gotowanie", swap: "Wymiana porcji" };

export const goalLabel = (key: string | null | undefined) => (key && LEGACY_GOALS[key]) || label(DATE_GOALS, key);
export const formatLabel = (key: string | null | undefined) => (key && LEGACY_FORMATS[key]) || label(FOOD_FORMATS, key);
export const genderLabel = (key: string | null | undefined) => label(GENDERS, key) || (key === "any" ? "Bez znaczenia" : "");
export const seekingLabel = (key: string | null | undefined) => label(SEEKING, key);
export const splitLabel = (key: string | null | undefined) => label(SPLITS, key);
export const kidsLabel = (key: string | null | undefined) => label(KIDS, key);
export const modelLabel = (key: string | null | undefined) => label(MODELS, key);

export const contactStatusLabel: Record<string, string> = {
  pending: "Czeka na odpowiedź",
  questions: "Pytania przed spotkaniem",
  deciding: "Decyzja o randce",
  planning: "Planujemy spotkanie",
  declined: "Zakończone",
  cancelled: "Odwołane",
};

export const listingStatusLabel: Record<string, string> = {
  active: "Aktywne",
  paused: "Wstrzymane",
  closed: "Zakończone",
  cancelled: "Anulowane",
};

export const datingProfile = () => rpc<DatingProfile | null>("dating_my_profile");
export const saveDatingProfile = (profile: Record<string, unknown>) => rpc<DatingProfile>("dating_save_profile", { p_profile: profile });
export const publishDating = (listing: Record<string, unknown>) => rpc<string>("dating_publish", { p_listing: listing });
export const updateDating = (id: string, listing: Record<string, unknown>) => rpc("dating_update", { p_id: id, p_listing: listing });
export const deleteDating = (id: string) => rpc("dating_delete", { p_id: id });
export const setDatingStatus = (id: string, status: string) => rpc("dating_set_status", { p_id: id, p_status: status });
export const datingBoard = (lat: number | null, lng: number | null) => rpc<DatingCard[]>("dating_board", { p_lat: lat, p_lng: lng });
export const datingListing = (id: string) => rpc<DatingListing>("dating_listing", { p_id: id });
export const myDatingListings = () => rpc<DatingMine[]>("dating_my_listings");
export const myDatingContacts = () => rpc<DatingContactRow[]>("dating_my_contacts");
export const datingContact = (id: string) => rpc<DatingContact>("dating_contact", { p_id: id });
export const expressDating = (listingId: string) => rpc<string>("dating_express", { p_listing: listingId });
export const passDating = (listingId: string) => rpc("dating_pass", { p_listing: listingId });
export const respondDating = (interestId: string, accept: boolean) => rpc("dating_respond", { p_interest: interestId, p_accept: accept });
export const askDating = (interestId: string, ids: string[]) => rpc("dating_ask", { p_interest: interestId, p_ids: ids });
export const answerDating = (interestId: string, answers: Array<{ id: string; answer: string; skipped: boolean }>) =>
  rpc("dating_answer", { p_interest: interestId, p_answers: answers });
export const decideDating = (interestId: string, choice: "date" | "talk" | "pass") => rpc("dating_decide", { p_interest: interestId, p_choice: choice });
export const saveDatingPlan = (interestId: string, plan: Record<string, unknown>) => rpc("dating_save_plan", { p_interest: interestId, p_plan: plan });
export const endDating = (interestId: string) => rpc("dating_end", { p_interest: interestId });

export const EVENT_KINDS: { key: string; label: string; hint: string }[] = [
  { key: "open_table", label: "Otwarty stół", hint: "Luźne spotkanie przy wspólnym stole — każdy może dołączyć." },
  { key: "speed_friending", label: "Speed Friending", hint: "Krótkie rundy rozmów — poznajesz kilka osób po kolei." },
  { key: "dinner", label: "Kolacja tematyczna", hint: "Wspólna kolacja wokół tematu (kuchnia, kultura, hobby)." },
  { key: "food_exchange", label: "Wymiana potraw", hint: "Każdy przynosi danie — wymiana smaków i przepisów." },
  { key: "volunteer", label: "Wolontariat", hint: "Spotkanie z celem społecznym / pomocą innym." },
];

export const EVENT_DAYS = [
  ["0", "Dziś"],
  ["1", "Jutro"],
  ["3", "Za 3 dni"],
  ["7", "Za tydzień"],
  ["custom", "Własna data"],
] as const;

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function resolveEventStart(day: string, customDate: string, time: string): Date | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  if (day === "custom") {
    const dm = customDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dm) return null;
    return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(m[1]), Number(m[2]), 0, 0);
  }
  const d = new Date();
  d.setDate(d.getDate() + Number(day));
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

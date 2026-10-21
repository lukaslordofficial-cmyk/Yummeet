const LABELS: Record<string, string> = {
  title: "Nazwa",
  description: "Opis",
  cuisine: "Kuchnia",
  city: "Miasto",
  address: "Adres",
  price_min: "Cena od",
  price_max: "Cena do",
  cover_url: "Zdjęcie lokalu",
  menu_photo_url: "Zdjęcie menu",
  menu_pdf_url: "PDF menu",
  menu_text: "Opis menu",
  website: "Strona",
  phone: "Telefon",
  order_wolt_url: "Wolt",
  order_pyszne_url: "Pyszne.pl",
  order_glovo_url: "Glovo",
  order_uber_url: "Uber Eats",
  created: "Utworzono",
  removed: "Usunięto z mapy",
};

export function formatPinEditChanges(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "";
  return Object.entries(changes as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const label = LABELS[k] ?? k;
      const text = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "";
      return text && text !== "true" ? `${label}: ${text}` : label;
    })
    .join("\n");
}

/** Adres strony z menu: kolumna website, a jak brak — URL z opisu. */
export function resolveMenuUrl(...candidates: unknown[]): string | null {
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const fromText = trimmed.match(/https?:\/\/[^\s<>"']+/i)?.[0]
      ?? trimmed.match(/(?:www\.)[^\s<>"']+/i)?.[0]
      ?? null;
    const value = fromText ?? (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || /\.[a-z]{2,}(\/|$)/i.test(trimmed) ? trimmed : null);
    if (!value) continue;
    const cleaned = value.replace(/[),.;]+$/g, "");
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    return `https://${cleaned}`;
  }
  return null;
}

export function descriptionWithoutMenuUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/Menu i ceny:\s*https?:\/\/\S+/gi, "Menu i ceny są na stronie lokalu.")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text || null;
}

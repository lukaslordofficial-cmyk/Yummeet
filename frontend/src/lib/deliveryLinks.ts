export type DeliveryPlatform = "wolt" | "pyszne" | "glovo" | "uber";

export const DELIVERY_SHARE_HINT =
  "Przycisk zamówienia na pinie pojawia się dopiero po wklejeniu linku. Udostępnij knajpę z aplikacji do Yummeet, a link wstawi się w odpowiednie pole.";

/** Strona startowa, gdy na pinie nie ma jeszcze linku do lokalu. */
export const DELIVERY_HOME: Record<DeliveryPlatform, string> = {
  wolt: "https://wolt.com/pl",
  pyszne: "https://www.pyszne.pl/",
  glovo: "https://glovoapp.com/",
  uber: "https://www.ubereats.com/pl",
};

const RULES: Record<DeliveryPlatform, { label: string; test: (url: string) => boolean; error: string }> = {
  wolt: {
    label: "Wolt",
    test: (u) => u.includes("wolt.com"),
    error: "To nie jest prawidłowy link do platformy Wolt",
  },
  pyszne: {
    label: "Pyszne.pl",
    test: (u) => u.includes("pyszne.pl") || u.includes("takeaway.com"),
    error: "To nie jest prawidłowy link do platformy Pyszne.pl",
  },
  glovo: {
    label: "Glovo",
    test: (u) => u.includes("glovoapp.com") || u.includes("glovo.com"),
    error: "To nie jest prawidłowy link do platformy Glovo",
  },
  uber: {
    label: "Uber Eats",
    test: (u) => u.includes("ubereats.com") || /uber\.com\/.*eats/i.test(u),
    error: "To nie jest prawidłowy link do platformy Uber Eats",
  },
};

/** Puste pole = OK. Wypełnione musi pasować do platformy. */
export function validateDeliveryUrl(platform: DeliveryPlatform, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  const rule = RULES[platform];
  if (!rule.test(lower)) return rule.error;
  return null;
}

export function firstDeliveryValidationError(fields: {
  wolt?: string;
  pyszne?: string;
  glovo?: string;
  uber?: string;
}): string | null {
  return (
    validateDeliveryUrl("wolt", fields.wolt ?? "") ||
    validateDeliveryUrl("pyszne", fields.pyszne ?? "") ||
    validateDeliveryUrl("glovo", fields.glovo ?? "") ||
    validateDeliveryUrl("uber", fields.uber ?? "") ||
    null
  );
}

export function extractHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/g, "");
}

export function detectDeliveryPlatform(url: string): DeliveryPlatform | null {
  const u = url.toLowerCase();
  if (RULES.wolt.test(u)) return "wolt";
  if (RULES.pyszne.test(u)) return "pyszne";
  if (RULES.glovo.test(u)) return "glovo";
  if (RULES.uber.test(u)) return "uber";
  return null;
}

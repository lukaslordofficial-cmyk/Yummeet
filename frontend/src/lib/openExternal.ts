import * as Linking from "expo-linking";
import { Platform } from "react-native";

/** Zostawia + i cyfry — do tel: */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const kept = trimmed.replace(/[^\d+]/g, "");
  const digits = kept.replace(/\D/g, "");
  if (digits.length < 6) return null;
  if (kept.startsWith("+")) return `+${digits}`;
  return digits;
}

export function resolvePhone(...candidates: unknown[]): string | null {
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const fromDesc = raw.match(/Tel\.\s*([+\d][\d\s\-()/]{5,})/i)?.[1];
    const phone = normalizePhone(fromDesc ?? raw);
    if (phone) return phone;
  }
  return null;
}

function asHttpUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(wolt|glovo|glovoapp|pysznepl|ubereats|tel):/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return null;
}

function isUberEatsHost(host: string): boolean {
  const h = host.replace(/^www\./i, "").toLowerCase();
  return h.includes("ubereats.") || h === "uber.com" || h.endsWith(".uber.com");
}

/**
 * Usuwa parametry śledzące z webowych linków Uber Eats (wszystko po `?`).
 * Zostawia czystą ścieżkę restauracji pod Universal Links / App Links.
 */
export function sanitizeUberEatsUrl(raw: string): string {
  const normalized = asHttpUrl(raw) ?? raw.trim();
  try {
    if (!/^https?:\/\//i.test(normalized)) return normalized;
    const u = new URL(normalized);
    if (!isUberEatsHost(u.hostname)) return normalized;
    u.search = "";
    u.hash = "";
    // Uber często dokłada zbędny trailing slash po sanitizacji — zostaw pathname jak jest
    return u.toString().replace(/\?$/, "");
  } catch {
    const cut = normalized.split("?")[0]?.split("#")[0];
    return cut || normalized;
  }
}

/** Kandydaci custom-scheme — tylko gdy HTTPS Universal Link nie wystarczy. */
export function deliveryAppCandidates(httpsUrl: string): string[] {
  try {
    const u = new URL(httpsUrl);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const pathQuery = `${u.pathname}${u.search}`;
    if (host.includes("wolt.")) {
      return [`wolt://discovery${pathQuery}`];
    }
    if (host.includes("pyszne.") || host.includes("takeaway.")) {
      return [`pysznepl://${host}${pathQuery}`];
    }
    if (host.includes("glovo")) {
      return [`glovo://open?url=${encodeURIComponent(httpsUrl)}`];
    }
    // Uber Eats: NIE używamy ubereats:// — otwiera home. Tylko HTTPS Universal Link.
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Otwiera link dostawcy jako Universal / App Link (HTTPS) przez Expo Linking.
 * Dla Uber Eats najpierw czyści query string, potem otwiera czysty URL restauracji.
 */
export async function openDeliveryOrWeb(rawUrl: string): Promise<void> {
  let url = asHttpUrl(rawUrl);
  if (!url) throw new Error("invalid_url");

  if (/^https?:\/\//i.test(url)) {
    try {
      const host = new URL(url).hostname;
      if (isUberEatsHost(host)) {
        url = sanitizeUberEatsUrl(url);
      }
    } catch {
      /* keep url */
    }
  }

  // Custom scheme (już nie HTTPS) — otwórz wprost
  if (!/^https?:\/\//i.test(url)) {
    await Linking.openURL(url);
    return;
  }

  // Preferuj Universal / App Links: system sam otworzy apkę na właściwym ekranie
  try {
    await Linking.openURL(url);
    return;
  } catch {
    /* fallback poniżej */
  }

  const candidates = deliveryAppCandidates(url);
  for (const appUrl of candidates) {
    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      /* kolejny */
    }
  }

  throw new Error("open_failed");
}

/** Otwiera systemowy dialer z numerem (iOS + Android). */
export async function dialPhone(raw: string): Promise<void> {
  const phone = normalizePhone(raw);
  if (!phone) throw new Error("invalid_phone");
  const url = `tel:${phone}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can && Platform.OS === "web") throw new Error("dial_unsupported");
    await Linking.openURL(url);
  } catch (e) {
    throw e instanceof Error ? e : new Error("dial_failed");
  }
}

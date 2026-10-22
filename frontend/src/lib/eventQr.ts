const EVENT_QR = /yummeet:event:([0-9a-f-]{36})(?::([A-Za-z0-9]{4,8}))?/i;

export function eventQrValue(eventId: string, code: string) {
  return `yummeet:event:${eventId}:${code}`;
}

export function parseEventQr(raw: string): { eventId: string; code?: string } | null {
  const text = raw.trim();
  const tagged = text.match(EVENT_QR);
  if (tagged) return { eventId: tagged[1], code: tagged[2]?.toUpperCase() };
  if (/^[0-9a-f-]{36}$/i.test(text)) return { eventId: text };
  return null;
}

/** Kod QR albo sam sześcioznakowy kod wpisany ręcznie. */
export function parseEntryCode(raw: string): { eventId?: string; code?: string } | null {
  const qr = parseEventQr(raw);
  if (qr) return qr;
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z0-9]{4,8}$/.test(code)) return { code };
  return null;
}

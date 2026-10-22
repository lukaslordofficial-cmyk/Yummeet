const EVENT_QR = /^yummeet:event:([0-9a-f-]{36})(?::([A-Za-z0-9]+))?$/i;

export function eventQrValue(eventId: string, code: string) {
  return `yummeet:event:${eventId}:${code}`;
}

export function parseEventQr(raw: string): { eventId: string; code?: string } | null {
  const text = raw.trim();
  const tagged = text.match(EVENT_QR);
  if (tagged) return { eventId: tagged[1], code: tagged[2] };
  if (/^[0-9a-f-]{36}$/i.test(text)) return { eventId: text };
  return null;
}

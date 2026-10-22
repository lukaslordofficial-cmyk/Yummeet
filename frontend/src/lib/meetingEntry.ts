import { eventCheckin, eventClaimCode } from "@/src/lib/data";
import { parseEntryCode } from "@/src/lib/eventQr";
import { getCurrentPosition } from "@/src/lib/location";
import { rememberScannedEvent } from "@/src/lib/scannedEvents";

/** Kod QR albo wpisany ręcznie otwiera panel i dolicza spotkanie. */
export async function openMeetingCode(raw: string): Promise<string> {
  const parsed = parseEntryCode(raw);
  if (!parsed) throw new Error("invalid_code");
  if (!parsed.code) {
    if (!parsed.eventId) throw new Error("invalid_code");
    await rememberScannedEvent(parsed.eventId);
    return parsed.eventId;
  }
  const res = await eventClaimCode(parsed.code, parsed.eventId);
  await rememberScannedEvent(res.event_id);
  try {
    const pos = await getCurrentPosition();
    if (pos) await eventCheckin(res.event_id, parsed.code, pos.lat, pos.lng);
  } catch {
    /* XP za GPS jest dodatkowe. Sam kod już otworzył panel i doliczył spotkanie. */
  }
  return res.event_id;
}

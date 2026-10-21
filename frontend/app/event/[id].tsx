import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KIND_LABEL, formatDate } from "@/src/components/EventCard";
import { Stars } from "@/src/components/Stars";
import { Badge, Body, Button, Card, ErrorState, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  addEventPhoto, eventCheckin, eventConversationId, eventJoin, eventLeave, eventParticipants,
  eventRevealCheckinCode, getEvent, getProfile, listEventPhotos, myEventStatus, organizerRating,
  report, saveOrganizerReview, type OrganizerRating,
} from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { subscribePostgres } from "@/src/lib/realtime";
import { FREE_PHOTO_SLOTS, pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import type { EventRow, Profile } from "@/src/types";

const ORG_AXES = [
  ["hospitality", "Gościnność"],
  ["organization", "Organizacja"],
  ["atmosphere", "Atmosfera"],
  ["communication", "Kontakt"],
] as const;

function isEventDay(startsAt: string) {
  const d = new Date(startsAt);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function withinCheckinWindow(startsAt: string) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  return now >= start && now <= start + 4 * 3600e3;
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const [e, setE] = useState<EventRow | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [people, setPeople] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [orgCode, setOrgCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; photo_url: string }>>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [orgProfile, setOrgProfile] = useState<Profile | null>(null);
  const [orgRating, setOrgRating] = useState<OrganizerRating | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [orgReview, setOrgReview] = useState({ hospitality: 0, organization: 0, atmosphere: 0, communication: 0, tip: "" });
  const isOrganizer = e?.organizer_id === session?.user.id;

  const load = useCallback(async () => {
    try {
      const [ev, st, ps] = await Promise.all([getEvent(id), myEventStatus(id), eventParticipants(id)]);
      setE(ev); setStatus(st); setPeople(ps ?? []); setError(null);
      if (ev?.organizer_id) {
        const [op, rating] = await Promise.all([
          getProfile(ev.organizer_id).catch(() => null),
          organizerRating(ev.organizer_id).catch(() => null),
        ]);
        setOrgProfile(op);
        setOrgRating(rating);
        const mine = rating?.reviews?.find((r) => r.reviewer_id === session?.user.id && r.event_id === id);
        if (mine) {
          setOrgReview({
            hospitality: mine.hospitality, organization: mine.organization,
            atmosphere: mine.atmosphere, communication: mine.communication, tip: mine.tip ?? "",
          });
        }
      } else {
        setOrgProfile(null); setOrgRating(null);
      }
      try {
        const ph = await listEventPhotos(id);
        setPhotos(ph ?? []);
      } catch { setPhotos([]); }
    } catch (err) { setError(errorMessage(err)); }
  }, [id, session?.user.id]);
  useEffect(() => { load(); }, [load]);

  const uploadEventPhoto = async (source: "gallery" | "camera") => {
    const uid = session?.user.id;
    if (!uid) return;
    setPhotoBusy(true);
    try {
      // Upload bez claim w storage — claim robi RPC add_event_photo
      const url = await pickPinPhoto(uid, source);
      if (!url) return;
      await addEventPhoto(id, url);
      toast("Zdjęcie dodane", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    return subscribePostgres<EventRow>(`event-${id}`, { event: "UPDATE", table: "events", filter: `id=eq.${id}` }, (p) => {
      if (p.new) setE(p.new as EventRow);
    });
  }, [id]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok, "success"); await load(); } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const openChat = async () => { const c = await eventConversationId(id); if (c) router.push(`/chat/${c}`); else toast("Czat niedostępny", "info"); };

  const submitOrgReview = async () => {
    if (!orgReview.hospitality || !orgReview.organization || !orgReview.atmosphere || !orgReview.communication) {
      return toast("Oceń wszystkie 4 kategorie", "error");
    }
    setBusy(true);
    try {
      await saveOrganizerReview({ eventId: id, ...orgReview });
      toast("Dzięki za opinię o organizatorze!", "success");
      setReviewOpen(false);
      await load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const revealCode = async (silent = false) => {
    if (!silent) setBusy(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) {
        if (!silent) toast("Włącz GPS — kod pojawi się dopiero na miejscu.", "info");
        return;
      }
      const res = await eventRevealCheckinCode(id, pos.lat, pos.lng);
      setOrgCode(res.code);
      if (res.notified) toast("Otrzymałeś kod wydarzenia — podaj go gościom od razu gdy przyjdą.", "success");
      else if (!silent) toast("Kod dostępny", "success");
    } catch (err) {
      if (!silent) toast(errorMessage(err), "error");
    } finally {
      if (!silent) setBusy(false);
    }
  };

  // Organizer: when on-site on event day, auto-reveal code + notify.
  useEffect(() => {
    if (!e || !isOrganizer || orgCode || !isEventDay(e.starts_at)) return;
    if (!withinCheckinWindow(e.starts_at) && Date.now() < new Date(e.starts_at).getTime() - 30 * 60e3) return;
    void revealCode(true);
    const t = setInterval(() => { if (!orgCode) void revealCode(true); }, 45000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id, e?.starts_at, isOrganizer, orgCode]);

  const guestCheckin = async () => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) return toast("Włącz GPS, żeby potwierdzić obecność w lokalu.", "info");
      await eventCheckin(id, code, pos.lat, pos.lng);
      toast("Obecność potwierdzona! +25 XP", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Spotkanie" /><ErrorState message={error} onRetry={load} /></View>;
  if (!e) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Spotkanie" /><Loading /></View>;
  const joined = status === "joined" || status === "attended";
  const dayOk = isEventDay(e.starts_at);
  const windowOk = withinCheckinWindow(e.starts_at);

  return (
    <View testID="event-detail-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={KIND_LABEL[e.kind] ?? "Spotkanie"} right={<Button testID="event-report-button" title="Zgłoś" variant="ghost" onPress={() => act(() => report("event", id, "event_issue"), "Zgłoszenie wysłane")} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Card accent={e.is_official ? colors.rarityLegendary : undefined}>
          {e.is_official ? <Badge label="OFICJALNE WYDARZENIE" color={colors.rarityLegendary} textColor={colors.onSurface} /> : null}
          <Title size={24} testID="event-title">{e.title}</Title>
          <Body>{e.place_name} · {formatDate(e.starts_at)}</Body>
          {e.description ? <Body muted>{e.description}</Body> : null}
          {e.theme ? <Body>Temat: {e.theme}</Body> : null}
          {e.rules ? <Body muted>Zasady: {e.rules}</Body> : null}
          {e.discount_text ? <Badge label={e.discount_text} color={colors.brandSecondary} textColor={colors.onBrandSecondary} /> : null}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Text testID="event-detail-seats" style={{ fontFamily: fonts.display, fontSize: 36, color: colors.brandPrimary }}>{e.capacity - e.seats_taken}</Text>
            <Body muted>wolnych miejsc z {e.capacity}</Body>
          </View>
        </Card>
        {e.organizer_id ? (
          <Card testID="event-organizer-rating">
            <Pressable onPress={() => e.organizer_id && e.organizer_id !== session?.user.id && router.push(`/user/${e.organizer_id}`)}>
              <Title size={16}>Organizator: {orgProfile?.display_name ?? "Yummiteer"}</Title>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text testID="organizer-yummeet-score" style={{ fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary }}>
                {orgRating?.summary?.yummeet_score ?? "–"}
              </Text>
              <View>
                <Stars testID="organizer-stars" value={Number(orgRating?.summary?.yummeet_score ?? 0)} size={20} />
                <Body muted>{orgRating?.summary?.review_count ?? 0} ocen</Body>
              </View>
            </View>
            {orgRating?.summary ? ORG_AXES.map(([k, label]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Body>{label}</Body>
                <Body>{(orgRating.summary as any)[k]}</Body>
              </View>
            )) : <Body muted>Brak ocen — bądź pierwszy po spotkaniu.</Body>}
            {joined && !isOrganizer && new Date(e.starts_at).getTime() <= Date.now() ? (
              <>
                <Button testID="organizer-review-button" title={reviewOpen ? "Zamknij" : "Oceń organizatora"} icon="star" onPress={() => setReviewOpen((v) => !v)} />
                {reviewOpen ? (
                  <View testID="organizer-review-form" style={{ gap: spacing.sm }}>
                    {ORG_AXES.map(([k, label]) => (
                      <View key={k} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Body>{label}</Body>
                        <Stars testID={`org-review-${k}`} value={(orgReview as any)[k]} onChange={(v) => setOrgReview({ ...orgReview, [k]: v })} />
                      </View>
                    ))}
                    <Field testID="org-review-tip-input" label="Opinia (opcjonalnie)" value={orgReview.tip} onChangeText={(t) => setOrgReview({ ...orgReview, tip: t })} placeholder="np. super atmosfera, punktualny start" />
                    <Button testID="org-review-submit-button" title="Zapisz ocenę" loading={busy} onPress={() => void submitOrgReview()} />
                  </View>
                ) : null}
              </>
            ) : null}
            {(orgRating?.reviews ?? []).slice(0, 5).map((rv) => (
              <View key={rv.id} testID={`org-review-${rv.id}`} style={{ gap: 2 }}>
                <Title size={14}>{rv.author ?? "Yummiteer"}</Title>
                <Body muted>G {rv.hospitality} · O {rv.organization} · A {rv.atmosphere} · K {rv.communication}</Body>
                {rv.tip ? <Body>{rv.tip}</Body> : null}
              </View>
            ))}
          </Card>
        ) : null}
        {!joined ? <Button testID="event-join-button" title="Zarezerwuj miejsce" icon="seat" loading={busy} disabled={e.seats_taken >= e.capacity} onPress={() => act(() => eventJoin(id), "Miejsce zarezerwowane!")} /> : (
          <View style={{ gap: spacing.md }}>
            <Badge testID="event-joined-badge" label={status === "attended" ? "Obecność potwierdzona ✓" : "Jesteś na liście"} color={colors.success} textColor={colors.onSuccess} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button testID="event-chat-button" title="Czat spotkania" icon="chat" style={{ flex: 1 }} onPress={openChat} />
              <Button testID="event-games-button" title="Atrakcje" icon="dice-multiple" variant="secondary" onPress={() => router.push(`/games?event=${id}`)} />
            </View>
            {!isOrganizer && status === "joined" ? <Button testID="event-leave-button" title="Zrezygnuj" variant="ghost" onPress={() => act(() => eventLeave(id), "Zrezygnowano")} /> : null}
          </View>
        )}

        {isOrganizer ? (
          <Card testID="event-organizer-code">
            <Title size={16}>Kod obecności</Title>
            <Body muted>Dostępny w dniu wydarzenia, dopiero gdy GPS wykryje Cię w lokalu. Podaj gośćom od razu po przyjściu (okno 4 h od startu).</Body>
            {!dayOk ? <Body muted>Dziś nie ma wydarzenia — kod będzie tu w dniu spotkania.</Body> : null}
            {dayOk && !orgCode ? (
              <Button testID="event-reveal-code" title="Pokaż kod (GPS na miejscu)" loading={busy} onPress={() => void revealCode()} />
            ) : null}
            {orgCode ? <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary, letterSpacing: 4 }}>{orgCode}</Text> : null}
          </Card>
        ) : null}

        {joined && status !== "attended" && !isOrganizer ? (
          <Card>
            <Body muted>Wpisz kod od organizatora będąc w lokalu (GPS), od godziny startu przez max 4 godziny. Organizator nie nabija punktów za obecność gości — XP dostaje tylko gość po poprawnym check-inie.</Body>
            {!windowOk ? <Body muted>Check-in niedostępny poza oknem czasowym wydarzenia.</Body> : null}
            <Field testID="event-checkin-input" label="Kod obecności od organizatora" value={code} onChangeText={setCode} autoCapitalize="characters" />
            <Button testID="event-checkin-button" title="Potwierdź obecność (GPS)" variant="secondary" loading={busy} disabled={!windowOk} onPress={() => void guestCheckin()} />
          </Card>
        ) : null}

        {(joined || isOrganizer) ? (
          <Card testID="event-photos">
            <Title size={16}>Zdjęcia ze stołu</Title>
            <Body muted>Zużywają sloty zdjęć ({FREE_PHOTO_SLOTS} max). Po ~7 dniach slot się zwalnia.</Body>
            {photos.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {photos.map((p) => (
                  <Image key={p.id} source={{ uri: p.photo_url }} style={{ width: 96, height: 96, borderRadius: radius.md }} contentFit="cover" />
                ))}
              </View>
            ) : <Body muted>Brak zdjęć.</Body>}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID="event-photo-camera" title="Zrób zdjęcie" variant="secondary" loading={photoBusy} style={{ flex: 1 }} onPress={() => void uploadEventPhoto("camera")} />
              <Button testID="event-photo-gallery" title="Galeria" variant="ghost" loading={photoBusy} style={{ flex: 1 }} onPress={() => void uploadEventPhoto("gallery")} />
            </View>
          </Card>
        ) : null}

        <Title size={18}>Uczestnicy</Title>
        {people.length === 0 ? <Body muted testID="event-participants-hidden">Lista uczestników widoczna po dołączeniu.</Body> : people.map((p) => (
          <Pressable key={p.user_id} testID={`event-participant-${p.user_id}`} onPress={() => p.user_id !== session?.user.id && router.push(`/user/${p.user_id}`)}>
            <Card><Body>{p.display_name}{p.status === "attended" ? " ✓" : ""}</Body></Card>
          </Pressable>
        ))}
      </KeyboardAwareScrollView>
    </View>
  );
}

import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KIND_LABEL, formatDate } from "@/src/components/EventCard";
import { EventDishSection } from "@/src/components/meetings/EventDishSection";
import { Stars } from "@/src/components/Stars";
import { Badge, Body, Button, Card, ErrorState, Field, Header, Loading, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import {
  addEventPhoto, eventAttractions, eventConversationId, eventJoin, eventLeave, eventParticipants,
  eventRevealCheckinCode, getEvent, getProfile, listEventPhotos, myEventStatus, organizerRating,
  report, saveOrganizerReview, type OrganizerRating,
} from "@/src/lib/data";
import { getCurrentPosition } from "@/src/lib/location";
import { openMeetingCode } from "@/src/lib/meetingEntry";
import { subcategoryLabel } from "@/src/lib/meetingCatalog";
import { QUESTION_POOL_GUEST_HEADER, STORY_PROPOSALS_HEADER, customActivities, freeNoteText, planActivityBlocks, splitPlan, type PlanItem } from "@/src/lib/meetingPlan";
import { ActivityBody, ActivityName } from "@/src/components/meetings/PlanNoteView";
import { QrMark } from "@/src/components/meetings/QrMark";
import { eventQrValue } from "@/src/lib/eventQr";
import { subscribePostgres } from "@/src/lib/realtime";
import { pickPinPhoto } from "@/src/lib/storage";
import { useAuth } from "@/src/providers/AuthProvider";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import type { EventRow, Profile } from "@/src/types";

const ORG_AXES = [
  ["hospitality", "Gościnność"],
  ["organization", "Organizacja"],
  ["atmosphere", "Atmosfera"],
  ["communication", "Kontakt"],
] as const;

function withinRevealWindow(startsAt: string) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  return now >= start - 4 * 3600e3 && now <= start + 4 * 3600e3;
}

function PlanPreview({ rows, organizer }: { rows: Array<{ id: string; category: string; title: string; body: string }>; organizer: boolean }) {
  const { colors } = useTheme();
  const plan = splitPlan(rows);
  const items = rows.map((row) => ({ key: row.id, category: row.category as PlanItem["category"], title: row.title, body: row.body }));
  const blocks = planActivityBlocks(items);
  const homemade = customActivities(items);
  const known = new Set([
    ...homemade.flatMap((activity) => [activity.title, activity.body]),
    ...blocks.flatMap((block) => [block.title, block.instruction, ...(block.bullets ?? [])]),
  ].map((part) => part.trim()).filter(Boolean));
  const extra = freeNoteText(plan.note?.body ?? "").split(/\n\n+/).map((part) => part.trim()).filter((part) => part && !known.has(part));
  const empty = blocks.length === 0 && homemade.length === 0 && extra.length === 0;
  return (
    <Card testID="event-plan" style={{ gap: spacing.xxxl, paddingTop: spacing.xl }}>
      <Title size={18} style={{ textAlign: "center", width: "100%", marginBottom: spacing.sm }}>Plan spotkania</Title>
      {homemade.map((activity) => (
        <View key={activity.key} style={{ gap: spacing.xxl, width: "100%" }}>
          {activity.title ? <ActivityName>{activity.title}</ActivityName> : null}
          {activity.body ? <Body style={{ textAlign: "center", color: colors.onSurface }}>{activity.body}</Body> : null}
        </View>
      ))}
      {blocks.filter((block) => block.id !== "custom").map((block, index) => (
        <View key={`${block.id ?? "block"}-${index}`} testID={index === 0 ? "event-plan-note" : undefined} style={{ gap: spacing.xxl, width: "100%" }}>
          <ActivityName>{block.title}</ActivityName>
          {block.instruction ? <Body style={{ textAlign: "center", color: colors.onSurface }}>{block.instruction}</Body> : null}
          {block.id === "questions" || block.id === "find-someone" ? <ActivityName>{QUESTION_POOL_GUEST_HEADER}</ActivityName> : null}
          {(organizer || block.id === "questions" || block.id === "find-someone") && block.bullets?.length ? block.bullets.map((line) => (
            <Body key={line} style={{ textAlign: "center", color: colors.onSurface }}>• {line}</Body>
          )) : null}
          {block.id === "runaway-story" && block.stories?.length ? (
            <View style={{ gap: spacing.xxl, width: "100%" }}>
              <ActivityName>{STORY_PROPOSALS_HEADER}</ActivityName>
              {block.stories.map((story) => (
                <View key={story.title} style={{ gap: spacing.xxl, width: "100%" }}>
                  <ActivityName>{story.title}</ActivityName>
                  {story.text ? <ActivityBody>{story.text}</ActivityBody> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {extra.map((part) => (
        <Body key={part.slice(0, 40)} style={{ textAlign: "center", color: colors.onSurface }}>{part}</Body>
      ))}
      {empty ? <Body muted style={{ textAlign: "center" }}>Organizator jeszcze nie ustawił planu.</Body> : null}
    </Card>
  );
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
  const [revealHint, setRevealHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; photo_url: string }>>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [orgProfile, setOrgProfile] = useState<Profile | null>(null);
  const [orgRating, setOrgRating] = useState<OrganizerRating | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [orgReview, setOrgReview] = useState({ hospitality: 0, organization: 0, atmosphere: 0, communication: 0, tip: "" });
  const [planRows, setPlanRows] = useState<Array<{ id: string; category: string; title: string; body: string }>>([]);
  const isOrganizer = e?.organizer_id === session?.user.id;
  const joined = status === "joined" || status === "attended";

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
      try {
        const attrs = await eventAttractions(id);
        setPlanRows((attrs as Array<{ id: string; category: string; title: string; body: string }> | null) ?? []);
      } catch { setPlanRows([]); }
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

  const canRate = joined && !isOrganizer;
  const rateStars = async (stars: number) => {
    if (!canRate) return;
    const next = { ...orgReview, hospitality: stars, organization: stars, atmosphere: stars, communication: stars };
    setOrgReview(next);
    setBusy(true);
    try {
      await saveOrganizerReview({ eventId: id, ...next });
      toast("Zapisano ocenę organizatora.", "success");
      await load();
    } catch (err) {
      const message = errorMessage(err);
      toast(message.includes("Kod QR") ? "Ocena przed startem spotkania zapisze się po migracji 048_two_truths_play.sql." : message, "error");
    } finally {
      setBusy(false);
    }
  };

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
      setRevealHint(null);
      if (res.notified) toast("Kod QR jest gotowy. Pokaż go gościom, gdy przyjdą.", "success");
      else if (!silent) toast("Kod QR dostępny", "success");
    } catch (err) {
      const message = errorMessage(err);
      setRevealHint(message);
      if (!silent) toast(message, "error");
    } finally {
      if (!silent) setBusy(false);
    }
  };

  // Organizer: when on-site on event day, auto-reveal code + notify.
  useEffect(() => {
    if (!e || !isOrganizer || orgCode || !withinRevealWindow(e.starts_at)) return;
    void revealCode(true);
    const t = setInterval(() => { if (!orgCode) void revealCode(true); }, 45000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id, e?.starts_at, isOrganizer, orgCode]);

  const guestCheckin = async () => {
    if (!code.trim()) return toast("Wpisz kod od organizatora.", "info");
    setBusy(true);
    try {
      const eventId = await openMeetingCode(code);
      toast("Kod przyjęty. Panel spotkania jest otwarty.", "success");
      router.push(`/games?event=${eventId}&scanned=1`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Spotkanie" /><ErrorState message={error} onRetry={load} /></View>;
  if (!e) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Spotkanie" /><Loading /></View>;
  const revealOk = withinRevealWindow(e.starts_at);
  const tasting = e.category_key === "oceniaj" || e.kind === "tasting";
  const kindLabel = subcategoryLabel(e.subcategory_key) ?? KIND_LABEL[e.kind] ?? "Spotkanie";

  return (
    <View testID="event-detail-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={kindLabel} right={<Button testID="event-report-button" title="Zgłoś" variant="ghost" onPress={() => act(() => report("event", id, "event_issue"), "Zgłoszenie wysłane")} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Card accent={e.is_official ? colors.rarityLegendary : undefined}>
          {e.is_official ? <Badge label="OFICJALNE WYDARZENIE" color={colors.rarityLegendary} textColor={colors.onBrandPrimary} /> : null}
          <Title size={24} testID="event-title">{e.title}</Title>
          <Body>{e.place_name} · {formatDate(e.starts_at)}</Body>
          {e.place_lat != null && e.place_lng != null ? (
            <Body muted testID="event-place-gps">GPS miejsca: {e.place_lat.toFixed(5)}, {e.place_lng.toFixed(5)}. W dniu spotkania sprawdzimy, czy zapisani goście są na miejscu.</Body>
          ) : null}
          {e.description ? <Body muted>{e.description}</Body> : null}
          {e.theme ? <Body>Temat: {e.theme}</Body> : null}
          {e.budget_per_person != null ? <Body>Budżet: {e.budget_per_person} zł / os.</Body> : null}
          {e.rules ? <Body muted>Zasady: {e.rules}</Body> : null}
          {e.discount_text ? <Badge label={e.discount_text} color={colors.brandSecondary} textColor={colors.onBrandSecondary} /> : null}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Text testID="event-detail-seats" style={{ fontFamily: fonts.display, fontSize: 36, color: colors.brandPrimary }}>{e.capacity - e.seats_taken}</Text>
            <Body muted>wolnych miejsc z {e.capacity}</Body>
          </View>
        </Card>
        {e.organizer_id ? (
          <Card testID="event-organizer-rating">
            <Pressable testID="event-organizer-open" onPress={() => { if (canRate) setReviewOpen(true); }}>
              <Title size={16}>Organizator: {orgProfile?.display_name ?? "Yummiteer"}</Title>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text testID="organizer-yummeet-score" style={{ fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary }}>
                {orgRating?.summary?.yummeet_score ?? "–"}
              </Text>
              <View>
                <Stars
                  testID="organizer-stars"
                  value={orgReview.hospitality || Number(orgRating?.summary?.yummeet_score ?? 0)}
                  size={20}
                  onChange={canRate ? (value) => void rateStars(value) : undefined}
                />
                <Body muted>{canRate ? "Dotknij gwiazdki, żeby ocenić 1–5" : `${orgRating?.summary?.review_count ?? 0} ocen`}</Body>
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
        <PlanPreview rows={planRows} organizer={isOrganizer} />
        {!joined ? <Button testID="event-plan-open" title="Panel spotkania" variant="secondary" onPress={() => router.push(`/games?event=${id}`)} /> : null}
        {!joined ? <Button testID="event-join-button" title="Zarezerwuj miejsce" icon="seat" loading={busy} disabled={e.seats_taken >= e.capacity} onPress={() => act(() => eventJoin(id), "Miejsce zarezerwowane!")} /> : (
          <View style={{ gap: spacing.md }}>
            <Badge testID="event-joined-badge" label={status === "attended" ? "Obecność potwierdzona ✓" : "Jesteś na liście"} color={colors.success} textColor={colors.onSuccess} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button testID="event-chat-button" title="Czat spotkania" icon="chat" style={{ flex: 1 }} onPress={openChat} />
              <Button testID="event-games-button" title="Panel spotkania" icon="dice-multiple" variant="secondary" onPress={() => router.push(`/games?event=${id}`)} />
            </View>
            {!isOrganizer && status === "joined" ? <Button testID="event-leave-button" title="Zrezygnuj" variant="ghost" onPress={() => act(() => eventLeave(id), "Zrezygnowano")} /> : null}
          </View>
        )}

        {isOrganizer ? (
          <Card testID="event-organizer-code">
            <Title size={16}>Kod QR spotkania</Title>
            <Body muted>Pojawia się od 4 godzin przed startem do 4 godzin po starcie, gdy GPS widzi Cię przy miejscu spotkania. Goście skanują go pływającym skanerem i wchodzą do panelu zabaw.</Body>
            {!revealOk ? <Body muted>Poza tym oknem kod jeszcze się nie pokaże.</Body> : null}
            {revealOk && !orgCode ? (
              <Button testID="event-reveal-code" title="Pokaż kod QR (GPS na miejscu)" loading={busy} onPress={() => void revealCode()} />
            ) : null}
            {revealHint && !orgCode ? <Body testID="event-reveal-hint">{revealHint}</Body> : null}
            {orgCode ? (
              <View style={{ alignItems: "center", gap: spacing.md }}>
                <QrMark testID="event-qr" value={eventQrValue(id, orgCode)} />
                <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.brandPrimary, letterSpacing: 4 }}>{orgCode}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {!isOrganizer ? (
          <Card>
            <Body muted>Wpisz kod od organizatora albo zeskanuj go pływającym skanerem. Otworzy się panel spotkania. Uczestnik dostaje odwiedzone spotkanie, organizator — zorganizowane.</Body>
            <Field testID="event-checkin-input" label="Kod spotkania" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="np. AB12CD" />
            <Button testID="event-checkin-button" title="Otwórz panel kodem" variant="secondary" loading={busy} onPress={() => void guestCheckin()} />
          </Card>
        ) : null}

        {(joined || isOrganizer) ? (
          <Card testID="event-photos">
            <Title size={16}>Zdjęcia ze stołu</Title>
            <Body muted>Zdjęcie zostaje w dzienniku spotkania na stałe.</Body>
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

        {tasting ? <EventDishSection eventId={id} canRate={joined} canEdit={isOrganizer} /> : null}

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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameCard, KIND_LABEL, RARITY_LABEL } from "@/src/components/GameCard";
import { Body, Chip, ChipRow, EmptyState, ErrorState, Header, Loading, Title } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { cardCatalog, myCards } from "@/src/lib/data";
import { radius, spacing, useTheme } from "@/src/theme";
import type { CardDef, CardKind } from "@/src/types";

type Tab = CardKind | "catalog";

export default function CardBook() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("offensive");
  const [owned, setOwned] = useState<Map<string, number> | null>(null);
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CardDef | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, all] = await Promise.all([myCards(), cardCatalog()]);
      const m = new Map<string, number>();
      mine.forEach((uc) => m.set(uc.card.id, (m.get(uc.card.id) ?? 0) + 1));
      setOwned(m); setCatalog(all); setError(null);
    } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    if (tab === "catalog") return catalog;
    return catalog.filter((c) => c.kind === tab && owned?.has(c.id));
  }, [tab, catalog, owned]);
  const total = owned ? [...owned.values()].reduce((a, b) => a + b, 0) : 0;
  const rows: CardDef[][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));

  return (
    <View testID="card-book-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Księga kart" right={<Body testID="card-book-total" muted>{total} kart</Body>} />
      <ChipRow testID="card-book-tabs">
        <Chip testID="book-tab-offensive" label="Ofensywne" selected={tab === "offensive"} onPress={() => setTab("offensive")} />
        <Chip testID="book-tab-defensive" label="Defensywne" selected={tab === "defensive"} onPress={() => setTab("defensive")} />
        <Chip testID="book-tab-special" label="Specjalne" selected={tab === "special"} onPress={() => setTab("special")} />
        <Chip testID="book-tab-catalog" label="Do zdobycia" selected={tab === "catalog"} onPress={() => setTab("catalog")} />
      </ChipRow>
      {error ? <ErrorState message={error} onRetry={load} /> : !owned ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
          {rows.length === 0 ? <EmptyState testID="card-book-empty" icon="book-open-page-variant-outline" title="Pusta strona księgi" text="Wykonuj misje i pojedynki, by zdobyć karty." /> : null}
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.md }}>
              {r.map((c) => <GameCard key={c.id} testID={`book-card-${c.code}`} card={c} owned={owned.has(c.id)} count={owned.get(c.id)} onPress={() => setOpen(c)} />)}
              {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </ScrollView>
      )}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable testID="card-detail-backdrop" onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: spacing.xl }}>
          {open ? (
            <View testID="card-detail-modal" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ height: 220, flexDirection: "row" }}><GameCard testID="card-detail-visual" card={open} owned /></View>
              <Title size={22}>{open.name}</Title>
              <Body muted>{KIND_LABEL[open.kind]} · {RARITY_LABEL[open.rarity]} · v{open.version}</Body>
              <Body style={{ fontStyle: "italic" }}>{open.lore}</Body>
              <Body>{open.challenge_text ?? open.effect}</Body>
              {open.kind === "offensive" ? <Body muted>Czas na wykonanie: {open.challenge_hours} h. Nie wymusza spotkań w prywatnych miejscach.</Body> : null}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

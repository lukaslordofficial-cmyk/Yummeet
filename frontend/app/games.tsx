import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, Chip, ChipRow, Header, Title } from "@/src/components/ui";
import { questionCategories, questions, tableGames } from "@/src/lib/data";
import { spacing, useTheme } from "@/src/theme";

export default function Games() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [pool, setPool] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => { tableGames().then((g) => setGames(g as any[])).catch(() => {}); questionCategories().then((c) => { setCats(c as any[]); setCat((c as any[])[0]?.code ?? null); }).catch(() => {}); }, []);
  useEffect(() => { if (cat) questions(cat).then((q) => { setPool([...(q as any[])].sort(() => Math.random() - 0.5)); setIdx(0); }).catch(() => {}); }, [cat]);
  const q = pool[idx];

  return (
    <View testID="games-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Gry przy stole" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Title size={18} style={{ paddingHorizontal: spacing.lg }}>Pytania do rozmowy</Title>
        <ChipRow testID="games-category-chips">{cats.map((c) => <Chip key={c.code} testID={`games-cat-${c.code}`} label={c.name} selected={cat === c.code} onPress={() => setCat(c.code)} />)}</ChipRow>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Card testID="games-question-card" accent={colors.brandPrimary}>
            <Title size={20} testID="games-question-text">{q?.text ?? "Brak pytań w tej kategorii"}</Title>
            <Body muted>Każde pytanie możesz pominąć — bez tłumaczenia się.</Body>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Button testID="games-skip-button" title="Pomiń" variant="ghost" onPress={() => setIdx((i) => (pool.length ? (i + 1) % pool.length : 0))} />
              <Button testID="games-next-button" title="Następne" style={{ flex: 1 }} onPress={() => setIdx((i) => (pool.length ? (i + 1) % pool.length : 0))} />
            </View>
          </Card>
          <Title size={18}>Minigry</Title>
          {games.map((g) => (
            <Card key={g.code} testID={`game-${g.code}`}>
              <Title size={16}>{g.name}</Title><Body>{g.description}</Body><Body muted>{g.rules} · {g.min_players}–{g.max_players} os.</Body>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Card, EmptyState, Field, Header, Title, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { duelInvite, searchPeople } from "@/src/lib/data";
import { spacing, useTheme } from "@/src/theme";

export default function NewDuel() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  useEffect(() => {
    const t = setTimeout(() => searchPeople(q).then(setPeople).catch((e) => toast(errorMessage(e), "error")), 350);
    return () => clearTimeout(t);
  }, [q, toast]);

  const invite = async (id: string) => {
    try { const duel = await duelInvite(id); toast("Wyzwanie wysłane!", "success"); router.replace(`/duel/${duel}`); } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <View testID="new-duel-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Wyzwij na pojedynek" />
      <View style={{ paddingHorizontal: spacing.lg }}><Field testID="duel-search-input" value={q} onChangeText={setQ} placeholder="Szukaj Yummiteera…" /></View>
      <FlatList data={people} keyExtractor={(p) => p.id} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
        ListEmptyComponent={<EmptyState testID="duel-search-empty" icon="account-search" title="Nikogo nie znaleziono" />}
        renderItem={({ item }) => (
          <Card testID={`duel-person-${item.id}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}><Title size={16}>{item.display_name}</Title><Body muted>Poziom {item.level}</Body></View>
            <Button testID={`duel-invite-${item.id}`} title="Wyzwij" icon="sword-cross" onPress={() => invite(item.id)} />
          </Card>
        )} />
    </View>
  );
}

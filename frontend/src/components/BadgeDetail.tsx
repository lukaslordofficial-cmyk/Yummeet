import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Title } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "./Icon";

export type BadgeItem = {
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  owned: boolean;
  awarded_at?: string | null;
};

function awardedLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function BadgeDetail({ badge, onClose }: { badge: BadgeItem | null; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const when = awardedLabel(badge?.awarded_at);

  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable testID="badge-detail-backdrop" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(44,37,32,0.55)", justifyContent: "flex-end" }}>
        <Pressable
          testID="badge-detail"
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: badge?.owned ? colors.rarityLegendary : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
            <Icon name={badge?.icon || "medal"} size={34} color={badge?.owned ? colors.onBrandPrimary : colors.onSurface} />
          </View>
          <Title size={24} testID="badge-detail-name">{badge?.name}</Title>
          {badge?.description ? <Body testID="badge-detail-description">{badge.description}</Body> : null}
          {badge?.owned && when ? (
            <Body testID="badge-detail-when">Zdobyta {when}</Body>
          ) : (
            <Body muted testID="badge-detail-locked">Jeszcze nie zdobyta.</Body>
          )}
          <Button testID="badge-detail-close" title="Zamknij" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

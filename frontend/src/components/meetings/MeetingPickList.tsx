import { View } from "react-native";

import { Body, Card, Title } from "@/src/components/ui";
import { spacing } from "@/src/theme";

export function MeetingPickList({
  testID, items, onPick,
}: {
  testID: string;
  items: { key: string; title: string; text: string }[];
  onPick: (key: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
      {items.map((item) => (
        <Card key={item.key} testID={`${testID}-${item.key}`} onPress={() => onPick(item.key)}>
          <Title size={18}>{item.title}</Title>
          <Body muted>{item.text}</Body>
        </Card>
      ))}
    </View>
  );
}

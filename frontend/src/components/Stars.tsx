import { Pressable, View } from "react-native";

import { useTheme } from "@/src/theme";
import { Icon } from "./Icon";

export function Stars({
  value,
  onChange,
  testID,
  size = 28,
}: {
  value: number;
  onChange?: (v: number) => void;
  testID: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const iconFor = (n: number) => {
    if (n <= value) return "star";
    if (n - 0.5 <= value) return "star-half-full";
    return "star-outline";
  };
  return (
    <View testID={testID} style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Icon name={iconFor(n)} size={size} color={colors.warning} />;
        if (!onChange) return <View key={n}>{icon}</View>;
        return (
          <Pressable
            key={n}
            testID={`${testID}-${n}`}
            onPress={() => onChange(n)}
            hitSlop={4}
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

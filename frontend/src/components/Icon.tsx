import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof MaterialDesignIcons>["name"];

export function Icon({ name, size = 22, color }: { name: IconName | string; size?: number; color: string }) {
  return <MaterialDesignIcons name={name as IconName} size={size} color={color} />;
}

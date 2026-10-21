import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof MaterialDesignIcons>["name"];

const SAFE_ICON = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function Icon({ name, size = 22, color }: { name: IconName | string; size?: number; color: string }) {
  const glyph = typeof name === "string" && SAFE_ICON.test(name) ? name : "help-circle";
  return <MaterialDesignIcons name={glyph as IconName} size={size} color={color} />;
}

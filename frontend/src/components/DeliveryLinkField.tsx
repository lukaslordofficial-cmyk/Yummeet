import { Pressable, Text, View } from "react-native";

import { Body, Field, useToast } from "@/src/components/ui";
import type { DeliveryPlatform } from "@/src/lib/deliveryLinks";
import { openDeliveryApp } from "@/src/lib/openExternal";
import { fonts, spacing, useTheme } from "@/src/theme";

const LABEL: Record<DeliveryPlatform, string> = {
  wolt: "Wolt",
  pyszne: "Pyszne.pl",
  glovo: "Glovo",
  uber: "Uber Eats",
};

/** Pole linku dostawcy z klikalnym wejściem do jego aplikacji. */
export function DeliveryAppLauncher({
  platform,
  testID,
}: {
  platform: DeliveryPlatform;
  testID: string;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const label = LABEL[platform];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={() => { void openDeliveryApp(platform).catch(() => toast(`Nie udało się otworzyć ${label}`, "error")); }}
    >
      <Text style={{ fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.brandPrimary, textDecorationLine: "underline" }}>
        Wejdź do aplikacji {label} i skopiuj link
      </Text>
    </Pressable>
  );
}

export function DeliveryLinkField({
  platform,
  testID,
  value,
  onChangeText,
  placeholder,
  error,
  showLauncher = true,
}: {
  platform: DeliveryPlatform;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string | null;
  showLauncher?: boolean;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const label = LABEL[platform];
  const openApp = () => {
    void openDeliveryApp(platform).catch(() => toast(`Nie udało się otworzyć ${label}`, "error"));
  };

  return (
    <View style={{ gap: spacing.xs }}>
      {showLauncher ? (
        <Pressable testID={`${testID}-open-app`} accessibilityRole="link" onPress={openApp}>
          <Text style={{ fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.brandPrimary, textDecorationLine: "underline" }}>
            Wejdź do aplikacji {label} i skopiuj link
          </Text>
        </Pressable>
      ) : null}
      <Field testID={testID} label={`Link ${label}`} value={value} onChangeText={onChangeText} placeholder={placeholder} autoCapitalize="none" />
      {error ? <Body testID={`${testID}-error`} style={{ color: colors.error }}>{error}</Body> : null}
    </View>
  );
}

import { View } from "react-native";

import { Body, Button, Card, Title, useToast } from "@/src/components/ui";
import type { DeliveryPlatform } from "@/src/lib/deliveryLinks";
import { dialPhone, openDeliveryApp, openDeliveryOrWeb, resolvePhone } from "@/src/lib/openExternal";
import { resolveMenuUrl } from "@/src/lib/pinWebsite";
import { spacing } from "@/src/theme";

type PinOrderSource = {
  website?: string | null;
  description?: string | null;
  phone?: string | null;
  order_wolt_url?: string | null;
  order_pyszne_url?: string | null;
  order_glovo_url?: string | null;
  order_uber_url?: string | null;
};

const DELIVERY: { key: keyof PinOrderSource; platform: DeliveryPlatform; label: string; testID: string; icon: string }[] = [
  { key: "order_wolt_url", platform: "wolt", label: "Wolt", testID: "pin-order-wolt", icon: "bike-fast" },
  { key: "order_pyszne_url", platform: "pyszne", label: "Pyszne.pl", testID: "pin-order-pyszne", icon: "food" },
  { key: "order_glovo_url", platform: "glovo", label: "Glovo", testID: "pin-order-glovo", icon: "moped" },
  { key: "order_uber_url", platform: "uber", label: "Uber Eats", testID: "pin-order-uber", icon: "car" },
];

export function PinOrderActions({
  pin,
  onAddWebsite,
}: {
  pin: PinOrderSource;
  onAddWebsite?: () => void;
}) {
  const toast = useToast();
  const menuSite = resolveMenuUrl(pin.website, pin.description);
  const phone = resolvePhone(pin.phone, pin.description);

  const delivery = DELIVERY.map((d) => {
    const raw = pin[d.key];
    const url = typeof raw === "string" ? resolveMenuUrl(raw) : null;
    return { ...d, url };
  });

  const openDelivery = async (url: string, label: string) => {
    try {
      await openDeliveryOrWeb(url);
    } catch {
      toast(`Nie udało się otworzyć: ${label}`, "error");
    }
  };

  const call = async () => {
    if (!phone) return;
    try {
      await dialPhone(phone);
    } catch {
      toast("Nie udało się otworzyć dialera", "error");
    }
  };

  return (
    <Card testID="pin-order-actions">
      <Title size={18}>Zamów jedzenie</Title>
      <Body muted>Bez linku przycisk otwiera aplikację. Po wklejeniu linku z apki otwiera tę knajpę.</Body>
      <View style={{ gap: spacing.sm }}>
        {menuSite ? (
          <Button
            testID="pin-website"
            title="Menu i ceny na stronie"
            icon="open-in-new"
            variant="secondary"
            onPress={() => void openDelivery(menuSite, "strona lokalu")}
          />
        ) : onAddWebsite ? (
          <Button testID="pin-website-add" title="Dodaj stronę z menu" icon="pencil" variant="ghost" onPress={onAddWebsite} />
        ) : null}

        {delivery.map((d) => (
          <Button
            key={d.key}
            testID={d.testID}
            title={d.url ? `Zamów przez ${d.label}` : `Otwórz ${d.label}`}
            icon={d.icon}
            variant={d.url ? "primary" : "secondary"}
            onPress={() => {
              void openDeliveryApp(d.platform, d.url).catch(() => toast(`Nie udało się otworzyć: ${d.label}`, "error"));
            }}
          />
        ))}

        {phone ? (
          <Button
            testID="pin-call"
            title={`Zadzwoń i zamów (${phone})`}
            icon="phone"
            variant="secondary"
            onPress={() => void call()}
          />
        ) : null}
      </View>
    </Card>
  );
}

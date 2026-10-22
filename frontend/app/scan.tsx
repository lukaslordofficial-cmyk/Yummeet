import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { eventCheckin } from "@/src/lib/data";
import { parseEventQr } from "@/src/lib/eventQr";
import { getCurrentPosition } from "@/src/lib/location";
import { rememberScannedEvent } from "@/src/lib/scannedEvents";
import { spacing, useTheme } from "@/src/theme";

export default function ScanEvent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [permission, request] = useCameraPermissions();
  const [done, setDone] = useState(false);

  const open = async (raw: string) => {
    if (done) return;
    const parsed = parseEventQr(raw);
    if (!parsed) return;
    setDone(true);
    await rememberScannedEvent(parsed.eventId);
    if (parsed.code) {
      try {
        const pos = await getCurrentPosition();
        if (pos) await eventCheckin(parsed.eventId, parsed.code, pos.lat, pos.lng);
      } catch (e) {
        toast(errorMessage(e), "info");
      }
    }
    router.replace(`/games?event=${parsed.eventId}&scanned=1`);
  };

  return (
    <View testID="scan-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Skaner spotkania" />
      {!permission?.granted ? (
        <View style={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
          <Body>Aparat jest potrzebny, żeby odczytać kod QR wydarzenia i otworzyć panel zabaw.</Body>
          <Button testID="scan-permission" title="Włącz aparat" onPress={() => void request()} />
        </View>
      ) : (
        <CameraView
          testID="scan-camera"
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => { void open(data); }}
        />
      )}
    </View>
  );
}

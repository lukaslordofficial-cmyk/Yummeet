import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Field, Header, useToast } from "@/src/components/ui";
import { errorMessage } from "@/src/lib/api";
import { parseEntryCode } from "@/src/lib/eventQr";
import { openMeetingCode } from "@/src/lib/meetingEntry";
import { spacing, useTheme } from "@/src/theme";

export default function ScanEvent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [permission, request] = useCameraPermissions();
  const [done, setDone] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const open = async (raw: string, manual = false) => {
    if (done || !raw.trim()) return;
    if (!parseEntryCode(raw)) {
      if (manual) toast("Wpisz kod z karty organizatora.", "info");
      return;
    }
    setBusy(true);
    try {
      const eventId = await openMeetingCode(raw);
      setDone(true);
      router.replace(`/games?event=${eventId}&scanned=1`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="scan-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Skaner spotkania" />
      {!permission?.granted ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Body>Aparat odczyta kod QR. Możesz też wpisać kod ręcznie.</Body>
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
      <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Field testID="scan-code-input" label="Kod spotkania" value={typed} onChangeText={setTyped} autoCapitalize="characters" placeholder="np. AB12CD" />
        <Button testID="scan-code-open" title="Otwórz panel" loading={busy} onPress={() => void open(typed, true)} />
      </View>
    </View>
  );
}

import QRCode from "qrcode";
import { View } from "react-native";

/** Czarny kod QR na białym tle, z cichą strefą, żeby aparat mógł go odczytać. */
export function QrMark({ value, size = 220, testID }: { value: string; size?: number; testID?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "Q" });
  const n = qr.modules.size;
  const quiet = 4;
  const cell = Math.max(2, Math.floor(size / (n + quiet * 2)));
  const bits = qr.modules.data;
  const pad = quiet * cell;
  return (
    <View testID={testID} style={{ backgroundColor: "#FFFFFF", alignSelf: "center", padding: pad }}>
      <View style={{ width: cell * n, height: cell * n, backgroundColor: "#FFFFFF" }}>
        {Array.from({ length: n }, (_, y) => (
          <View key={y} style={{ flexDirection: "row" }}>
            {Array.from({ length: n }, (_, x) => (
              <View key={x} style={{ width: cell, height: cell, backgroundColor: bits[y * n + x] ? "#000000" : "#FFFFFF" }} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

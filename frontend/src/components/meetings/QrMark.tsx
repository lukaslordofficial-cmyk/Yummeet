import QRCode from "qrcode";
import { View } from "react-native";

/** Czarny kod QR na białym tle, bez dodatkowej biblioteki widoku. */
export function QrMark({ value, size = 220, testID }: { value: string; size?: number; testID?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = Math.max(2, Math.floor(size / n));
  const bits = qr.modules.data;
  return (
    <View testID={testID} style={{ width: cell * n, height: cell * n, backgroundColor: "#FFFFFF", alignSelf: "center" }}>
      {Array.from({ length: n }, (_, y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {Array.from({ length: n }, (_, x) => (
            <View key={x} style={{ width: cell, height: cell, backgroundColor: bits[y * n + x] ? "#000000" : "#FFFFFF" }} />
          ))}
        </View>
      ))}
    </View>
  );
}

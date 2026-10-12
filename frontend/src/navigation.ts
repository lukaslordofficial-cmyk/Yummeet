import { Platform } from "react-native";

// NativeTabs (Liquid Glass) only on iOS 26+; everything else uses the classic JS <Tabs>.
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

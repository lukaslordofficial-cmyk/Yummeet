import { decode } from "base64-arraybuffer";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { rpc } from "./api";
import { supabase } from "./supabase";

/** Max jednocześnie trzymanych zdjęć dań / misji / inspiracji / stołów (konto free). */
export const FREE_PHOTO_SLOTS = 3;

function randomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function compressForUpload(uri: string): Promise<string> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
    );
    return out.uri;
  } catch {
    return uri;
  }
}

async function ensureReadableUri(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  if (uri.startsWith("file://") || uri.startsWith(FileSystem.cacheDirectory ?? "")) return uri;
  // content:// i podobne — skopiuj do cache, żeby FileSystem mógł odczytać
  try {
    const dest = `${FileSystem.cacheDirectory}yummeet_${randomId()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/** RN: Blob/FormData bywa zawodne — base64 → ArrayBuffer/Uint8Array. */
async function readUriAsBase64(uri: string): Promise<string> {
  const readable = await ensureReadableUri(uri);
  const encoding =
    (FileSystem as { EncodingType?: { Base64: string } }).EncodingType?.Base64 ?? "base64";
  return FileSystem.readAsStringAsync(readable, { encoding: encoding as any });
}

async function uploadBytes(
  bucket: string,
  userId: string,
  body: ArrayBuffer | Uint8Array,
  mime: string,
  ext: string,
): Promise<string> {
  const path = `${userId}/${randomId()}.${ext}`;
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  if (bytes.byteLength < 32) throw new Error("Nie udało się odczytać pliku zdjęcia.");

  const { data, error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    const msg = error.message || "Upload do Storage nieudany.";
    if (/bucket|not found|row-level security|policy/i.test(msg)) {
      throw new Error("Brak bucketu pin-photos lub polityk Storage — uruchom migrację 004 w Supabase.");
    }
    throw new Error(msg);
  }
  const pub = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  if (!pub) throw new Error("Brak publicznego URL zdjęcia.");
  return pub;
}

async function uploadImageFromUri(bucket: string, userId: string, uri: string, base64Hint?: string | null): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const ab = await res.arrayBuffer();
    return uploadBytes(bucket, userId, ab, "image/jpeg", "jpg");
  }

  let base64 = base64Hint?.trim() || "";
  if (!base64) {
    const compressed = await compressForUpload(uri);
    base64 = await readUriAsBase64(compressed);
  } else {
    // base64 z pickera — i tak skompresuj przez manipulator jeśli da się zapisać tymczasowo
    try {
      const compressed = await compressForUpload(uri);
      base64 = await readUriAsBase64(compressed);
    } catch {
      // użyj oryginalnego base64
    }
  }
  if (!base64 || base64.length < 64) throw new Error("Puste dane zdjęcia — spróbuj inne zdjęcie.");
  return uploadBytes(bucket, userId, decode(base64), "image/jpeg", "jpg");
}

export type PhotoQuota = { used: number; limit: number; remaining: number; model?: string };

export async function photoQuotaStatus(limit = FREE_PHOTO_SLOTS): Promise<PhotoQuota> {
  try {
    return await rpc<PhotoQuota>("photo_slot_status", { p_limit: limit });
  } catch {
    try {
      return await rpc<PhotoQuota>("photo_quota_status", { p_limit: limit });
    } catch {
      // Migracja slotów jeszcze nieodpalona — nie blokuj uploadu po stronie klienta
      return { used: 0, limit, remaining: limit, model: "offline" };
    }
  }
}

/**
 * Gallery / camera → JPEG w `pin-photos`.
 * `enforceSlots`: sprawdza wolny slot (claim robi RPC przy publikacji).
 * Pin lokalu i menu: bez slotów.
 */
export async function pickPinPhoto(
  userId: string,
  source: "gallery" | "camera",
  opts?: { enforceSlots?: boolean; /** @deprecated */ enforceQuota?: boolean; quotaLimit?: number },
): Promise<string | null> {
  if (!userId) throw new Error("Brak sesji użytkownika.");
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Brak zgody na aparat.");
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("Brak zgody na galerię.");
  }
  const pickerOpts: ImagePicker.ImagePickerOptions = {
    quality: 0.85,
    allowsEditing: true,
    aspect: [4, 3],
    base64: true,
    exif: false,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOpts)
      : await ImagePicker.launchImageLibraryAsync({ ...pickerOpts, mediaTypes: ["images"] });
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  if (opts?.enforceSlots || opts?.enforceQuota) {
    const st = await photoQuotaStatus(opts.quotaLimit ?? FREE_PHOTO_SLOTS);
    if (st.remaining <= 0) throw new Error("photo_slots_full");
  }

  const asset = result.assets[0];
  return uploadImageFromUri("pin-photos", userId, asset.uri, asset.base64);
}

export async function pickMenuPdf(userId: string): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (Platform.OS === "web") {
    const res = await fetch(asset.uri);
    return uploadBytes("pin-photos", userId, await res.arrayBuffer(), "application/pdf", "pdf");
  }
  const base64 = await readUriAsBase64(asset.uri);
  return uploadBytes("pin-photos", userId, decode(base64), "application/pdf", "pdf");
}

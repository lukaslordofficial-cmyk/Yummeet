import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { rpc } from "./api";
import { supabase } from "./supabase";

/** Max jednocześnie trzymanych zdjęć dań / misji / inspiracji / stołów (konto free). */
export const FREE_PHOTO_SLOTS = 3;

function randomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function compressForUpload(uri: string): Promise<{ uri: string; mime: string }> {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: out.uri, mime: "image/jpeg" };
}

async function uploadBytes(bucket: string, userId: string, uri: string, mime: string, ext: string): Promise<string> {
  const path = `${userId}/${randomId()}.${ext}`;
  const res = await fetch(uri);
  const buf = await res.arrayBuffer();
  const { data, error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
}

export type PhotoQuota = { used: number; limit: number; remaining: number; model?: string };

export async function photoQuotaStatus(limit = FREE_PHOTO_SLOTS): Promise<PhotoQuota> {
  try {
    return await rpc<PhotoQuota>("photo_slot_status", { p_limit: limit });
  } catch {
    return rpc<PhotoQuota>("photo_quota_status", { p_limit: limit });
  }
}

/**
 * Gallery / camera → JPEG w `pin-photos`.
 * `enforceSlots`: sprawdza wolny slot (claim robi RPC przy publikacji / misji / stole).
 * Pin lokalu i menu: bez slotów.
 */
export async function pickPinPhoto(
  userId: string,
  source: "gallery" | "camera",
  opts?: { enforceSlots?: boolean; /** @deprecated */ enforceQuota?: boolean; quotaLimit?: number },
): Promise<string | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Brak zgody na aparat.");
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("Brak zgody na galerię.");
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: true, aspect: [4, 3] });
  if (result.canceled) return null;

  if (opts?.enforceSlots || opts?.enforceQuota) {
    const st = await photoQuotaStatus(opts.quotaLimit ?? FREE_PHOTO_SLOTS);
    if (st.remaining <= 0) throw new Error("photo_slots_full");
  }

  const compressed = await compressForUpload(result.assets[0].uri);
  return uploadBytes("pin-photos", userId, compressed.uri, compressed.mime, "jpg");
}

export async function pickMenuPdf(userId: string): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return uploadBytes("pin-photos", userId, asset.uri, "application/pdf", "pdf");
}

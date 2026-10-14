import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { rpc } from "./api";
import { supabase } from "./supabase";

function randomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Max bok ~1280 px + JPEG ~0.55 ≈ zwykle 80–250 KB zamiast kilku MB. */
async function compressForUpload(uri: string): Promise<{ uri: string; mime: string }> {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: out.uri, mime: "image/jpeg" };
}

async function uploadLocalUri(bucket: string, userId: string, uri: string, mime: string): Promise<string> {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/${randomId()}.${ext}`;
  const res = await fetch(uri);
  const buf = await res.arrayBuffer();
  const { data, error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: mime.startsWith("image/") ? mime : "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
}

export type PhotoQuota = { used: number; limit: number; remaining: number; year_month: string };

export async function photoQuotaStatus(limit = 5): Promise<PhotoQuota> {
  return rpc<PhotoQuota>("photo_quota_status", { p_limit: limit });
}

/**
 * Gallery or camera → compressed JPEG in `pin-photos`.
 * `enforceQuota: true` = limit free (5/miesiąc) — używaj przy Jedzeniu.
 */
export async function pickPinPhoto(
  userId: string,
  source: "gallery" | "camera",
  opts?: { enforceQuota?: boolean; quotaLimit?: number },
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

  // Quota przed uploadem (żeby nie marnować Storage); przy błędzie uploadu slot i tak zużyty — rzadkie.
  if (opts?.enforceQuota) {
    await rpc("claim_photo_upload", { p_limit: opts.quotaLimit ?? 5 });
  }

  const compressed = await compressForUpload(result.assets[0].uri);
  return uploadLocalUri("pin-photos", userId, compressed.uri, compressed.mime);
}

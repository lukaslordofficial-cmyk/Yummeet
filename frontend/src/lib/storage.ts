import * as ImagePicker from "expo-image-picker";

import { supabase } from "./supabase";

function randomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function uploadLocalUri(bucket: string, userId: string, uri: string, mime: string): Promise<string> {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/${randomId()}.${ext}`;
  const res = await fetch(uri);
  const blob = await res.blob();
  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: mime.startsWith("image/") ? mime : "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
}

/** Gallery or camera → public URL in `pin-photos` bucket. */
export async function pickPinPhoto(userId: string, source: "gallery" | "camera"): Promise<string | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Brak zgody na aparat.");
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("Brak zgody na galerię.");
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg";
  return uploadLocalUri("pin-photos", userId, asset.uri, mime);
}

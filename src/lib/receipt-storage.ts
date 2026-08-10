/**
 * Receipt image storage — uploads to Supabase Storage and returns a public URL.
 *
 * Edge functions cannot read device-local file URIs, so we upload the image
 * to a Supabase Storage bucket first and pass the public URL to the OCR
 * edge function instead.
 *
 * Flow: local asset → decode base64 → upload to `receipts` bucket → public URL
 * See supabase/migrations/20260809020000_create_receipts_storage.sql for bucket/RLS setup.
 */

import { supabase } from "./supabase";

export const RECEIPTS_BUCKET = "receipts";

/** Convert a base64 string (data URI or raw) into Uint8Array bytes. */
function decodeBase64(base64: string): Uint8Array {
  // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
  let cleaned = base64.replace(/^data:[^;]+;base64,/, "");

  // Native atob is available on React Native 0.86+ / modern bundlers,
  // so the Buffer (Node stdlib) fallback is not needed on device.
  if (typeof atob === "function") {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Dependency-free fallback (base64 → Uint8Array) for environments
  // without atob. Keeps this module free of Node-stdlib imports so Metro
  // can bundle it for the native React runtime.
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Int8Array(128);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let len = cleaned.length;
  if (len % 4 !== 0) {
    // Only accept well-formed base64; trim trailing "=" padding anyway.
    const trimmed = cleaned.replace(/=+$/, "");
    if (trimmed.length % 4 === 0) {
      cleaned = trimmed;
      len = cleaned.length;
    }
  }

  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < len; i++) {
    const c = cleaned.charCodeAt(i);
    const val = c < 128 ? lookup[c] : -1;
    if (val < 0) continue; // skip whitespace / invalid chars
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }

  return out.slice(0, o);
}

/** Determine the MIME type from a URI or base64 prefix. */
function getMimeType(uri: string, base64?: string): string {
  // Prefer the MIME hinted by the data URI in the base64 payload.
  if (base64) {
    const match = base64.match(/^data:(image\/[a-z0-9.+-]+);base64/i);
    if (match) return match[1];
  }

  // Otherwise infer from the file extension in the URI.
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    heic: "image/heic",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/jpeg";
}

/**
 * Upload a receipt image (captured by the scanner as a local URI + optional base64)
 * to the `receipts` Supabase Storage bucket and return its public URL.
 *
 * @returns the public URL of the uploaded image, or null on failure.
 */
export async function uploadReceiptImage(
  uri: string,
  userId: string,
  base64?: string,
): Promise<string | null> {
  if (!supabase || !userId || !uri) return null;

  // Generate a deterministic-ish unique path scoped per user.
  const timestamp = Date.now();
  const ext =
    uri
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? "jpg";
  const path = `${userId}/${timestamp}.${ext}`;
  const mimeType = getMimeType(uri, base64);

  try {
    let uploadResult;

    if (base64 && base64.length > 0) {
      // Decode and upload raw bytes — works in JS thread without a file-system fetch.
      const bytes = decodeBase64(base64);
      uploadResult = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, bytes, {
          contentType: mimeType,
          upsert: true,
        });
    } else {
      // No base64 available — fetch the local asset and upload as a blob.
      const response = await fetch(uri);
      const blob = await response.blob();
      uploadResult = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, blob, {
          contentType: mimeType,
          upsert: true,
        });
    }

    if (uploadResult.error || !uploadResult.data) {
      console.error(
        "receipt-storage: upload failed:",
        uploadResult.error?.message,
      );
      return null;
    }

    // The bucket is public, so getPublicUrl returns a directly-fetchable URL
    // (the edge function can curl it without auth headers).
    const { data: urlData } = supabase.storage
      .from(RECEIPTS_BUCKET)
      .getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.error(
      "receipt-storage: upload threw:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

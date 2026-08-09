export type StorageBucket =
  | "product-images"
  | "islandcoolersimg"
  | "avatars"
  | "delivery-proofs";

/** Default public product-image bucket for this project. */
export const PRODUCT_IMAGE_BUCKET: StorageBucket = "islandcoolersimg";

function extensionFor(file: File | Blob, filename?: string): string {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const type = "type" in file ? file.type : "";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function buildStoragePath(folder: string, file: File): string {
  const ext = extensionFor(file, file.name);
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export function publicObjectUrl(bucket: StorageBucket, path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

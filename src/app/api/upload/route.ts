import {
  assertRole,
  getSessionProfileFromCookies,
} from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildStoragePath,
  publicObjectUrl,
  PRODUCT_IMAGE_BUCKET,
  type StorageBucket,
} from "@/lib/supabase/storage";
import { updateProductImageInSupabase } from "@/lib/supabase/catalog";

const ALLOWED_BUCKETS: StorageBucket[] = [
  "product-images",
  "islandcoolersimg",
  "avatars",
  "delivery-proofs",
];

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const profile = await getSessionProfileFromCookies();
  if (!assertRole(profile, "authenticated")) {
    return jsonError("Unauthorized.", 401);
  }
  if (!isSupabaseConfigured()) {
    return jsonError(
      "Supabase Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and keys.",
      503
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Invalid form data.");

  const file = form.get("file");
  const bucketRaw = String(form.get("bucket") ?? PRODUCT_IMAGE_BUCKET);
  const folder = String(form.get("folder") ?? profile.id).replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );
  const productId = form.get("productId");

  if (!(file instanceof File)) {
    return jsonError("File is required.");
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("Only image uploads are allowed.");
  }
  if (file.size > MAX_BYTES) {
    return jsonError("Image must be 5MB or smaller.");
  }
  if (!ALLOWED_BUCKETS.includes(bucketRaw as StorageBucket)) {
    return jsonError("Invalid storage bucket.");
  }

  const bucket = bucketRaw as StorageBucket;
  const isProductBucket =
    bucket === "product-images" || bucket === "islandcoolersimg";

  if (isProductBucket && !assertRole(profile, "staff")) {
    return jsonError("Staff only.", 403);
  }
  if (bucket === "delivery-proofs" && !assertRole(profile, "driver") && !assertRole(profile, "staff")) {
    return jsonError("Forbidden.", 403);
  }

  const client = await createServerClient();
  if (!client) return jsonError("Supabase is not configured.", 503);

  const path = buildStoragePath(folder || profile.id, file);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    return jsonError(error.message, 502);
  }

  let publicUrl = publicObjectUrl(bucket, path);

  if (bucket === "delivery-proofs") {
    const { data: signed, error: signError } = await client.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signError || !signed?.signedUrl) {
      return jsonError(signError?.message ?? "Could not sign URL.", 502);
    }
    publicUrl = signed.signedUrl;
  }

  if (
    isProductBucket &&
    typeof productId === "string" &&
    /^[0-9a-f-]{36}$/i.test(productId)
  ) {
    await updateProductImageInSupabase(productId, publicUrl);
  }

  return jsonOk({ path, publicUrl, bucket });
}

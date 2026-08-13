import {
  assertRole,
  getSessionProfileFromCookies,
} from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { updateAccountProfile } from "@/lib/auth/accounts";
import {
  updateCategoryImageInSupabase,
  updateProductImageInSupabase,
} from "@/lib/supabase/catalog";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildImageObjectKey,
  getSignedS3ObjectUrl,
  isS3Configured,
  kindFromBucketHint,
  uploadImageToS3,
} from "@/lib/storage/s3";

const MAX_BYTES = 5 * 1024 * 1024;

async function saveAvatarUrl(
  userId: string,
  publicUrl: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const client = await createServerClient();
    if (client) {
      await client
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      return;
    }
  }
  await updateAccountProfile(userId, { avatar_url: publicUrl });
}

export async function POST(request: Request) {
  const profile = await getSessionProfileFromCookies();
  if (!assertRole(profile, "authenticated")) {
    return jsonError("Unauthorized.", 401);
  }

  if (!isS3Configured()) {
    const onVercel = Boolean(process.env.VERCEL);
    return jsonError(
      onVercel
        ? "S3 is not configured on Vercel. Add S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT, S3_REGION in Project Settings → Environment Variables, then Redeploy."
        : "S3 is not configured. Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET.",
      503
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Invalid form data.");

  const file = form.get("file");
  const bucketHint = String(form.get("bucket") ?? "islandcoolersimg");
  const folderRaw = String(form.get("folder") ?? profile.id);
  const productId = form.get("productId");
  const categoryId = form.get("categoryId");
  const kind = kindFromBucketHint(bucketHint);

  if (!(file instanceof File)) {
    return jsonError("File is required.");
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("Only image uploads are allowed.");
  }
  if (file.size > MAX_BYTES) {
    return jsonError("Image must be 5MB or smaller.");
  }

  if (kind === "products" && !assertRole(profile, "staff")) {
    return jsonError("Staff only.", 403);
  }
  if (
    kind === "delivery-proofs" &&
    !assertRole(profile, "driver") &&
    !assertRole(profile, "staff")
  ) {
    return jsonError("Forbidden.", 403);
  }

  // Avatars always land under the signed-in user's folder
  const folder = kind === "avatars" ? profile.id : folderRaw;

  const key = buildImageObjectKey({
    kind,
    folder,
    filename: file.name,
    contentType: file.type || "image/jpeg",
  });
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const uploaded = await uploadImageToS3({
      body: buffer,
      contentType: file.type || "image/jpeg",
      key,
    });

    let publicUrl = uploaded.publicUrl;
    if (kind === "delivery-proofs") {
      publicUrl = await getSignedS3ObjectUrl(key);
    }

    if (
      kind === "products" &&
      typeof productId === "string" &&
      /^[0-9a-f-]{36}$/i.test(productId)
    ) {
      await updateProductImageInSupabase(productId, publicUrl);
    }

    if (
      kind === "products" &&
      typeof categoryId === "string" &&
      /^[0-9a-f-]{36}$/i.test(categoryId)
    ) {
      await updateCategoryImageInSupabase(categoryId, publicUrl);
    }

    if (kind === "avatars") {
      await saveAvatarUrl(profile.id, publicUrl);
    }

    return jsonOk({
      path: key,
      publicUrl,
      bucket: process.env.S3_BUCKET || "islandcoolersimg",
      storage: "s3",
      avatarUpdated: kind === "avatars",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "S3 upload failed.";
    return jsonError(message, 502);
  }
}

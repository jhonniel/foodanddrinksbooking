import "server-only";

import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ImageKind = "products" | "avatars" | "delivery-proofs";

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim() &&
      (process.env.S3_BUCKET?.trim() ||
        process.env.NEXT_PUBLIC_S3_BUCKET?.trim())
  );
}

export function getS3Bucket(): string {
  return (
    process.env.S3_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_S3_BUCKET?.trim() ||
    "islandcoolersimg"
  );
}

export function getS3Region(): string {
  return process.env.S3_REGION?.trim() || "ap-southeast-1";
}

export function getS3Endpoint(): string {
  const fromEnv = process.env.S3_ENDPOINT?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (projectUrl) {
    // https://xxx.supabase.co → https://xxx.storage.supabase.co/storage/v1/s3
    const host = projectUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const ref = host.split(".")[0];
    return `https://${ref}.storage.supabase.co/storage/v1/s3`;
  }
  return "";
}

function createS3Client(): S3Client {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = getS3Endpoint();
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("S3 is not configured.");
  }

  return new S3Client({
    region: getS3Region(),
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function extensionFor(filename: string | undefined, contentType: string): string {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

export function buildImageObjectKey(input: {
  kind: ImageKind;
  folder: string;
  filename?: string;
  contentType: string;
}): string {
  const ext = extensionFor(input.filename, input.contentType);
  const safeFolder = input.folder.replace(/[^a-zA-Z0-9_-]/g, "") || "misc";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return `${input.kind}/${safeFolder}/${name}`;
}

/** Public URL for objects in a public bucket. */
export function publicS3ObjectUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
  const bucket = getS3Bucket();
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${key}`;
}

export async function uploadImageToS3(input: {
  body: Buffer;
  contentType: string;
  key: string;
}): Promise<{ key: string; publicUrl: string }> {
  const client = createS3Client();
  const bucket = getS3Bucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType || "image/jpeg",
      CacheControl: "public, max-age=3600",
    })
  );

  return {
    key: input.key,
    publicUrl: publicS3ObjectUrl(input.key),
  };
}

/** Signed URL for private objects (e.g. delivery proofs). */
export async function getSignedS3ObjectUrl(
  key: string,
  expiresInSec = 60 * 60 * 24 * 7
): Promise<string> {
  const client = createS3Client();
  const bucket = getS3Bucket();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSec }
  );
}

export function kindFromBucketHint(hint: string): ImageKind {
  if (hint === "avatars") return "avatars";
  if (hint === "delivery-proofs") return "delivery-proofs";
  return "products";
}

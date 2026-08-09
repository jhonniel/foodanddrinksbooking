import { NextResponse } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import { getS3Bucket, isS3Configured } from "@/lib/storage/s3";

export async function GET() {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const anon = Boolean(getSupabaseAnonKey());
  const service = Boolean(getSupabaseServiceRoleKey());
  const configured = isSupabaseConfigured();
  const s3 = isS3Configured();

  if (!configured) {
    return NextResponse.json({
      configured: false,
      auth: false,
      database: false,
      storage: false,
      missing: [
        !url && "NEXT_PUBLIC_SUPABASE_URL",
        !anon &&
          "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        !service && "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)",
        !s3 && "S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET",
      ].filter(Boolean),
    });
  }

  const client = await createServerClient();
  let database = false;
  let auth = false;
  let storage = s3;

  if (client) {
    const { error: dbError } = await client
      .from("categories")
      .select("id")
      .limit(1);
    database = !dbError;

    const { error: authError } = await client.auth.getUser();
    auth = authError == null || authError.message.includes("session");

    if (!s3) {
      const { data: buckets, error: storageError } =
        await client.storage.listBuckets();
      storage =
        !storageError &&
        Boolean(
          buckets?.some(
            (b) =>
              b.name === getS3Bucket() ||
              b.name === "product-images" ||
              b.name === "islandcoolersimg"
          )
        );
    }
  }

  return NextResponse.json({
    configured: true,
    auth,
    database,
    storage,
    s3,
    bucket: getS3Bucket(),
    missing: [
      !service && "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)",
      !s3 && "S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY",
      !database && "Run supabase/bootstrap.sql in the SQL editor",
    ].filter(Boolean),
  });
}

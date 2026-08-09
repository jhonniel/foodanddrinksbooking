import { NextResponse } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const anon = Boolean(getSupabaseAnonKey());
  const service = Boolean(getSupabaseServiceRoleKey());
  const configured = isSupabaseConfigured();

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
      ].filter(Boolean),
    });
  }

  const client = await createServerClient();
  let database = false;
  let storage = false;
  let auth = false;

  if (client) {
    const { error: dbError } = await client
      .from("categories")
      .select("id")
      .limit(1);
    database = !dbError;

    const { data: buckets, error: storageError } =
      await client.storage.listBuckets();
    storage =
      !storageError &&
      Boolean(
        buckets?.some(
          (b) =>
            b.name === "product-images" ||
            b.id === "product-images" ||
            b.name === "islandcoolersimg" ||
            b.id === "islandcoolersimg"
        )
      );

    const { error: authError } = await client.auth.getUser();
    auth = authError == null || authError.message.includes("session");
  }

  return NextResponse.json({
    configured: true,
    auth,
    database,
    storage,
    missing: [
      !service && "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)",
      !storage && "Run migration 005_storage_buckets.sql",
      !database && "Run migrations 001–004 in Supabase SQL editor",
    ].filter(Boolean),
  });
}

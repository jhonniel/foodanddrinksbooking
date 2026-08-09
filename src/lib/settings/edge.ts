import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/auth/config";

/** Edge-safe: read maintenance flag from Supabase (public SELECT on app_settings). */
export async function readMaintenanceModeFromSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle();

  const value = data?.value;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  return false;
}

/** Edge-safe: resolve profile role from Supabase Auth cookies + profiles table. */
export async function readProfileRoleFromRequest(
  request: NextRequest
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Cookie refresh handled by auth routes / layout.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role) return profile.role as string;

  return (
    (user.app_metadata?.role as string | undefined) ||
    (user.user_metadata?.role as string | undefined) ||
    "CUSTOMER"
  );
}

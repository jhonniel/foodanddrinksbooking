import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/auth/config";

/** Service-role or anon client for privileged server ops (no user cookies). */
export async function createServerClient() {
  if (!isSupabaseConfigured()) return null;

  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey() || getSupabaseAnonKey();

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cookie-bound Supabase client for Auth (login/logout/session). */
export async function createBrowserLikeServerClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}

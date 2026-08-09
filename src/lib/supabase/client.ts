import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/auth/config";

export function createBrowserClient() {
  if (!isSupabaseConfigured()) return null;

  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** @deprecated use createBrowserClient */
export const supabase = null;

export { isSupabaseConfigured as isDemoMode };

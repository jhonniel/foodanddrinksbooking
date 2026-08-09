import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/auth/config";

export function createBrowserClient() {
  if (!isSupabaseConfigured()) return null;

  return createSSRBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}

/** @deprecated use createBrowserClient */
export const supabase = null;

export { isSupabaseConfigured as isDemoMode };

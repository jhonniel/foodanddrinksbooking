import { clearSessionCookie, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createBrowserLikeServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (isSupabaseConfigured()) {
    const supabase = await createBrowserLikeServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  const response = jsonOk({ ok: true });
  clearSessionCookie(response);
  return response;
}

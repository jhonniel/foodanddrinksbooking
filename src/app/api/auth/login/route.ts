import { z } from "zod";
import { authenticateAccount } from "@/lib/auth/accounts";
import {
  isSupabaseConfigured,
  requiresSupabaseOnVercel,
} from "@/lib/auth/config";
import { setSessionCookie, jsonError, jsonOk } from "@/lib/auth/http";
import {
  createBrowserLikeServerClient,
  createServerClient,
} from "@/lib/supabase/server";
import type { Profile } from "@/types";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid email or password.");
  }

  if (requiresSupabaseOnVercel()) {
    return jsonError(
      "Login is not available: configure Supabase env vars on Vercel (NEXT_PUBLIC_SUPABASE_URL, ANON KEY, SERVICE ROLE KEY).",
      503
    );
  }

  const { email, password } = parsed.data;

  if (isSupabaseConfigured()) {
    const supabase = await createBrowserLikeServerClient();
    if (!supabase) return jsonError("Auth is not configured.", 500);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return jsonError("Invalid email or password.", 401);
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    const profile = (profileRow as Profile | null) ?? {
      id: data.user.id,
      email: data.user.email ?? email,
      full_name:
        (data.user.user_metadata?.full_name as string) ||
        email.split("@")[0],
      phone: (data.user.user_metadata?.phone as string) || null,
      avatar_url: null,
      role: "CUSTOMER" as const,
      is_active: true,
      points_balance: 0,
      lifetime_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Keep app_metadata.role in sync for middleware fallbacks
    if (profileRow?.role) {
      const metaRole = data.user.app_metadata?.role;
      if (metaRole !== profileRow.role) {
        const admin = await createServerClient();
        if (admin) {
          await admin.auth.admin.updateUserById(data.user.id, {
            app_metadata: { role: profileRow.role },
          });
        }
      }
    }

    return jsonOk({ profile });
  }

  const result = await authenticateAccount(email, password);
  if ("error" in result) {
    return jsonError(result.error, 401);
  }

  const response = jsonOk({ profile: result.profile });
  await setSessionCookie(response, {
    id: result.profile.id,
    email: result.profile.email,
    role: result.profile.role,
  });
  return response;
}

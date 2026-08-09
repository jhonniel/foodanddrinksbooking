import { z } from "zod";
import { registerAccount } from "@/lib/auth/accounts";
import {
  isSupabaseConfigured,
  requiresSupabaseOnVercel,
} from "@/lib/auth/config";
import { setSessionCookie, jsonError, jsonOk } from "@/lib/auth/http";
import {
  createBrowserLikeServerClient,
  createServerClient,
} from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  if (requiresSupabaseOnVercel()) {
    return jsonError(
      "Sign up is not available: configure Supabase env vars on Vercel (NEXT_PUBLIC_SUPABASE_URL, ANON KEY, SERVICE ROLE KEY).",
      503
    );
  }

  const { email, password, fullName, phone } = parsed.data;

  if (isSupabaseConfigured()) {
    const supabase = await createBrowserLikeServerClient();
    if (!supabase) return jsonError("Auth is not configured.", 500);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone ?? null,
        },
      },
    });

    if (error || !data.user) {
      return jsonError(error?.message ?? "Registration failed.");
    }

    let role: UserRole = "CUSTOMER";
    let bootstrappedAdmin = false;

    // First staff bootstrap when no admins exist yet (matches local .data behavior).
    const adminClient = await createServerClient();
    if (adminClient) {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["ADMIN", "SUPER_ADMIN"]);

      if ((count ?? 0) === 0) {
        const { data: promoted } = await adminClient
          .from("profiles")
          .update({
            role: "SUPER_ADMIN",
            full_name: fullName,
            phone: phone ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id)
          .select("*")
          .maybeSingle();

        if (promoted) {
          role = "SUPER_ADMIN";
          bootstrappedAdmin = true;
          await adminClient.auth.admin.updateUserById(data.user.id, {
            app_metadata: { role: "SUPER_ADMIN" },
          });
        }
      }
    }

    const profile: Profile = {
      id: data.user.id,
      email,
      full_name: fullName,
      phone: phone ?? null,
      avatar_url: null,
      role,
      is_active: true,
      points_balance: 0,
      lifetime_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return jsonOk({ profile, bootstrappedAdmin });
  }

  const result = await registerAccount({
    email,
    password,
    fullName,
    phone,
  });

  if ("error" in result) {
    return jsonError(result.error);
  }

  const response = jsonOk({
    profile: result.profile,
    bootstrappedAdmin: result.profile.role === "SUPER_ADMIN",
  });
  await setSessionCookie(response, {
    id: result.profile.id,
    email: result.profile.email,
    role: result.profile.role,
  });
  return response;
}

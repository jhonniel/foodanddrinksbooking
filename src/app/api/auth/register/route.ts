import { NextResponse } from "next/server";
import { z } from "zod";
import { registerAccount } from "@/lib/auth/accounts";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { setSessionCookie, jsonError, jsonOk } from "@/lib/auth/http";
import { createBrowserLikeServerClient } from "@/lib/supabase/server";

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

    // Profile is created by DB trigger as CUSTOMER (hardened migration).
    const profile = {
      id: data.user.id,
      email,
      full_name: fullName,
      phone: phone ?? null,
      avatar_url: null,
      role: "CUSTOMER" as const,
      is_active: true,
      points_balance: 0,
      lifetime_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const response = jsonOk({ profile, bootstrappedAdmin: false });
    return response;
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

import { z } from "zod";
import { registerAccount } from "@/lib/auth/accounts";
import { getSessionProfileFromCookies } from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional().nullable(),
  role: z.enum(["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN", "DRIVER"]),
});

export async function POST(request: Request) {
  const actor = await getSessionProfileFromCookies();
  if (!actor || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    return jsonError("Forbidden.", 403);
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid input.");
  }

  const { email, password, fullName, phone, role } = parsed.data;

  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    if (!supabase) return jsonError("Auth is not configured.", 500);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone ?? null },
    });

    if (error || !data.user) {
      return jsonError(error?.message ?? "Failed to create user.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({
        role,
        full_name: fullName,
        phone: phone ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.user.id)
      .select("*")
      .maybeSingle();

    if (profileError) {
      return jsonError(profileError.message);
    }

    return jsonOk({ profile });
  }

  const result = await registerAccount({
    email,
    password,
    fullName,
    phone,
    role,
    forceRole: true,
  });

  if ("error" in result) {
    return jsonError(result.error);
  }

  return jsonOk({ profile: result.profile });
}

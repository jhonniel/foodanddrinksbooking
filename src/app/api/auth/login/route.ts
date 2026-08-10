import { z } from "zod";
import { authenticateAccount } from "@/lib/auth/accounts";
import {
  isSupabaseConfigured,
  requiresSupabaseOnVercel,
} from "@/lib/auth/config";
import {
  normalizePhoneDigits,
  resolveLoginEmail,
} from "@/lib/auth/phone";
import { setSessionCookie, jsonError, jsonOk } from "@/lib/auth/http";
import {
  createBrowserLikeServerClient,
  createServerClient,
} from "@/lib/supabase/server";
import type { Profile } from "@/types";

const bodySchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

async function resolveAuthEmailFromPhone(
  phoneInput: string
): Promise<string | null> {
  const digits = normalizePhoneDigits(phoneInput);
  if (!digits) return null;

  const mapped = resolveLoginEmail(phoneInput);
  const admin = await createServerClient();
  if (!admin) return mapped;

  // Prefer profile phone match so older accounts still sign in with mobile.
  const { data: rows } = await admin
    .from("profiles")
    .select("id, email, phone")
    .not("phone", "is", null)
    .limit(500);

  const match = (rows ?? []).find((row) => {
    const other = normalizePhoneDigits(row.phone ?? "");
    return other != null && other === digits;
  });

  if (match?.email) return match.email.toLowerCase();
  return mapped;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid mobile number or password.");
  }

  if (requiresSupabaseOnVercel()) {
    return jsonError(
      "Login is not available: configure Supabase env vars on Vercel (NEXT_PUBLIC_SUPABASE_URL, ANON KEY, SERVICE ROLE KEY).",
      503
    );
  }

  const identifier = parsed.data.email.trim();
  const { password } = parsed.data;

  let email: string | null;
  if (identifier.includes("@")) {
    email = resolveLoginEmail(identifier);
  } else {
    email = await resolveAuthEmailFromPhone(identifier);
  }

  if (!email) {
    return jsonError("Invalid mobile number or password.", 401);
  }

  if (isSupabaseConfigured()) {
    const supabase = await createBrowserLikeServerClient();
    if (!supabase) return jsonError("Auth is not configured.", 500);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const msg = (error?.message || "").toLowerCase();
      if (
        msg.includes("banned") ||
        msg.includes("disabled") ||
        msg.includes("user is banned")
      ) {
        return jsonError(
          "This account has been deactivated. Contact an admin.",
          403
        );
      }
      return jsonError("Invalid mobile number or password.", 401);
    }

    // Prefer service-role profile read so RLS never blocks the active check
    let profileRow = (
      await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle()
    ).data;

    if (!profileRow) {
      const admin = await createServerClient();
      if (admin) {
        const res = await admin
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();
        profileRow = res.data;
      }
    }

    if (profileRow && profileRow.is_active === false) {
      await supabase.auth.signOut();
      return jsonError(
        "This account has been deactivated. Contact an admin.",
        403
      );
    }

    // Drivers table flag (admin toggle) also blocks sign-in
    if (profileRow?.role === "DRIVER") {
      const admin = await createServerClient();
      if (admin) {
        const { data: driverRow } = await admin
          .from("drivers")
          .select("is_active")
          .eq("profile_id", data.user.id)
          .maybeSingle();
        if (driverRow && driverRow.is_active === false) {
          await supabase.auth.signOut();
          return jsonError(
            "This driver account has been deactivated. Contact an admin.",
            403
          );
        }
      }
    }

    const metaRole = (data.user.app_metadata?.role ||
      data.user.user_metadata?.role) as Profile["role"] | undefined;

    const profile = (profileRow as Profile | null) ?? {
      id: data.user.id,
      email: data.user.email ?? email,
      full_name:
        (data.user.user_metadata?.full_name as string) ||
        email.split("@")[0],
      phone: (data.user.user_metadata?.phone as string) || null,
      avatar_url: null,
      role: metaRole || "CUSTOMER",
      is_active: true,
      points_balance: 0,
      lifetime_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Keep app_metadata.role in sync for middleware fallbacks
    const canonicalRole = (profileRow as Profile | null)?.role ?? profile.role;
    if (data.user.app_metadata?.role !== canonicalRole) {
      const admin = await createServerClient();
      if (admin) {
        await admin.auth.admin.updateUserById(data.user.id, {
          app_metadata: { role: canonicalRole },
        });
      }
    }

    return jsonOk({ profile });
  }

  const result = await authenticateAccount(email, password);
  if ("error" in result) {
    return jsonError(
      result.error.replace(/phone number\/email/gi, "mobile number"),
      401
    );
  }

  const response = jsonOk({ profile: result.profile });
  await setSessionCookie(response, {
    id: result.profile.id,
    email: result.profile.email,
    role: result.profile.role,
  });
  return response;
}

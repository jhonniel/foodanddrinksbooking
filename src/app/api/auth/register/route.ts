import { z } from "zod";
import { registerAccount } from "@/lib/auth/accounts";
import {
  isSupabaseConfigured,
  requiresSupabaseOnVercel,
} from "@/lib/auth/config";
import {
  formatPhoneE164,
  normalizePhoneDigits,
  phoneToAuthEmail,
} from "@/lib/auth/phone";
import { setSessionCookie, jsonError, jsonOk } from "@/lib/auth/http";
import {
  createBrowserLikeServerClient,
  createServerClient,
} from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

const bodySchema = z.object({
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().min(10),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (requiresSupabaseOnVercel()) {
    return jsonError(
      "Sign up is not available: configure Supabase env vars on Vercel (NEXT_PUBLIC_SUPABASE_URL, ANON KEY, SERVICE ROLE KEY).",
      503
    );
  }

  const { password, fullName, phone: phoneRaw } = parsed.data;
  const digits = normalizePhoneDigits(phoneRaw);
  const email = digits ? phoneToAuthEmail(digits) : null;
  if (!digits || !email) {
    return jsonError("Enter a valid mobile number.");
  }
  const phone = formatPhoneE164(digits);

  if (isSupabaseConfigured()) {
    const adminClient = await createServerClient();
    if (!adminClient) return jsonError("Auth is not configured.", 500);

    // Soft uniqueness: same digits in phone column (any formatting)
    const { data: existingPhones } = await adminClient
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null)
      .limit(500);

    const phoneTaken = (existingPhones ?? []).some((row) => {
      const other = normalizePhoneDigits(row.phone ?? "");
      return other != null && other === digits;
    });
    if (phoneTaken) {
      return jsonError(
        "An account with this mobile number already exists. Please sign in.",
        409
      );
    }

    // Create + auto-confirm (synthetic email; customers never see it)
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
        },
        app_metadata: { role: "CUSTOMER" },
      });

    if (createError || !created.user) {
      const msg = createError?.message ?? "Registration failed.";
      if (/already|registered|exists/i.test(msg)) {
        return jsonError(
          "An account with this mobile number already exists. Please sign in.",
          409
        );
      }
      if (/database error/i.test(msg)) {
        return jsonError(
          "Registration failed: run supabase/migrations/006_fix_signup_and_images.sql in the SQL Editor, then try again.",
          500
        );
      }
      return jsonError(msg);
    }

    const userId = created.user.id;

    await adminClient.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        phone,
        role: "CUSTOMER",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    let role: UserRole = "CUSTOMER";
    let bootstrappedAdmin = false;

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
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("*")
        .maybeSingle();

      if (promoted) {
        role = "SUPER_ADMIN";
        bootstrappedAdmin = true;
        await adminClient.auth.admin.updateUserById(userId, {
          app_metadata: { role: "SUPER_ADMIN" },
        });
      }
    } else {
      const { data: profileRow } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (profileRow?.role) role = profileRow.role as UserRole;
    }

    const sessionClient = await createBrowserLikeServerClient();
    if (sessionClient) {
      const { error: signInError } = await sessionClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        console.error("[register] sign-in after create failed", signInError.message);
      }
    }

    const profile: Profile = {
      id: userId,
      email,
      full_name: fullName,
      phone,
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

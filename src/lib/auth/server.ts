import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  isSupabaseConfigured,
  toPublicProfile,
  canAccessAdmin,
  canAccessDriver,
} from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import { findAccountById } from "@/lib/auth/accounts";
import {
  createBrowserLikeServerClient,
  createServerClient,
} from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

export async function getSessionProfileFromCookies(): Promise<Profile | null> {
  // Prefer Supabase session whenever configured (Vercel / production).
  if (isSupabaseConfigured()) {
    return getSupabaseProfile();
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const account = await findAccountById(payload.sub);
  if (!account || !account.is_active) return null;
  return toPublicProfile(account);
}

export async function getSessionProfileFromRequest(
  request: NextRequest
): Promise<Profile | null> {
  if (isSupabaseConfigured()) {
    return getSupabaseProfile();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const account = await findAccountById(payload.sub);
  if (!account || !account.is_active) return null;
  return toPublicProfile(account);
}

async function getSupabaseProfile(): Promise<Profile | null> {
  const supabase = await createBrowserLikeServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Prefer user-scoped read; fall back to service role if RLS blocks.
  let { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    const admin = await createServerClient();
    if (admin) {
      const res = await admin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      data = res.data;
    }
  }

  if (data) {
    if ((data as Profile).is_active === false) return null;
    return data as Profile;
  }

  // Fallback when profiles table is missing or row not yet created
  const role = (user.app_metadata?.role ||
    user.user_metadata?.role ||
    "CUSTOMER") as UserRole;

  return {
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata?.full_name as string) ||
      (user.email ?? "user").split("@")[0],
    phone: (user.user_metadata?.phone as string) || null,
    avatar_url: null,
    role,
    is_active: true,
    points_balance: 0,
    lifetime_points: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function assertRole(
  profile: Profile | null,
  allow: "authenticated" | "staff" | "driver" | UserRole[]
): profile is Profile {
  if (!profile) return false;
  if (allow === "authenticated") return true;
  if (allow === "staff") return canAccessAdmin(profile.role);
  if (allow === "driver") return canAccessDriver(profile.role);
  return allow.includes(profile.role);
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAppUrl, homePathForRole, isSupabaseConfigured } from "@/lib/auth/config";
import type { UserRole } from "@/types";

/**
 * Supabase OAuth callback (PKCE). Used when Google is enabled in Supabase.
 */
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/home";

  if (!isSupabaseConfigured() || !code) {
    return NextResponse.redirect(new URL("/login?error=Auth%20failed", appUrl));
  }

  let response = NextResponse.redirect(new URL(next, appUrl));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.redirect(new URL(next, appUrl));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || "Auth failed")}`, appUrl)
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole | undefined) ?? "CUSTOMER";
  const destination =
    next === "/home" || next === "/login" || next === "/register"
      ? homePathForRole(role)
      : next;

  return NextResponse.redirect(new URL(destination, appUrl));
}

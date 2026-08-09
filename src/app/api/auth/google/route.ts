import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  getAppUrl,
  isGoogleAuthConfigured,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { buildGoogleAuthorizeUrl } from "@/lib/auth/google";
import { createBrowserLikeServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/home";

  if (!isGoogleAuthConfigured()) {
    const url = new URL("/login", getAppUrl());
    url.searchParams.set(
      "error",
      "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local."
    );
    return NextResponse.redirect(url);
  }

  const hasDirectGoogle = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );

  // Prefer native Google OAuth when client credentials are set.
  if (!hasDirectGoogle && isSupabaseConfigured()) {
    const supabase = await createBrowserLikeServerClient();
    if (!supabase) {
      const url = new URL("/login", getAppUrl());
      url.searchParams.set("error", "Auth is not configured.");
      return NextResponse.redirect(url);
    }

    const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error || !data.url) {
      const url = new URL("/login", getAppUrl());
      url.searchParams.set("error", error?.message ?? "Google sign-in failed.");
      return NextResponse.redirect(url);
    }

    return NextResponse.redirect(data.url);
  }

  const state = randomBytes(24).toString("hex");
  const statePayload = Buffer.from(
    JSON.stringify({ state, next })
  ).toString("base64url");

  const response = NextResponse.redirect(buildGoogleAuthorizeUrl(statePayload));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, statePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

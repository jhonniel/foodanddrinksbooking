import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  getAppUrl,
  homePathForRole,
} from "@/lib/auth/config";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
} from "@/lib/auth/google";
import { findOrCreateGoogleAccount } from "@/lib/auth/accounts";
import { setSessionCookie } from "@/lib/auth/http";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  const fail = (message: string) => {
    const url = new URL("/login", appUrl);
    url.searchParams.set("error", message);
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (oauthError) {
    return fail("Google sign-in was cancelled.");
  }

  if (!code || !stateParam || !cookieState || stateParam !== cookieState) {
    return fail("Invalid Google sign-in state. Please try again.");
  }

  let nextPath = "/home";
  try {
    const parsed = JSON.parse(
      Buffer.from(cookieState, "base64url").toString("utf8")
    ) as { next?: string };
    if (parsed.next && parsed.next.startsWith("/")) {
      nextPath = parsed.next;
    }
  } catch {
    /* use default */
  }

  try {
    const { access_token } = await exchangeGoogleCode(code);
    const googleUser = await fetchGoogleProfile(access_token);

    if (!googleUser.email_verified) {
      return fail("Your Google email is not verified.");
    }

    const { profile, created } = await findOrCreateGoogleAccount({
      googleId: googleUser.sub,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
    });

    const destination =
      nextPath === "/home" || nextPath === "/login" || nextPath === "/register"
        ? homePathForRole(profile.role)
        : nextPath;

    const response = NextResponse.redirect(new URL(destination, appUrl));
    await setSessionCookie(response, {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    });
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });

    if (created && profile.role === "SUPER_ADMIN") {
      response.cookies.set("ic_flash", "bootstrap-admin", {
        path: "/",
        maxAge: 60,
      });
    }

    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google sign-in failed.";
    return fail(message);
  }
}

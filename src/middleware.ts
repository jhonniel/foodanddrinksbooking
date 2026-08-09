import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  canAccessAdmin,
  canAccessDriver,
  homePathForRole,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import { isMaintenanceMode } from "@/lib/settings/store";
import { createServerClient } from "@supabase/ssr";
import type { UserRole } from "@/types";

async function getRoleFromRequest(
  request: NextRequest
): Promise<UserRole | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.role) return payload.role as UserRole;
  }

  if (!isSupabaseConfigured()) return null;

  let response = NextResponse.next({ request });
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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metaRole = (user.app_metadata?.role ||
    user.user_metadata?.role) as UserRole | undefined;
  return metaRole ?? "CUSTOMER";
}

function isMaintenanceBypassPath(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/sounds/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.png" ||
    pathname === "/icon-192.png"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = await getRoleFromRequest(request);
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  const maintenanceOn = await isMaintenanceMode();
  if (maintenanceOn && !isMaintenanceBypassPath(pathname)) {
    const staffOk =
      !!role && canAccessAdmin(role) && pathname.startsWith("/admin");
    const driverOk =
      !!role && canAccessDriver(role) && pathname.startsWith("/driver");
    const staffApiOk =
      !!role &&
      canAccessAdmin(role) &&
      pathname.startsWith("/api/") &&
      !pathname.startsWith("/api/auth");

    if (!staffOk && !driverOk && !staffApiOk) {
      if (role && canAccessAdmin(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
      if (role && canAccessDriver(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/driver";
        url.search = "";
        return NextResponse.redirect(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (!role) {
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/driver") ||
      pathname.startsWith("/checkout") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/rewards")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isAuthPage) {
    const url = request.nextUrl.clone();
    if (maintenanceOn && !canAccessAdmin(role) && !canAccessDriver(role)) {
      url.pathname = "/maintenance";
    } else {
      url.pathname = homePathForRole(role);
    }
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(role)) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(role);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/driver") && !canAccessDriver(role)) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(role);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|ico)$).*)",
  ],
};

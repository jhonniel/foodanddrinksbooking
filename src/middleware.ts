import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  MAINTENANCE_COOKIE,
  canAccessAdmin,
  canAccessDriver,
  homePathForRole,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import {
  readMaintenanceModeFromSupabase,
  readProfileRoleFromRequest,
} from "@/lib/settings/edge";
import type { UserRole } from "@/types";

async function getRoleFromRequest(
  request: NextRequest
): Promise<UserRole | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isSupabaseConfigured()) {
    const role = await readProfileRoleFromRequest(request);
    if (role) return role as UserRole;
    return null;
  }

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.role) return payload.role as UserRole;
  }

  return null;
}

function isMaintenanceBypassPath(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/sounds/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.png" ||
    pathname === "/icon-192.png"
  );
}

/**
 * Never self-fetch from middleware (can deadlock Next.js).
 * Supabase: read app_settings. Local: read cookie set by /api/settings.
 */
async function resolveMaintenanceMode(request: NextRequest): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      return await readMaintenanceModeFromSupabase();
    } catch {
      return false;
    }
  }
  return request.cookies.get(MAINTENANCE_COOKIE)?.value === "1";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = await getRoleFromRequest(request);
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  const maintenanceOn = await resolveMaintenanceMode(request);
  if (pathname === "/maintenance" && !maintenanceOn) {
    const url = request.nextUrl.clone();
    if (role && canAccessAdmin(role)) {
      url.pathname = "/admin";
    } else if (role && canAccessDriver(role)) {
      url.pathname = "/driver";
    } else if (role) {
      url.pathname = "/home";
    } else {
      url.pathname = "/";
    }
    url.search = "";
    return NextResponse.redirect(url);
  }

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

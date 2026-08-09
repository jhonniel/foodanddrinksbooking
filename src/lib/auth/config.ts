import type { Profile, UserRole } from "@/types";

export const SESSION_COOKIE = "ic_session";
export const GOOGLE_OAUTH_STATE_COOKIE = "ic_google_oauth";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (url.includes("your-project")) return false;
  if (key.includes("your-anon") || key.includes("your-")) return false;
  return true;
}

export function isGoogleAuthConfigured(): boolean {
  const hasDirectGoogle = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
  if (hasDirectGoogle) return true;
  // Supabase Google: enable in dashboard, then set this flag
  return (
    isSupabaseConfigured() &&
    process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true"
  );
}

/** Demo mode is disabled for production-ready accounts. */
export function isDemoMode(): boolean {
  return false;
}

export function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "island-coolers-dev-session-secret-change-me"
  );
}

export function homePathForRole(role: UserRole): string {
  if (["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"].includes(role)) {
    return "/admin";
  }
  if (role === "DRIVER") return "/driver";
  return "/home";
}

export function toPublicProfile(account: {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  points_balance: number;
  lifetime_points: number;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: account.id,
    email: account.email,
    full_name: account.full_name,
    phone: account.phone,
    avatar_url: account.avatar_url,
    role: account.role,
    is_active: account.is_active,
    points_balance: account.points_balance,
    lifetime_points: account.lifetime_points,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export const STAFF_ROLES: UserRole[] = [
  "STAFF",
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
];

export function isStaffRole(role: UserRole | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function canAccessAdmin(role: UserRole | undefined): boolean {
  return isStaffRole(role);
}

export function canAccessDriver(role: UserRole | undefined): boolean {
  return role === "DRIVER" || role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Manual / auto driver assignment on Orders & Delivery. */
export function canAssignDrivers(role: UserRole | undefined): boolean {
  return (
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER"
  );
}

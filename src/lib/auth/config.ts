import type { Profile, UserRole } from "@/types";

export const SESSION_COOKIE = "ic_session";
export const MAINTENANCE_COOKIE = "ic_maintenance";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/** Anon / publishable key (new Supabase dashboard naming). */
export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

export function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    ""
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return false;
  const urlLower = url.toLowerCase();
  const keyLower = key.toLowerCase();
  if (urlLower.includes("your_project") || urlLower.includes("your-project")) {
    return false;
  }
  if (
    keyLower.includes("your-anon") ||
    keyLower.includes("your-service") ||
    keyLower === "your-anon-key" ||
    keyLower.includes("your_project")
  ) {
    return false;
  }
  return true;
}

/** Demo mode is disabled for production-ready accounts. */
export function isDemoMode(): boolean {
  return false;
}

/** Local file auth (.data) is not durable on Vercel serverless. */
export function requiresSupabaseOnVercel(): boolean {
  return Boolean(process.env.VERCEL) && !isSupabaseConfigured();
}

export function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    getSupabaseServiceRoleKey() ||
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

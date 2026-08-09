import type { Profile, UserRole } from "@/types";
import { homePathForRole } from "@/lib/auth/config";

export interface AuthResult {
  success: boolean;
  profile?: Profile;
  error?: string;
  bootstrappedAdmin?: boolean;
}

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    return { success: false, error: data?.error ?? "Login failed." };
  }
  return { success: true, profile: data.profile as Profile };
}

export async function registerAccount(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<AuthResult> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    return { success: false, error: data?.error ?? "Registration failed." };
  }
  return {
    success: true,
    profile: data.profile as Profile,
    bootstrappedAdmin: Boolean(data.bootstrappedAdmin),
  };
}

export async function logoutAccount(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchCurrentProfile(): Promise<Profile | null> {
  const res = await fetch("/api/auth/me", { method: "GET", cache: "no-store" });
  if (!res.ok) return null;
  const data = await parseJson(res);
  return (data?.profile as Profile) ?? null;
}

export async function updateAccountRole(
  accountId: string,
  role: UserRole
): Promise<AuthResult> {
  const res = await fetch("/api/auth/update-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, role }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    return { success: false, error: data?.error ?? "Failed to update role." };
  }
  return { success: true, profile: data.profile as Profile };
}

export async function createStaffAccount(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
}): Promise<AuthResult> {
  const res = await fetch("/api/auth/create-staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    return { success: false, error: data?.error ?? "Failed to create account." };
  }
  return { success: true, profile: data.profile as Profile };
}

export { homePathForRole };

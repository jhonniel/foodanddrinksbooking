import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createSessionToken } from "@/lib/auth/session";
import type { Profile, UserRole } from "@/types";

export async function setSessionCookie(
  response: NextResponse,
  user: { id: string; email: string; role: UserRole }
) {
  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export { isSupabaseConfigured };

export type AuthSuccess = { profile: Profile };

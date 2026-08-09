import { getAppUrl } from "./config";

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string | null;
}

export function getGoogleRedirectUri(): string {
  return `${getAppUrl()}/api/auth/google/callback`;
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string
): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }
  return { access_token: data.access_token as string };
}

export async function fetchGoogleProfile(
  accessToken: string
): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok || !data.email) {
    throw new Error("Could not load Google profile");
  }
  return {
    sub: String(data.sub),
    email: String(data.email).toLowerCase(),
    email_verified: Boolean(data.email_verified),
    name: String(data.name || data.email.split("@")[0]),
    picture: data.picture ? String(data.picture) : null,
  };
}

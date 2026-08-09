import { getSessionProfileFromCookies } from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";

export async function GET() {
  const profile = await getSessionProfileFromCookies();
  if (!profile) {
    return jsonError("Not authenticated.", 401);
  }
  return jsonOk({ profile });
}

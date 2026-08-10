import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  canAccessDriver,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import {
  ensureDriverForProfile,
  updateDriverStatusInSupabase,
} from "@/lib/supabase/drivers";

/** Load (and create if needed) the drivers row for the signed-in driver. */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required.", driver: null },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated") || !canAccessDriver(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ensured = await ensureDriverForProfile(profile);
  if (!ensured.driver) {
    return NextResponse.json(
      { error: ensured.error || "Could not load driver profile.", driver: null },
      { status: 400 }
    );
  }

  return NextResponse.json({ driver: ensured.driver });
}

const patchSchema = z.object({
  online: z.boolean(),
  latitude: z.number().finite().optional().nullable(),
  longitude: z.number().finite().optional().nullable(),
});

/** Toggle online / offline in Supabase. */
export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required." },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated") || !canAccessDriver(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed." }, { status: 422 });
  }

  const ensured = await ensureDriverForProfile(profile);
  if (!ensured.driver) {
    return NextResponse.json(
      { error: ensured.error || "No driver profile linked to this account." },
      { status: 400 }
    );
  }

  const { online, latitude, longitude } = parsed.data;
  const location =
    latitude != null && longitude != null
      ? { lat: latitude, lng: longitude }
      : null;

  const status = online
    ? ensured.driver.status === "BUSY"
      ? "BUSY"
      : "ONLINE"
    : "OFFLINE";

  const result = await updateDriverStatusInSupabase(
    profile,
    status,
    location
  );

  if (!result.driver) {
    return NextResponse.json(
      { error: result.error || "Could not update driver status." },
      { status: 400 }
    );
  }

  return NextResponse.json({ driver: result.driver });
}

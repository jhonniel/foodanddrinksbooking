import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { canAssignDrivers, isSupabaseConfigured } from "@/lib/auth/config";
import { setDriverActiveInSupabase } from "@/lib/supabase/drivers";

const bodySchema = z.object({
  active: z.boolean(),
});

/** Activate or deactivate a driver account (drivers + profile + auth ban). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is required." }, { status: 503 });
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated") || !canAssignDrivers(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Driver id required." }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 422 });
  }

  const result = await setDriverActiveInSupabase(id, parsed.data.active);
  if (!result.driver) {
    return NextResponse.json(
      { error: result.error || "Could not update driver." },
      { status: 400 }
    );
  }

  return NextResponse.json({ driver: result.driver });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { canAssignDrivers, isSupabaseConfigured } from "@/lib/auth/config";
import {
  deleteDriverInSupabase,
  setDriverActiveInSupabase,
  updateDriverInSupabase,
} from "@/lib/supabase/drivers";

const activeSchema = z.object({
  active: z.boolean(),
});

const editSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  vehicleType: z.string().min(1).optional(),
  vehicleNumber: z.string().nullable().optional(),
  licenseNumber: z.string().nullable().optional(),
});

/** Activate/deactivate or edit driver details. */
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

  const activeParsed = activeSchema.safeParse(json);
  if (activeParsed.success) {
    const result = await setDriverActiveInSupabase(id, activeParsed.data.active);
    if (!result.driver) {
      return NextResponse.json(
        { error: result.error || "Could not update driver." },
        { status: 400 }
      );
    }
    return NextResponse.json({ driver: result.driver });
  }

  const editParsed = editSchema.safeParse(json);
  if (!editParsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 422 });
  }

  const payload = editParsed.data;
  if (
    payload.fullName === undefined &&
    payload.phone === undefined &&
    payload.vehicleType === undefined &&
    payload.vehicleNumber === undefined &&
    payload.licenseNumber === undefined
  ) {
    return NextResponse.json({ error: "No fields to update." }, { status: 422 });
  }

  const result = await updateDriverInSupabase(id, {
    fullName: payload.fullName,
    phone: payload.phone,
    vehicleType: payload.vehicleType,
    vehicleNumber: payload.vehicleNumber,
    licenseNumber: payload.licenseNumber,
  });

  if (!result.driver) {
    return NextResponse.json(
      { error: result.error || "Could not update driver." },
      { status: 400 }
    );
  }

  return NextResponse.json({ driver: result.driver });
}

/** Permanently remove a driver account. */
export async function DELETE(
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

  const result = await deleteDriverInSupabase(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Could not delete driver." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

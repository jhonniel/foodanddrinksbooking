import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  canAccessAdmin,
  canAccessDriver,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { updateDeliveryStatusInSupabase } from "@/lib/supabase/orders";

const patchSchema = z.object({
  status: z.enum([
    "PENDING",
    "ASSIGNED",
    "ACCEPTED",
    "PICKED_UP",
    "IN_TRANSIT",
    "ARRIVED",
    "DELIVERED",
    "CANCELLED",
  ]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required." },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = canAccessAdmin(profile.role);
  const isDriver = canAccessDriver(profile.role);
  if (!isStaff && !isDriver) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Only store staff confirm handover / pickup — drivers cannot.
  if (parsed.data.status === "PICKED_UP" && !isStaff) {
    return NextResponse.json(
      { error: "Only store staff can mark a delivery as picked up." },
      { status: 403 }
    );
  }

  const result = await updateDeliveryStatusInSupabase({
    deliveryId: id,
    status: parsed.data.status,
    actorProfileId: profile.id,
    actorIsStaff: isStaff,
  });

  if (result.error || !result.delivery) {
    return NextResponse.json(
      { error: result.error || "Failed to update delivery." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    delivery: result.delivery,
    order: result.order,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  canAccessAdmin,
  canAssignDrivers,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import {
  assignDriverInSupabase,
  fetchOrderByIdFromSupabase,
  updateOrderStatusInSupabase,
} from "@/lib/supabase/orders";

const patchSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "ARRIVED",
      "DELIVERED",
      "CANCELLED",
    ])
    .optional(),
  driverId: z.string().min(1).optional(),
  driverName: z.string().optional(),
  driverProfileId: z.string().optional(),
});

function supabaseRequired() {
  return NextResponse.json(
    {
      error:
        "Supabase is required for orders. Set NEXT_PUBLIC_SUPABASE_URL and keys.",
    },
    { status: 503 }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) return supabaseRequired();

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const loaded = await fetchOrderByIdFromSupabase(id);
  if (!loaded) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (
    !canAccessAdmin(profile.role) &&
    loaded.order.customer_id !== profile.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(loaded);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) return supabaseRequired();

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
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
      {
        error: "Validation failed.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { status, driverId, driverProfileId } = parsed.data;

  if (driverId) {
    if (!canAssignDrivers(profile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to assign drivers." },
        { status: 403 }
      );
    }
    const result = await assignDriverInSupabase({
      orderId: id,
      driverId,
      driverProfileId,
    });
    if (result.error || !result.order) {
      return NextResponse.json(
        { error: result.error || "Failed to assign driver." },
        { status: 400 }
      );
    }
    return NextResponse.json({
      order: result.order,
      delivery: result.delivery,
    });
  }

  if (status) {
    const result = await updateOrderStatusInSupabase(id, status);
    if (result.error || !result.order) {
      return NextResponse.json(
        { error: result.error || "Failed to update order." },
        { status: 400 }
      );
    }
    return NextResponse.json({ order: result.order });
  }

  return NextResponse.json(
    { error: "Provide status or driverId to update." },
    { status: 400 }
  );
}

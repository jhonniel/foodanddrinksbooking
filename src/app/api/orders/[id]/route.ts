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
  customerCanCancelOrder,
  staffCanCancelOrder,
} from "@/lib/constants";
import {
  assignDriverInSupabase,
  deleteOrderInSupabase,
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
  cancelledReason: z.string().max(500).optional().nullable(),
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

  const isStaff = canAccessAdmin(profile.role);
  const isCustomer = loaded.order.customer_id === profile.id;
  const isAssignedDriver = loaded.order.driver_id === profile.id;
  // delivery_orders.driver_id is drivers.id — allow if it matches this profile's driver row
  let isDeliveryDriver = false;
  if (
    !isStaff &&
    !isCustomer &&
    !isAssignedDriver &&
    loaded.delivery?.driver_id
  ) {
    const { createServerClient } = await import("@/lib/supabase/server");
    const admin = await createServerClient();
    if (admin) {
      const { data: driverRow } = await admin
        .from("drivers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("id", loaded.delivery.driver_id)
        .maybeSingle();
      isDeliveryDriver = Boolean(driverRow?.id);
    }
  }

  if (!isStaff && !isCustomer && !isAssignedDriver && !isDeliveryDriver) {
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
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const isStaff = canAccessAdmin(profile.role);

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

  const { status, cancelledReason, driverId, driverProfileId } = parsed.data;

  // Driver assignment: staff only
  if (driverId) {
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

  if (!status) {
    return NextResponse.json(
      { error: "Provide status or driverId to update." },
      { status: 400 }
    );
  }

  const loaded = await fetchOrderByIdFromSupabase(id);
  if (!loaded) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const order = loaded.order;

  // Customer cancel: only own PENDING orders (before processing).
  if (!isStaff) {
    if (order.customer_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Customers can only cancel orders." },
        { status: 403 }
      );
    }
    if (!customerCanCancelOrder(order.status)) {
      return NextResponse.json(
        {
          error:
            "This order is already Confirmed. Only the store/admin can cancel it.",
        },
        { status: 403 }
      );
    }

    const result = await updateOrderStatusInSupabase(id, "CANCELLED", {
      cancelledReason: cancelledReason || "Cancelled by customer",
    });
    if (result.error || !result.order) {
      return NextResponse.json(
        { error: result.error || "Failed to cancel order." },
        { status: 400 }
      );
    }
    return NextResponse.json({ order: result.order });
  }

  // Staff updates
  if (status === "CANCELLED") {
    if (!staffCanCancelOrder(order.status)) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled." },
        { status: 400 }
      );
    }
    const result = await updateOrderStatusInSupabase(id, "CANCELLED", {
      cancelledReason: cancelledReason || "Cancelled by store",
    });
    if (result.error || !result.order) {
      return NextResponse.json(
        { error: result.error || "Failed to cancel order." },
        { status: 400 }
      );
    }
    return NextResponse.json({ order: result.order });
  }

  const result = await updateOrderStatusInSupabase(id, status);
  if (result.error || !result.order) {
    return NextResponse.json(
      { error: result.error || "Failed to update order." },
      { status: 400 }
    );
  }
  return NextResponse.json({ order: result.order });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) return supabaseRequired();

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdmin(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await deleteOrderInSupabase(id);
  if (result.error) {
    const status =
      result.error === "Order not found."
        ? 404
        : result.error.includes("Only delivered or cancelled")
          ? 400
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { canAccessAdmin, canAssignDrivers } from "@/lib/auth/config";
import {
  findOrderById,
  updateOrderStatusInStore,
  updateOrderFields,
  upsertDelivery,
  getOrdersSnapshot,
} from "@/lib/orders/localFileStore";
import { STORE_LOCATION } from "@/data/demo";
import { calculateDeliveryFee } from "@/lib/delivery/pricing";
import type { DeliveryOrder, OrderStatus } from "@/types";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await findOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canAccessAdmin(profile.role) && order.customer_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { deliveries } = await getOrdersSnapshot();
  const delivery = deliveries.find((d) => d.order_id === id) ?? null;
  return NextResponse.json({ order, delivery });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const order = await findOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

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

  const { status, driverId, driverName, driverProfileId } = parsed.data;

  if (driverId) {
    if (!canAssignDrivers(profile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to assign drivers." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const lat = order.delivery_address_snapshot?.latitude;
    const lng = order.delivery_address_snapshot?.longitude;
    const quote =
      lat != null && lng != null
        ? calculateDeliveryFee({ lat, lng }, order.subtotal ?? 0)
        : null;

    const delivery: DeliveryOrder = {
      id: `del-${Date.now()}`,
      order_id: id,
      driver_id: driverId,
      status: "ASSIGNED",
      customer_latitude: lat ?? null,
      customer_longitude: lng ?? null,
      store_latitude: STORE_LOCATION.lat,
      store_longitude: STORE_LOCATION.lng,
      estimated_arrival: new Date(
        Date.now() + (quote?.estimatedMinutes ?? 30) * 60000
      ).toISOString(),
      distance_km: quote?.distanceKm ?? null,
      delivery_fee: order.delivery_fee ?? quote?.fee ?? 0,
      delivery_pin: String(Math.floor(1000 + Math.random() * 9000)),
      proof_photo_url: null,
      assigned_at: now,
      accepted_at: null,
      picked_up_at: null,
      arrived_at: null,
      delivered_at: null,
      created_at: now,
      updated_at: now,
    };

    await upsertDelivery(delivery);
    const updated = await updateOrderFields(id, {
      driver_id: driverId,
      status: "ASSIGNED" as OrderStatus,
      updated_at: now,
      driver: driverProfileId
        ? {
            id: driverProfileId,
            email: "",
            full_name: driverName || "Driver",
            phone: null,
            avatar_url: null,
            role: "DRIVER",
            is_active: true,
            points_balance: 0,
            lifetime_points: 0,
            created_at: now,
            updated_at: now,
          }
        : undefined,
    });

    return NextResponse.json({ order: updated, delivery });
  }

  if (status) {
    const updated = await updateOrderStatusInStore(id, status);
    return NextResponse.json({ order: updated });
  }

  return NextResponse.json(
    { error: "Provide status or driverId to update." },
    { status: 400 }
  );
}

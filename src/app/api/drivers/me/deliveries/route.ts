import { NextRequest, NextResponse } from "next/server";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  canAccessDriver,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { ensureDriverForProfile } from "@/lib/supabase/drivers";
import { fetchOrdersFromSupabase } from "@/lib/supabase/orders";

/**
 * Deliveries assigned to the signed-in driver (by drivers.id / profile).
 * Prefer this over GET /api/orders for the driver app.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required.", orders: [], deliveries: [] },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated") || !canAccessDriver(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pure drivers: resolve their drivers row and load assignments.
  // Admins previewing /driver still get assignments for their own driver row if any.
  const ensured = await ensureDriverForProfile(profile);
  if (!ensured.driver) {
    // Still try profile-id match (orders.driver_id) without a drivers row
    const snapshot = await fetchOrdersFromSupabase({
      driverProfileId: profile.id,
    });
    return NextResponse.json({
      orders: snapshot?.orders ?? [],
      deliveries: snapshot?.deliveries ?? [],
      driver: null,
      error: ensured.error,
    });
  }

  const snapshot = await fetchOrdersFromSupabase({
    driverProfileId: profile.id,
  });

  if (!snapshot) {
    return NextResponse.json(
      {
        error: "Could not load deliveries from Supabase.",
        orders: [],
        deliveries: [],
        driver: ensured.driver,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    orders: snapshot.orders,
    deliveries: snapshot.deliveries,
    driver: ensured.driver,
  });
}

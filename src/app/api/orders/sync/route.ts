import { NextRequest, NextResponse } from "next/server";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { saveOrder } from "@/lib/orders/localFileStore";
import type { Order } from "@/types";

/**
 * Persist an already-built order (used by checkout local fallback)
 * so admin boards can see it.
 */
export async function POST(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const order = (body as { order?: Order })?.order;
  if (!order?.id || !order.order_number || !order.customer_id) {
    return NextResponse.json({ error: "Invalid order payload." }, { status: 422 });
  }

  if (order.customer_id !== profile.id && !["SUPER_ADMIN", "ADMIN"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const saved = await saveOrder(order);
    return NextResponse.json({ order: saved }, { status: 201 });
  } catch (err) {
    console.error("orders/sync failed:", err);
    return NextResponse.json(
      { error: "Could not persist order." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileFromRequest } from "@/lib/auth/server";
import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildPointsLedgerFromOrders,
  fetchPointsTransactionsForCustomer,
  syncDeliveredOrderPointsForCustomer,
} from "@/lib/supabase/loyalty";

/** Authenticated customer: points balance + history from completed orders. */
export async function GET(request: NextRequest) {
  const session = await getSessionProfileFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !getSupabaseServiceRoleKey()) {
    return NextResponse.json({
      pointsBalance: session.points_balance,
      lifetimePoints: session.lifetime_points,
      pointsLedger: [],
      summary: {
        earnedFromOrders: 0,
        redeemedTotal: 0,
        deliveredOrders: 0,
      },
    });
  }

  const client = await createServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase client unavailable." },
      { status: 500 }
    );
  }

  const customerId = session.id;

  await syncDeliveredOrderPointsForCustomer(customerId);

  const { data: profileRow } = await client
    .from("profiles")
    .select("points_balance, lifetime_points")
    .eq("id", customerId)
    .maybeSingle();

  const pointsBalance = Number(
    profileRow?.points_balance ?? session.points_balance ?? 0
  );
  const lifetimePoints = Number(
    profileRow?.lifetime_points ?? session.lifetime_points ?? 0
  );

  const { data: orderRows } = await client
    .from("orders")
    .select(
      "id, order_number, status, subtotal, discount, points_discount, points_earned, points_used, created_at, delivered_at, updated_at"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const orders = (orderRows ?? []).map((row) => ({
    id: String(row.id),
    order_number: String(row.order_number ?? ""),
    status: String(row.status ?? ""),
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    points_discount: Number(row.points_discount ?? 0),
    points_earned: Number(row.points_earned ?? 0),
    points_used: Number(row.points_used ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    delivered_at: (row.delivered_at as string | null) ?? null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }));

  const storedTx = await fetchPointsTransactionsForCustomer(customerId);
  const pointsLedger = buildPointsLedgerFromOrders(
    customerId,
    orders,
    storedTx
  );

  const earnedFromOrders = pointsLedger
    .filter((t) => t.points > 0)
    .reduce((s, t) => s + t.points, 0);
  const redeemedTotal = Math.abs(
    pointsLedger
      .filter((t) => t.points < 0)
      .reduce((s, t) => s + t.points, 0)
  );
  const deliveredOrders = orders.filter((o) => o.status === "DELIVERED").length;

  return NextResponse.json({
    pointsBalance,
    lifetimePoints,
    pointsLedger,
    summary: {
      earnedFromOrders,
      redeemedTotal,
      deliveredOrders,
    },
  });
}

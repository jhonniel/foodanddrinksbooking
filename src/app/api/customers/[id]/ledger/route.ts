import { NextRequest, NextResponse } from "next/server";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import { fetchPointsTransactionsForCustomer, syncDeliveredOrderPointsForCustomer, buildPointsLedgerFromOrders } from "@/lib/supabase/loyalty";
import type {
  Order,
  Profile,
  UserRole,
} from "@/types";

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    full_name: String(row.full_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: (row.role as UserRole) || "CUSTOMER",
    is_active: Boolean(row.is_active ?? true),
    points_balance: Number(row.points_balance ?? 0),
    lifetime_points: Number(row.lifetime_points ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapOrderLite(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    order_number: String(row.order_number ?? ""),
    customer_id: String(row.customer_id ?? ""),
    status: row.status as Order["status"],
    order_type: (row.order_type as Order["order_type"]) || "DELIVERY",
    subtotal: Number(row.subtotal ?? 0),
    delivery_fee: Number(row.delivery_fee ?? 0),
    discount: Number(row.discount ?? 0),
    points_discount: Number(row.points_discount ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    payment_status: (row.payment_status as Order["payment_status"]) || "PENDING",
    payment_method: (row.payment_method as Order["payment_method"]) || "COD",
    delivery_address_id: null,
    delivery_address_snapshot: null,
    delivery_instructions: null,
    driver_id: null,
    promotion_id: null,
    points_earned: Number(row.points_earned ?? 0),
    points_used: Number(row.points_used ?? 0),
    estimated_prep_minutes: Number(row.estimated_prep_minutes ?? 15),
    notes: null,
    cancelled_reason: (row.cancelled_reason as string | null) ?? null,
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    preparing_at: (row.preparing_at as string | null) ?? null,
    ready_at: (row.ready_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
    cancelled_at: (row.cancelled_at as string | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    items: [],
  };
}

export async function GET(
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
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required." },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const client = await createServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase client unavailable." },
      { status: 500 }
    );
  }

  const { data: customerRow, error: customerError } = await client
    .from("profiles")
    .select(
      "id, email, full_name, phone, avatar_url, role, is_active, points_balance, lifetime_points, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (customerError || !customerRow) {
    return NextResponse.json(
      { error: customerError?.message || "Customer not found." },
      { status: 404 }
    );
  }

  const customer = mapProfile(customerRow as Record<string, unknown>);

  // Credit any delivered orders that never wrote a points transaction
  await syncDeliveredOrderPointsForCustomer(id);

  // Re-read profile after sync (balance may have changed)
  const { data: refreshedProfile } = await client
    .from("profiles")
    .select(
      "id, email, full_name, phone, avatar_url, role, is_active, points_balance, lifetime_points, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  const customerFresh = refreshedProfile
    ? mapProfile(refreshedProfile as Record<string, unknown>)
    : customer;

  const { data: orderRows } = await client
    .from("orders")
    .select(
      "id, order_number, customer_id, status, order_type, subtotal, delivery_fee, discount, points_discount, tax, total, payment_status, payment_method, points_earned, points_used, estimated_prep_minutes, cancelled_reason, confirmed_at, preparing_at, ready_at, delivered_at, cancelled_at, created_at, updated_at"
    )
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const orders = (orderRows ?? []).map((row) =>
    mapOrderLite(row as Record<string, unknown>)
  );

  const storedTx = await fetchPointsTransactionsForCustomer(id);
  const pointsLedger = buildPointsLedgerFromOrders(id, orders, storedTx);

  const delivered = orders.filter((o) => o.status === "DELIVERED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  const pointsEarnedTotal = pointsLedger
    .filter((t) => t.points > 0)
    .reduce((s, t) => s + t.points, 0);
  const pointsRedeemedTotal = Math.abs(
    pointsLedger
      .filter((t) => t.points < 0)
      .reduce((s, t) => s + t.points, 0)
  );

  return NextResponse.json({
    customer: customerFresh,
    orders,
    pointsLedger,
    summary: {
      orderCount: orders.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      totalSpent: orders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((s, o) => s + o.total, 0),
      pointsBalance: customerFresh.points_balance,
      lifetimePoints: customerFresh.lifetime_points,
      pointsEarnedTotal,
      pointsRedeemedTotal,
    },
  });
}

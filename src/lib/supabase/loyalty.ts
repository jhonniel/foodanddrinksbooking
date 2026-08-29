import "server-only";

import type { PointsTransaction, PointsTransactionType } from "@/types";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { calculateOrderPointsEarned } from "@/services/loyaltyService";

type OrdersClient = NonNullable<Awaited<ReturnType<typeof createServerClient>>>;

function mapTx(row: Record<string, unknown>): PointsTransaction {
  return {
    id: String(row.id),
    customer_id: String(row.customer_id),
    order_id: (row.order_id as string | null) ?? null,
    reward_id: (row.reward_id as string | null) ?? null,
    type: row.type as PointsTransactionType,
    points: Number(row.points ?? 0),
    balance_after: Number(row.balance_after ?? 0),
    description: (row.description as string | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

/**
 * Correct earn amount: items after discounts only (never delivery fee).
 */
export function correctPointsEarnedForOrder(order: {
  subtotal: number;
  discount?: number;
  points_discount?: number;
  delivery_fee?: number;
}): number {
  return calculateOrderPointsEarned({
    subtotal: Number(order.subtotal ?? 0),
    discount: order.discount ?? 0,
    pointsDiscount: order.points_discount ?? 0,
  });
}

/**
 * Credit loyalty points when an order is delivered.
 * Idempotent via idempotency_key `earn:<orderId>`.
 * Recalculates earn base so delivery fee is never included.
 */
export async function creditPointsForDeliveredOrder(
  client: OrdersClient,
  order: {
    id: string;
    customer_id: string;
    order_number: string;
    points_earned: number;
    status: string;
    subtotal?: number;
    discount?: number;
    points_discount?: number;
  }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (order.status !== "DELIVERED") return;

  const earned =
    order.subtotal != null
      ? correctPointsEarnedForOrder({
          subtotal: order.subtotal,
          discount: order.discount,
          points_discount: order.points_discount,
        })
      : Math.max(0, Math.floor(Number(order.points_earned ?? 0)));

  // Keep orders.points_earned aligned with item-only rule
  if (earned !== Number(order.points_earned ?? 0)) {
    await client
      .from("orders")
      .update({ points_earned: earned, updated_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  if (earned <= 0) return;

  const idempotencyKey = `earn:${order.id}`;
  const { data: existing } = await client
    .from("points_transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.id) return;

  const { data: profile } = await client
    .from("profiles")
    .select("points_balance, lifetime_points")
    .eq("id", order.customer_id)
    .maybeSingle();

  const balance = Number(profile?.points_balance ?? 0);
  const lifetime = Number(profile?.lifetime_points ?? 0);
  const nextBalance = balance + earned;
  const nextLifetime = lifetime + earned;
  const now = new Date().toISOString();

  const { error: txError } = await client.from("points_transactions").insert({
    customer_id: order.customer_id,
    order_id: order.id,
    reward_id: null,
    type: "EARNED",
    points: earned,
    balance_after: nextBalance,
    description: `Points from order #${order.order_number}`,
    idempotency_key: idempotencyKey,
    created_at: now,
  });

  // Unique violation = already credited
  if (txError) {
    if (/duplicate|unique/i.test(txError.message)) return;
    console.error("[loyalty] earn tx failed:", txError.message);
    return;
  }

  await client
    .from("profiles")
    .update({
      points_balance: nextBalance,
      lifetime_points: nextLifetime,
      updated_at: now,
    })
    .eq("id", order.customer_id);
}

/**
 * Backfill missing earn credits for a customer's delivered orders.
 */
export async function syncDeliveredOrderPointsForCustomer(
  customerId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = await createServerClient();
  if (!client) return;

  const { data: orders } = await client
    .from("orders")
    .select(
      "id, customer_id, order_number, status, points_earned, subtotal, discount, points_discount"
    )
    .eq("customer_id", customerId)
    .eq("status", "DELIVERED");

  for (const row of orders ?? []) {
    await creditPointsForDeliveredOrder(client, {
      id: String(row.id),
      customer_id: String(row.customer_id),
      order_number: String(row.order_number),
      points_earned: Number(row.points_earned ?? 0),
      status: String(row.status),
      subtotal: Number(row.subtotal ?? 0),
      discount: Number(row.discount ?? 0),
      points_discount: Number(row.points_discount ?? 0),
    });
  }
}

/**
 * Record points spent at checkout. Idempotent via `redeem:<orderId>`.
 */
export async function recordPointsRedeemedForOrder(
  client: OrdersClient,
  order: {
    id: string;
    customer_id: string;
    order_number: string;
    points_used: number;
  }
): Promise<void> {
  const used = Math.max(0, Math.floor(Number(order.points_used ?? 0)));
  if (used <= 0) return;

  const idempotencyKey = `redeem:${order.id}`;
  const { data: existing } = await client
    .from("points_transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.id) return;

  const { data: profile } = await client
    .from("profiles")
    .select("points_balance")
    .eq("id", order.customer_id)
    .maybeSingle();

  const balance = Number(profile?.points_balance ?? 0);
  const nextBalance = Math.max(0, balance - used);
  const now = new Date().toISOString();

  const { error: txError } = await client.from("points_transactions").insert({
    customer_id: order.customer_id,
    order_id: order.id,
    reward_id: null,
    type: "REDEEMED",
    points: -used,
    balance_after: nextBalance,
    description: `Redeemed on order #${order.order_number}`,
    idempotency_key: idempotencyKey,
    created_at: now,
  });

  if (txError) {
    if (/duplicate|unique/i.test(txError.message)) return;
    console.error("[loyalty] redeem tx failed:", txError.message);
    return;
  }

  await client
    .from("profiles")
    .update({ points_balance: nextBalance, updated_at: now })
    .eq("id", order.customer_id);
}

export async function fetchPointsTransactionsForCustomer(
  customerId: string
): Promise<PointsTransaction[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("points_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[loyalty] list txs failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapTx(row as Record<string, unknown>));
}

/** Merge stored txs with delivered-order earns / checkout redeems when rows are missing. */
export function buildPointsLedgerFromOrders(
  customerId: string,
  orders: Array<{
    id: string;
    order_number: string;
    status: string;
    subtotal: number;
    discount: number;
    points_discount: number;
    points_earned: number;
    points_used: number;
    created_at: string;
    delivered_at: string | null;
    updated_at: string;
  }>,
  existing: PointsTransaction[]
): PointsTransaction[] {
  const byOrderType = new Set(
    existing
      .filter((t) => t.order_id)
      .map((t) => `${t.order_id}:${t.type}`)
  );

  const extras: PointsTransaction[] = [];

  for (const order of orders) {
    if (order.points_used > 0 && !byOrderType.has(`${order.id}:REDEEMED`)) {
      extras.push({
        id: `synth-redeem-${order.id}`,
        customer_id: customerId,
        order_id: order.id,
        reward_id: null,
        type: "REDEEMED",
        points: -Math.abs(order.points_used),
        balance_after: 0,
        description: `Redeemed on order #${order.order_number}`,
        created_at: order.created_at,
      });
    }

    if (
      order.status === "DELIVERED" &&
      !byOrderType.has(`${order.id}:EARNED`)
    ) {
      const earned = correctPointsEarnedForOrder({
        subtotal: order.subtotal,
        discount: order.discount,
        points_discount: order.points_discount,
      });
      if (earned > 0 || order.points_earned > 0) {
        const pts = earned > 0 ? earned : Math.max(0, order.points_earned);
        if (pts > 0) {
          extras.push({
            id: `synth-earn-${order.id}`,
            customer_id: customerId,
            order_id: order.id,
            reward_id: null,
            type: "EARNED",
            points: pts,
            balance_after: 0,
            description: `Points from order #${order.order_number}`,
            created_at: order.delivered_at || order.updated_at,
          });
        }
      }
    }
  }

  return [...existing, ...extras].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export async function adjustCustomerPoints(
  client: OrdersClient,
  input: {
    customerId: string;
    amount: number;
    note?: string;
    adminName?: string;
    idempotencyKey?: string;
  }
): Promise<
  | {
      ok: true;
      transaction: PointsTransaction;
      pointsBalance: number;
      lifetimePoints: number;
    }
  | { ok: false; error: string }
> {
  const amount = Math.trunc(input.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: "Enter a non-zero points amount." };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, role, points_balance, lifetime_points")
    .eq("id", input.customerId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message };
  }
  if (!profile?.id) {
    return { ok: false, error: "Customer not found." };
  }
  if (profile.role !== "CUSTOMER") {
    return { ok: false, error: "Points can only be adjusted for customers." };
  }

  const balance = Number(profile.points_balance ?? 0);
  const lifetime = Number(profile.lifetime_points ?? 0);
  const nextBalance = Math.max(0, balance + amount);
  const nextLifetime = amount > 0 ? lifetime + amount : lifetime;

  if (amount < 0 && nextBalance === balance) {
    return { ok: false, error: "Customer does not have enough points." };
  }

  const trimmedNote = input.note?.trim();
  const adminPrefix = input.adminName?.trim()
    ? `By ${input.adminName.trim()} · `
    : "";
  const description =
    trimmedNote && trimmedNote.length > 0
      ? `${adminPrefix}${trimmedNote}`
      : amount > 0
        ? `${adminPrefix}Points granted by admin`
        : `${adminPrefix}Points adjusted by admin`;

  const idempotencyKey =
    input.idempotencyKey ?? `adjust:${input.customerId}:${Date.now()}`;
  const now = new Date().toISOString();

  const { data: txRow, error: txError } = await client
    .from("points_transactions")
    .insert({
      customer_id: input.customerId,
      order_id: null,
      reward_id: null,
      type: "ADJUSTED",
      points: amount,
      balance_after: nextBalance,
      description,
      idempotency_key: idempotencyKey,
      created_at: now,
    })
    .select("*")
    .single();

  if (txError) {
    if (/duplicate|unique/i.test(txError.message)) {
      return { ok: false, error: "This points adjustment was already applied." };
    }
    return { ok: false, error: txError.message };
  }

  const { error: updateError } = await client
    .from("profiles")
    .update({
      points_balance: nextBalance,
      lifetime_points: nextLifetime,
      updated_at: now,
    })
    .eq("id", input.customerId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return {
    ok: true,
    transaction: mapTx(txRow as Record<string, unknown>),
    pointsBalance: nextBalance,
    lifetimePoints: nextLifetime,
  };
}

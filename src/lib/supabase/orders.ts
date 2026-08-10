import "server-only";

import {
  AUTO_CANCEL_REASON,
  PENDING_ACCEPT_TIMEOUT_MS,
} from "@/lib/constants";
import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import {
  createBrowserLikeServerClient,
  createServerClient,
} from "@/lib/supabase/server";
import { STORE_LOCATION } from "@/data/demo";
import { calculateDeliveryFee } from "@/lib/delivery/pricing";
import { getCartItemPrice } from "@/stores/cart";
import { LOYALTY_SETTINGS } from "@/data/demo";
import { processPayment } from "@/lib/payments/provider";
import { generateIdempotencyKey } from "@/lib/utils/format";
import type {
  CartItem,
  DeliveryOrder,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Profile,
  AddressSnapshot,
} from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Prefer service role (bypasses RLS) so every order read/write hits Supabase
 * reliably for admin + customer. Fall back to the cookie session only when
 * the service role key is missing.
 */
async function getOrdersClient() {
  if (!isSupabaseConfigured()) return null;
  if (getSupabaseServiceRoleKey()) {
    const admin = await createServerClient();
    if (admin) return admin;
  }
  return createBrowserLikeServerClient();
}

type DbOrderRow = Record<string, unknown> & {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  order_items?: Array<Record<string, unknown>>;
  delivery_orders?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  customer?: Profile | Profile[] | null;
};

function mapOrderItem(row: Record<string, unknown>): OrderItem {
  const options = (row.order_item_options as Array<Record<string, unknown>>) ?? [];
  const addons = (row.order_item_addons as Array<Record<string, unknown>>) ?? [];
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    product_id: String(row.product_id),
    product_name: String(row.product_name),
    product_image_url: (row.product_image_url as string | null) ?? null,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    total_price: Number(row.total_price),
    special_instructions: (row.special_instructions as string | null) ?? null,
    options: options.map((o) => ({
      id: String(o.id),
      order_item_id: String(o.order_item_id ?? row.id),
      option_name: String(o.option_name),
      value_name: String(o.value_name),
      price_adjustment: Number(o.price_adjustment ?? 0),
    })),
    addons: addons.map((a) => ({
      id: String(a.id),
      order_item_id: String(a.order_item_id ?? row.id),
      addon_name: String(a.addon_name),
      price: Number(a.price),
      quantity: Number(a.quantity ?? 1),
    })),
  };
}

function mapDelivery(row: Record<string, unknown>): DeliveryOrder {
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    driver_id: (row.driver_id as string | null) ?? null,
    status: row.status as DeliveryOrder["status"],
    customer_latitude:
      row.customer_latitude != null ? Number(row.customer_latitude) : null,
    customer_longitude:
      row.customer_longitude != null ? Number(row.customer_longitude) : null,
    store_latitude:
      row.store_latitude != null ? Number(row.store_latitude) : null,
    store_longitude:
      row.store_longitude != null ? Number(row.store_longitude) : null,
    estimated_arrival: (row.estimated_arrival as string | null) ?? null,
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    delivery_fee: row.delivery_fee != null ? Number(row.delivery_fee) : null,
    delivery_pin: (row.delivery_pin as string | null) ?? null,
    proof_photo_url: (row.proof_photo_url as string | null) ?? null,
    assigned_at: (row.assigned_at as string | null) ?? null,
    accepted_at: (row.accepted_at as string | null) ?? null,
    picked_up_at: (row.picked_up_at as string | null) ?? null,
    arrived_at: (row.arrived_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapOrder(row: DbOrderRow): Order {
  const customerRaw = row.customer;
  const customer = Array.isArray(customerRaw)
    ? customerRaw[0]
    : customerRaw ?? undefined;

  const deliveryRaw = row.delivery_orders;
  const deliveryRow = Array.isArray(deliveryRaw)
    ? deliveryRaw[0]
    : deliveryRaw;

  return {
    id: row.id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    status: row.status,
    order_type: row.order_type as OrderType,
    subtotal: Number(row.subtotal),
    delivery_fee: Number(row.delivery_fee),
    discount: Number(row.discount),
    points_discount: Number(row.points_discount),
    tax: Number(row.tax),
    total: Number(row.total),
    payment_status: row.payment_status as Order["payment_status"],
    payment_method: (row.payment_method as PaymentMethod | null) ?? null,
    delivery_address_id: (row.delivery_address_id as string | null) ?? null,
    delivery_address_snapshot:
      (row.delivery_address_snapshot as AddressSnapshot | null) ?? null,
    delivery_instructions: (row.delivery_instructions as string | null) ?? null,
    driver_id: (row.driver_id as string | null) ?? null,
    promotion_id: (row.promotion_id as string | null) ?? null,
    points_earned: Number(row.points_earned ?? 0),
    points_used: Number(row.points_used ?? 0),
    estimated_prep_minutes: Number(row.estimated_prep_minutes ?? 15),
    notes: (row.notes as string | null) ?? null,
    cancelled_reason: (row.cancelled_reason as string | null) ?? null,
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    preparing_at: (row.preparing_at as string | null) ?? null,
    ready_at: (row.ready_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
    cancelled_at: (row.cancelled_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    items: (row.order_items ?? []).map(mapOrderItem),
    customer: customer as Profile | undefined,
    delivery: deliveryRow ? mapDelivery(deliveryRow) : undefined,
  };
}

const ORDER_SELECT = `
  *,
  customer:profiles!customer_id (
    id, email, full_name, phone, avatar_url, role, is_active,
    points_balance, lifetime_points, created_at, updated_at
  ),
  order_items (
    *,
    order_item_options (*),
    order_item_addons (*)
  ),
  delivery_orders (*)
`;

export async function cancelStalePendingOrdersInSupabase(): Promise<Order[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await getOrdersClient();
  if (!client) return [];

  const cutoff = new Date(Date.now() - PENDING_ACCEPT_TIMEOUT_MS).toISOString();
  const now = new Date().toISOString();

  const { data: stale, error: findError } = await client
    .from("orders")
    .select("id")
    .eq("status", "PENDING")
    .lt("created_at", cutoff);

  if (findError || !stale?.length) return [];

  const ids = stale.map((o) => o.id as string);
  const { data, error } = await client
    .from("orders")
    .update({
      status: "CANCELLED",
      cancelled_reason: AUTO_CANCEL_REASON,
      cancelled_at: now,
      updated_at: now,
    })
    .in("id", ids)
    .select(ORDER_SELECT);

  if (error) {
    console.error("[orders] auto-cancel failed:", error.message);
    return [];
  }

  return ((data ?? []) as DbOrderRow[]).map(mapOrder);
}

export async function fetchOrdersFromSupabase(options?: {
  customerId?: string;
}): Promise<{
  orders: Order[];
  deliveries: DeliveryOrder[];
  autoCancelled: Order[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await getOrdersClient();
  if (!client) return null;

  const autoCancelled = await cancelStalePendingOrdersInSupabase();

  let query = client
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[orders] fetch failed:", error.message);
    return null;
  }

  const orders = ((data ?? []) as unknown as DbOrderRow[]).map(mapOrder);
  const deliveries = orders
    .map((o) => o.delivery)
    .filter((d): d is DeliveryOrder => Boolean(d));

  return { orders, deliveries, autoCancelled };
}

export async function fetchOrderByIdFromSupabase(
  orderId: string
): Promise<{ order: Order; delivery: DeliveryOrder | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await getOrdersClient();
  if (!client) return null;

  await cancelStalePendingOrdersInSupabase();

  const { data, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  const order = mapOrder(data as unknown as DbOrderRow);
  return { order, delivery: order.delivery ?? null };
}

async function resolveProductId(
  client: NonNullable<Awaited<ReturnType<typeof getOrdersClient>>>,
  item: CartItem
): Promise<string | null> {
  if (isUuid(item.productId)) {
    const { data } = await client
      .from("products")
      .select("id")
      .eq("id", item.productId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const exact = await client
    .from("products")
    .select("id")
    .eq("name", item.productName)
    .maybeSingle();
  if (exact.data?.id) return exact.data.id as string;

  const fuzzy = await client
    .from("products")
    .select("id")
    .ilike("name", item.productName)
    .limit(1)
    .maybeSingle();
  return (fuzzy.data?.id as string | undefined) ?? null;
}

export async function createOrderInSupabase(input: {
  customer: Profile;
  items: CartItem[];
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  address?: AddressSnapshot | null;
  deliveryInstructions?: string;
  deliveryFee: number;
  subtotal: number;
  discount: number;
  pointsDiscount: number;
  pointsUsed: number;
  idempotencyKey?: string;
}): Promise<{ order?: Order; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  if (!getSupabaseServiceRoleKey()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required so orders are saved to Supabase for admin.",
    };
  }
  const client = await getOrdersClient();
  if (!client) return { error: "Supabase client unavailable." };

  if (!input.items.length) return { error: "Your cart is empty." };
  if (!isUuid(input.customer.id)) {
    return {
      error:
        "Your account is not linked to Supabase. Sign out and sign in again.",
    };
  }

  const idempotencyKey = input.idempotencyKey || generateIdempotencyKey();

  const { data: existing } = await client
    .from("orders")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.id) {
    const loaded = await fetchOrderByIdFromSupabase(existing.id as string);
    if (loaded) {
      return { order: { ...loaded.order, customer: input.customer } };
    }
  }

  const total = Math.max(
    0,
    input.subtotal +
      input.deliveryFee -
      input.discount -
      input.pointsDiscount
  );

  const payment = await processPayment({
    orderId: "pending",
    amount: total,
    method: input.paymentMethod,
    customerId: input.customer.id,
    idempotencyKey: `pay_${idempotencyKey}`,
  });
  if (!payment.success) {
    return { error: payment.message || "Payment failed." };
  }

  const resolvedItems: Array<CartItem & { resolvedProductId: string }> = [];
  for (const item of input.items) {
    const productId = await resolveProductId(client, item);
    if (!productId) {
      return {
        error: `Product "${item.productName}" is not in the Supabase catalog. Use products from the live menu.`,
      };
    }
    resolvedItems.push({ ...item, resolvedProductId: productId });
  }

  const pointsEarned = Math.floor(total * LOYALTY_SETTINGS.points_per_peso);

  const { data: orderRow, error: orderError } = await client
    .from("orders")
    .insert({
      customer_id: input.customer.id,
      status: "PENDING",
      order_type: input.orderType,
      subtotal: input.subtotal,
      delivery_fee: input.deliveryFee,
      discount: input.discount,
      points_discount: input.pointsDiscount,
      tax: 0,
      total,
      payment_status: payment.status,
      payment_method: input.paymentMethod,
      delivery_address_snapshot: input.address ?? null,
      delivery_instructions: input.deliveryInstructions ?? null,
      points_earned: pointsEarned,
      points_used: input.pointsUsed,
      estimated_prep_minutes: 15,
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (orderError || !orderRow) {
    console.error("[orders] insert failed:", orderError?.message);
    return { error: orderError?.message || "Failed to create order." };
  }

  const orderId = orderRow.id as string;

  for (const item of resolvedItems) {
    const lineTotal = getCartItemPrice(item);
    const { data: itemRow, error: itemError } = await client
      .from("order_items")
      .insert({
        order_id: orderId,
        product_id: item.resolvedProductId,
        product_name: item.productName,
        product_image_url: item.productImage,
        quantity: item.quantity,
        unit_price: lineTotal / item.quantity,
        total_price: lineTotal,
        special_instructions: item.specialInstructions || null,
      })
      .select("id")
      .single();

    if (itemError || !itemRow) {
      console.error("[orders] item insert failed:", itemError?.message);
      return { error: itemError?.message || "Failed to save order items." };
    }

    const itemId = itemRow.id as string;
    if (item.options?.length) {
      const { error } = await client.from("order_item_options").insert(
        item.options.map((o) => ({
          order_item_id: itemId,
          option_name: o.optionName,
          value_name: o.valueName,
          price_adjustment: o.priceAdjustment ?? 0,
        }))
      );
      if (error) {
        console.error("[orders] options insert failed:", error.message);
      }
    }
    if (item.addons?.length) {
      const { error } = await client.from("order_item_addons").insert(
        item.addons.map((a) => ({
          order_item_id: itemId,
          addon_name: a.name,
          price: a.price ?? 0,
          quantity: a.quantity ?? 1,
        }))
      );
      if (error) {
        console.error("[orders] addons insert failed:", error.message);
      }
    }
  }

  const loaded = await fetchOrderByIdFromSupabase(orderId);
  if (!loaded) {
    return { error: "Order created but could not be reloaded." };
  }
  return { order: { ...loaded.order, customer: input.customer } };
}

export async function updateOrderStatusInSupabase(
  orderId: string,
  status: OrderStatus,
  extras?: { cancelledReason?: string | null }
): Promise<{ order?: Order; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const client = await getOrdersClient();
  if (!client) return { error: "Supabase client unavailable." };

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updated_at: now };
  if (status === "CONFIRMED") updates.confirmed_at = now;
  if (status === "PREPARING") updates.preparing_at = now;
  if (status === "READY") updates.ready_at = now;
  if (status === "DELIVERED") updates.delivered_at = now;
  if (status === "CANCELLED") {
    updates.cancelled_at = now;
    updates.cancelled_reason =
      extras?.cancelledReason ?? "Cancelled by store";
  }

  const { error } = await client.from("orders").update(updates).eq("id", orderId);
  if (error) return { error: error.message };

  const loaded = await fetchOrderByIdFromSupabase(orderId);
  if (!loaded) return { error: "Order updated but could not be reloaded." };
  return { order: loaded.order };
}

export async function assignDriverInSupabase(input: {
  orderId: string;
  driverId: string;
  driverProfileId?: string;
}): Promise<{ order?: Order; delivery?: DeliveryOrder; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const client = await getOrdersClient();
  if (!client) return { error: "Supabase client unavailable." };

  const loaded = await fetchOrderByIdFromSupabase(input.orderId);
  if (!loaded) return { error: "Order not found." };

  const order = loaded.order;
  const now = new Date().toISOString();
  const lat = order.delivery_address_snapshot?.latitude;
  const lng = order.delivery_address_snapshot?.longitude;
  const quote =
    lat != null && lng != null
      ? calculateDeliveryFee({ lat, lng }, order.subtotal ?? 0)
      : null;

  // driverId may be drivers.id or profiles.id — resolve drivers row if needed
  let driverRowId = input.driverId;
  if (isUuid(input.driverId)) {
    const byId = await client
      .from("drivers")
      .select("id, profile_id")
      .eq("id", input.driverId)
      .maybeSingle();
    if (byId.data?.id) {
      driverRowId = byId.data.id as string;
    } else {
      const byProfile = await client
        .from("drivers")
        .select("id, profile_id")
        .eq("profile_id", input.driverId)
        .maybeSingle();
      if (byProfile.data?.id) driverRowId = byProfile.data.id as string;
    }
  }

  const deliveryPayload = {
    order_id: input.orderId,
    driver_id: driverRowId,
    status: "ASSIGNED" as const,
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
    assigned_at: now,
    updated_at: now,
  };

  const { data: deliveryRow, error: deliveryError } = await client
    .from("delivery_orders")
    .upsert(deliveryPayload, { onConflict: "order_id" })
    .select("*")
    .single();

  if (deliveryError) {
    return { error: deliveryError.message };
  }

  const profileDriverId = input.driverProfileId || input.driverId;
  const { error: orderError } = await client
    .from("orders")
    .update({
      status: "ASSIGNED",
      driver_id: isUuid(profileDriverId) ? profileDriverId : null,
      updated_at: now,
    })
    .eq("id", input.orderId);

  if (orderError) return { error: orderError.message };

  const refreshed = await fetchOrderByIdFromSupabase(input.orderId);
  return {
    order: refreshed?.order,
    delivery: deliveryRow ? mapDelivery(deliveryRow) : refreshed?.delivery ?? undefined,
  };
}

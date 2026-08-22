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
import { calculateOrderPointsEarned } from "@/services/loyaltyService";
import {
  creditPointsForDeliveredOrder,
  recordPointsRedeemedForOrder,
} from "@/lib/supabase/loyalty";
import { processPayment } from "@/lib/payments/provider";
import { generateIdempotencyKey } from "@/lib/utils/format";
import type {
  CartItem,
  DeliveryOrder,
  Driver,
  DriverStatus,
  DeliveryStatus,
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
  const driverRaw = row.driver;
  const driverRow = Array.isArray(driverRaw) ? driverRaw[0] : driverRaw;
  let driver: Driver | undefined;
  if (driverRow && typeof driverRow === "object") {
    const d = driverRow as Record<string, unknown>;
    const profileRaw = d.profile;
    const profileRow = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    driver = {
      id: String(d.id),
      profile_id: String(d.profile_id),
      vehicle_type: String(d.vehicle_type ?? "Motorcycle"),
      vehicle_number: (d.vehicle_number as string | null) ?? null,
      license_number: (d.license_number as string | null) ?? null,
      status: (d.status as DriverStatus) || "OFFLINE",
      rating: Number(d.rating ?? 5),
      total_deliveries: Number(d.total_deliveries ?? 0),
      is_active: Boolean(d.is_active ?? true),
      created_at: String(d.created_at ?? new Date().toISOString()),
      updated_at: String(d.updated_at ?? new Date().toISOString()),
      profile: profileRow
        ? (profileRow as Profile)
        : undefined,
    };
  }

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
    driver,
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
  delivery_orders (
    *,
    driver:drivers!driver_id (
      id, profile_id, vehicle_type, vehicle_number, license_number,
      status, rating, total_deliveries, is_active, created_at, updated_at,
      profile:profiles!profile_id (
        id, email, full_name, phone, avatar_url, role, is_active,
        points_balance, lifetime_points, created_at, updated_at
      )
    )
  )
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
  /** Profile id of the signed-in driver — returns only their assigned orders. */
  driverProfileId?: string;
}): Promise<{
  orders: Order[];
  deliveries: DeliveryOrder[];
  autoCancelled: Order[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await getOrdersClient();
  if (!client) return null;

  const autoCancelled = await cancelStalePendingOrdersInSupabase();

  // Drivers: match delivery_orders.driver_id (drivers.id) and/or orders.driver_id (profiles.id)
  if (options?.driverProfileId) {
    const { data: driverRow } = await client
      .from("drivers")
      .select("id")
      .eq("profile_id", options.driverProfileId)
      .maybeSingle();

    const orderIdSet = new Set<string>();

    if (driverRow?.id) {
      const { data: deliveryRows } = await client
        .from("delivery_orders")
        .select("order_id")
        .eq("driver_id", driverRow.id as string);
      for (const row of deliveryRows ?? []) {
        if (row.order_id) orderIdSet.add(String(row.order_id));
      }
    }

    const { data: byProfile } = await client
      .from("orders")
      .select("id")
      .eq("driver_id", options.driverProfileId);
    for (const row of byProfile ?? []) {
      if (row.id) orderIdSet.add(String(row.id));
    }

    if (orderIdSet.size === 0) {
      return { orders: [], deliveries: [], autoCancelled };
    }

    const { data, error } = await client
      .from("orders")
      .select(ORDER_SELECT)
      .in("id", Array.from(orderIdSet))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[orders] fetch (driver) failed:", error.message);
      return null;
    }

    const orders = ((data ?? []) as unknown as DbOrderRow[]).map(mapOrder);
    const deliveries: DeliveryOrder[] = [];
    for (const o of orders) {
      if (!o.delivery) continue;
      deliveries.push({ ...o.delivery, order: o });
    }

    return { orders, deliveries, autoCancelled };
  }

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
  const deliveries: DeliveryOrder[] = [];
  for (const o of orders) {
    if (!o.delivery) continue;
    deliveries.push({ ...o.delivery, order: o });
  }

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

  const pointsEarned = calculateOrderPointsEarned({
    subtotal: input.subtotal,
    discount: input.discount,
    pointsDiscount: input.pointsDiscount,
  });

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

  if (input.pointsUsed > 0) {
    await recordPointsRedeemedForOrder(client, {
      id: loaded.order.id,
      customer_id: loaded.order.customer_id,
      order_number: loaded.order.order_number,
      points_used: input.pointsUsed,
    });
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

  if (status === "DELIVERED") {
    await creditPointsForDeliveredOrder(client, {
      id: loaded.order.id,
      customer_id: loaded.order.customer_id,
      order_number: loaded.order.order_number,
      points_earned: loaded.order.points_earned,
      status: loaded.order.status,
      subtotal: loaded.order.subtotal,
      discount: loaded.order.discount,
      points_discount: loaded.order.points_discount,
    });
  }

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
  const existingDelivery = loaded.delivery;
  const previousDriverId = existingDelivery?.driver_id ?? null;
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

  // Resolve profile_id for orders.driver_id (FK → profiles.id, not drivers.id)
  const { data: assignedDriver } = await client
    .from("drivers")
    .select("id, profile_id")
    .eq("id", driverRowId)
    .maybeSingle();

  const profileDriverId =
    (assignedDriver?.profile_id as string | undefined) ||
    (isUuid(input.driverProfileId ?? "")
      ? input.driverProfileId
      : undefined) ||
    null;

  // Free previous driver when reassigning
  if (previousDriverId && previousDriverId !== driverRowId) {
    const { data: otherActive } = await client
      .from("delivery_orders")
      .select("id")
      .eq("driver_id", previousDriverId)
      .neq("order_id", input.orderId)
      .not("status", "in", "(DELIVERED,CANCELLED)")
      .limit(1);
    if (!otherActive?.length) {
      await client
        .from("drivers")
        .update({ status: "ONLINE", updated_at: now })
        .eq("id", previousDriverId);
    }
  }

  await client
    .from("drivers")
    .update({ status: "BUSY", updated_at: now })
    .eq("id", driverRowId);

  const deliveryPayload = {
    order_id: input.orderId,
    driver_id: driverRowId,
    status: "ASSIGNED" as const,
    customer_latitude: lat ?? existingDelivery?.customer_latitude ?? null,
    customer_longitude: lng ?? existingDelivery?.customer_longitude ?? null,
    store_latitude: STORE_LOCATION.lat,
    store_longitude: STORE_LOCATION.lng,
    estimated_arrival: new Date(
      Date.now() + (quote?.estimatedMinutes ?? 30) * 60000
    ).toISOString(),
    distance_km: quote?.distanceKm ?? existingDelivery?.distance_km ?? null,
    delivery_fee:
      order.delivery_fee ?? quote?.fee ?? existingDelivery?.delivery_fee ?? 0,
    // Keep PIN on reassign so customer instructions stay valid
    delivery_pin:
      existingDelivery?.delivery_pin ??
      String(Math.floor(1000 + Math.random() * 9000)),
    assigned_at: now,
    accepted_at: null,
    picked_up_at: null,
    arrived_at: null,
    delivered_at: null,
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

  const { error: orderError } = await client
    .from("orders")
    .update({
      status: "ASSIGNED",
      driver_id: profileDriverId,
      updated_at: now,
    })
    .eq("id", input.orderId);

  if (orderError) return { error: orderError.message };

  const refreshed = await fetchOrderByIdFromSupabase(input.orderId);
  return {
    order: refreshed?.order,
    delivery: deliveryRow
      ? mapDelivery(deliveryRow)
      : refreshed?.delivery ?? undefined,
  };
}

const DELIVERY_TO_ORDER_STATUS: Partial<Record<DeliveryStatus, OrderStatus>> = {
  ACCEPTED: "ASSIGNED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  ARRIVED: "ARRIVED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

export async function updateDeliveryStatusInSupabase(input: {
  deliveryId: string;
  status: DeliveryStatus;
  /** Optional — when provided, enforces the caller owns this delivery. */
  actorProfileId?: string;
  actorIsStaff?: boolean;
}): Promise<{ order?: Order; delivery?: DeliveryOrder; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const client = await getOrdersClient();
  if (!client) return { error: "Supabase client unavailable." };

  const { data: deliveryRow, error: findError } = await client
    .from("delivery_orders")
    .select("*")
    .eq("id", input.deliveryId)
    .maybeSingle();

  if (findError || !deliveryRow) {
    return { error: findError?.message || "Delivery not found." };
  }

  if (!input.actorIsStaff && input.actorProfileId) {
    const driverId = deliveryRow.driver_id as string | null;
    if (!driverId) {
      return { error: "This delivery has no assigned driver." };
    }
    const { data: driverRow } = await client
      .from("drivers")
      .select("id, profile_id")
      .eq("id", driverId)
      .maybeSingle();
    if (!driverRow || driverRow.profile_id !== input.actorProfileId) {
      return { error: "You can only update your own deliveries." };
    }
  }

  const now = new Date().toISOString();
  const deliveryUpdates: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  };
  if (input.status === "ACCEPTED") deliveryUpdates.accepted_at = now;
  if (input.status === "PICKED_UP") deliveryUpdates.picked_up_at = now;
  if (input.status === "ARRIVED") deliveryUpdates.arrived_at = now;
  if (input.status === "DELIVERED") deliveryUpdates.delivered_at = now;
  if (input.status === "CANCELLED") deliveryUpdates.cancelled_at = now;

  const { error: deliveryError } = await client
    .from("delivery_orders")
    .update(deliveryUpdates)
    .eq("id", input.deliveryId);

  if (deliveryError) return { error: deliveryError.message };

  const orderId = String(deliveryRow.order_id);
  const orderStatus = DELIVERY_TO_ORDER_STATUS[input.status];
  if (orderStatus) {
    const orderUpdates: Record<string, unknown> = {
      status: orderStatus,
      updated_at: now,
    };
    if (orderStatus === "DELIVERED") orderUpdates.delivered_at = now;
    if (orderStatus === "CANCELLED") orderUpdates.cancelled_at = now;
    const { error: orderError } = await client
      .from("orders")
      .update(orderUpdates)
      .eq("id", orderId);
    if (orderError) return { error: orderError.message };
  }

  // Free driver when job ends
  if (
    (input.status === "DELIVERED" || input.status === "CANCELLED") &&
    deliveryRow.driver_id
  ) {
    const driverId = String(deliveryRow.driver_id);
    const { data: otherActive } = await client
      .from("delivery_orders")
      .select("id")
      .eq("driver_id", driverId)
      .neq("id", input.deliveryId)
      .not("status", "in", "(DELIVERED,CANCELLED)")
      .limit(1);

    if (!otherActive?.length) {
      await client
        .from("drivers")
        .update({ status: "ONLINE", updated_at: now })
        .eq("id", driverId);
    }

    if (input.status === "DELIVERED") {
      const { data: drv } = await client
        .from("drivers")
        .select("total_deliveries")
        .eq("id", driverId)
        .maybeSingle();
      const nextCount = Number(drv?.total_deliveries ?? 0) + 1;
      await client
        .from("drivers")
        .update({ total_deliveries: nextCount, updated_at: now })
        .eq("id", driverId);
    }
  } else if (input.status === "ACCEPTED" && deliveryRow.driver_id) {
    await client
      .from("drivers")
      .update({ status: "BUSY", updated_at: now })
      .eq("id", String(deliveryRow.driver_id));
  }

  const refreshed = await fetchOrderByIdFromSupabase(orderId);

  if (input.status === "DELIVERED" && refreshed?.order) {
    await creditPointsForDeliveredOrder(client, {
      id: refreshed.order.id,
      customer_id: refreshed.order.customer_id,
      order_number: refreshed.order.order_number,
      points_earned: refreshed.order.points_earned,
      status: refreshed.order.status,
      subtotal: refreshed.order.subtotal,
      discount: refreshed.order.discount,
      points_discount: refreshed.order.points_discount,
    });
  }

  return {
    order: refreshed?.order,
    delivery: refreshed?.delivery ?? undefined,
  };
}

/**
 * Permanently remove a completed/cancelled order and related records.
 * Only for admin cleanup of order history — not active queue orders.
 */
export async function deleteOrderInSupabase(
  orderId: string
): Promise<{ error?: string }> {
  const client = await getOrdersClient();
  if (!client) {
    return { error: "Supabase is not configured." };
  }

  const loaded = await fetchOrderByIdFromSupabase(orderId);
  if (!loaded) {
    return { error: "Order not found." };
  }

  const order = loaded.order;
  if (order.status !== "DELIVERED" && order.status !== "CANCELLED") {
    return {
      error: "Only delivered or cancelled orders can be deleted from history.",
    };
  }

  const { data: pointsTxs } = await client
    .from("points_transactions")
    .select("type, points")
    .eq("order_id", orderId);

  if (pointsTxs?.length) {
    let balanceDelta = 0;
    let lifetimeDelta = 0;
    for (const tx of pointsTxs) {
      const pts = Number(tx.points ?? 0);
      balanceDelta -= pts;
      if (tx.type === "EARNED") {
        lifetimeDelta -= Math.abs(pts);
      }
    }

    const { data: profile } = await client
      .from("profiles")
      .select("points_balance, lifetime_points")
      .eq("id", order.customer_id)
      .maybeSingle();

    const nextBalance = Math.max(
      0,
      Number(profile?.points_balance ?? 0) + balanceDelta
    );
    const nextLifetime = Math.max(
      0,
      Number(profile?.lifetime_points ?? 0) + lifetimeDelta
    );

    await client.from("points_transactions").delete().eq("order_id", orderId);
    await client
      .from("profiles")
      .update({
        points_balance: nextBalance,
        lifetime_points: nextLifetime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.customer_id);
  }

  const { data: promoUsages } = await client
    .from("promotion_usages")
    .select("promotion_id")
    .eq("order_id", orderId);

  await client.from("promotion_usages").delete().eq("order_id", orderId);

  for (const usage of promoUsages ?? []) {
    const promoId = String(usage.promotion_id);
    const { data: promo } = await client
      .from("promotions")
      .select("usage_count")
      .eq("id", promoId)
      .maybeSingle();
    const nextCount = Math.max(0, Number(promo?.usage_count ?? 1) - 1);
    await client
      .from("promotions")
      .update({ usage_count: nextCount, updated_at: new Date().toISOString() })
      .eq("id", promoId);
  }

  await client.from("payments").delete().eq("order_id", orderId);
  await client.from("delivery_orders").delete().eq("order_id", orderId);
  await client.from("reward_redemptions").delete().eq("order_id", orderId);
  await client
    .from("reviews")
    .update({ order_id: null })
    .eq("order_id", orderId);
  await client.from("inventory_deductions").delete().eq("order_id", orderId);

  const { error } = await client.from("orders").delete().eq("id", orderId);
  if (error) {
    return { error: error.message };
  }

  return {};
}

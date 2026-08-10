import "server-only";

import { promises as fs } from "fs";
import path from "path";
import {
  AUTO_CANCEL_REASON,
  PENDING_ACCEPT_TIMEOUT_MS,
} from "@/lib/constants";
import type { DeliveryOrder, Order, OrderStatus } from "@/types";

interface OrdersDb {
  orders: Order[];
  deliveries: DeliveryOrder[];
  orderSeq: number;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

async function ensureStore(): Promise<OrdersDb> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(ORDERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<OrdersDb>;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : [],
      orderSeq:
        typeof parsed.orderSeq === "number" && parsed.orderSeq > 0
          ? parsed.orderSeq
          : 10255,
    };
  } catch {
    const empty: OrdersDb = { orders: [], deliveries: [], orderSeq: 10255 };
    await fs.writeFile(ORDERS_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function saveStore(db: OrdersDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ORDERS_FILE, JSON.stringify(db, null, 2), "utf8");
}

/**
 * Cancel PENDING orders the store never accepted within the timeout window.
 * Runs lazily whenever the orders store is read.
 */
export async function cancelStalePendingOrders(
  nowMs = Date.now()
): Promise<Order[]> {
  const db = await ensureStore();
  const nowIso = new Date(nowMs).toISOString();
  const cancelled: Order[] = [];

  let changed = false;
  db.orders = db.orders.map((order) => {
    if (order.status !== "PENDING") return order;
    const created = Date.parse(order.created_at);
    if (!Number.isFinite(created)) return order;
    if (nowMs - created < PENDING_ACCEPT_TIMEOUT_MS) return order;

    const next: Order = {
      ...order,
      status: "CANCELLED",
      cancelled_reason: AUTO_CANCEL_REASON,
      cancelled_at: nowIso,
      updated_at: nowIso,
    };
    cancelled.push(next);
    changed = true;
    return next;
  });

  if (changed) await saveStore(db);
  return cancelled;
}

export async function listOrders(): Promise<Order[]> {
  await cancelStalePendingOrders();
  const db = await ensureStore();
  return db.orders;
}

export async function listDeliveries(): Promise<DeliveryOrder[]> {
  const db = await ensureStore();
  return db.deliveries;
}

export async function getOrdersSnapshot(): Promise<{
  orders: Order[];
  deliveries: DeliveryOrder[];
  autoCancelled: Order[];
}> {
  const autoCancelled = await cancelStalePendingOrders();
  const db = await ensureStore();
  return {
    orders: db.orders,
    deliveries: db.deliveries,
    autoCancelled,
  };
}

export async function nextOrderNumber(): Promise<string> {
  const db = await ensureStore();
  const n = db.orderSeq;
  db.orderSeq = n + 1;
  await saveStore(db);
  return `IC${n}`;
}

export async function saveOrder(order: Order): Promise<Order> {
  const db = await ensureStore();
  const idx = db.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    db.orders[idx] = order;
  } else {
    db.orders = [order, ...db.orders];
  }
  await saveStore(db);
  return order;
}

export async function findOrderById(orderId: string): Promise<Order | null> {
  await cancelStalePendingOrders();
  const db = await ensureStore();
  return db.orders.find((o) => o.id === orderId) ?? null;
}

export async function updateOrderFields(
  orderId: string,
  updates: Partial<Order>
): Promise<Order | null> {
  const db = await ensureStore();
  const idx = db.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  const next = {
    ...db.orders[idx],
    ...updates,
    updated_at: updates.updated_at ?? new Date().toISOString(),
  };
  db.orders[idx] = next;
  await saveStore(db);
  return next;
}

export async function upsertDelivery(
  delivery: DeliveryOrder
): Promise<DeliveryOrder> {
  const db = await ensureStore();
  db.deliveries = [
    ...db.deliveries.filter((d) => d.order_id !== delivery.order_id),
    delivery,
  ];
  await saveStore(db);
  return delivery;
}

export async function updateOrderStatusInStore(
  orderId: string,
  status: OrderStatus
): Promise<Order | null> {
  const now = new Date().toISOString();
  const updates: Partial<Order> = { status, updated_at: now };
  if (status === "CONFIRMED") updates.confirmed_at = now;
  if (status === "PREPARING") updates.preparing_at = now;
  if (status === "READY") updates.ready_at = now;
  if (status === "DELIVERED") updates.delivered_at = now;
  if (status === "CANCELLED") updates.cancelled_at = now;
  return updateOrderFields(orderId, updates);
}

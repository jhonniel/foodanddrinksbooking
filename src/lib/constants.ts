import type { OrderStatus } from "@/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "New",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked Up",
  OUT_FOR_DELIVERY: "Out for Delivery",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  "default" | "success" | "warning" | "danger" | "info" | "pending"
> = {
  PENDING: "pending",
  CONFIRMED: "info",
  PREPARING: "warning",
  READY: "info",
  ASSIGNED: "info",
  PICKED_UP: "info",
  OUT_FOR_DELIVERY: "info",
  ARRIVED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export const CUSTOMER_TRACKING_STEPS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const KANBAN_COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "New" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY", label: "Ready" },
  { status: "ASSIGNED", label: "Assigned" },
  { status: "PICKED_UP", label: "Picked Up" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "ARRIVED", label: "Arrived" },
  { status: "DELIVERED", label: "Delivered" },
  { status: "CANCELLED", label: "Cancelled" },
];

/** Active board columns — completed/cancelled live in Order History. */
export const ORDERS_QUEUE_COLUMNS: { status: OrderStatus; label: string }[] =
  KANBAN_COLUMNS.filter(
    (c) => c.status !== "DELIVERED" && c.status !== "CANCELLED"
  );

/** Active orders shown on the admin queue board (excludes delivered/cancelled). */
export function countActiveQueueOrders(
  orders: ReadonlyArray<{ status: OrderStatus }>
): number {
  return orders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
  ).length;
}

export function countPendingOrders(
  orders: ReadonlyArray<{ status: OrderStatus }>
): number {
  return orders.filter((o) => o.status === "PENDING").length;
}

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "ASSIGNED",
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "ARRIVED",
  ARRIVED: "DELIVERED",
};

export const STATUS_ACTIONS: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus }>
> = {
  PENDING: { label: "Accept", next: "CONFIRMED" },
  CONFIRMED: { label: "Start Preparing", next: "PREPARING" },
  PREPARING: { label: "Mark Ready", next: "READY" },
  READY: { label: "Assign Rider", next: "ASSIGNED" },
  /** Staff can complete from queue after rider arrives (or for edge cases). */
  ARRIVED: { label: "Mark Delivered", next: "DELIVERED" },
};

/** Unaccepted (PENDING) orders auto-cancel after this duration. */
export const PENDING_ACCEPT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export const AUTO_CANCEL_REASON =
  "Store did not accept the order within 1 hour";

/** Customer may cancel only before admin Confirms (PENDING only). */
export function customerCanCancelOrder(status: OrderStatus): boolean {
  return status === "PENDING";
}

/** Staff/admin may cancel any order that is not already finished. */
export function staffCanCancelOrder(status: OrderStatus): boolean {
  return status !== "DELIVERED" && status !== "CANCELLED";
}

export const PERMISSIONS = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "dashboard",
    "orders",
    "products",
    "categories",
    "inventory",
    "customers",
    "drivers",
    "delivery",
    "rewards",
    "promotions",
    "payments",
    "reports",
    "settings",
  ],
  MANAGER: [
    "dashboard",
    "orders",
    "products",
    "inventory",
    "customers",
    "delivery",
    "reports",
  ],
  STAFF: ["dashboard", "orders", "products"],
  DRIVER: ["deliveries", "earnings", "profile"],
  CUSTOMER: ["home", "menu", "orders", "rewards", "profile"],
} as const;

export function hasPermission(
  role: keyof typeof PERMISSIONS,
  permission: string
): boolean {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  if ((perms as readonly string[]).includes("*")) return true;
  return (perms as readonly string[]).includes(permission);
}

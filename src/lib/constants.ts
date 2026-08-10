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
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

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
};

/** Unaccepted (PENDING) orders auto-cancel after this duration. */
export const PENDING_ACCEPT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export const AUTO_CANCEL_REASON =
  "Store did not accept the order within 1 hour";

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

import type { Order, OrderStatus, OrderType } from "@/types";

export interface TrackingStep {
  key: OrderStatus;
  label: string;
  description: string;
}

export const DELIVERY_TRACKING_STEPS: TrackingStep[] = [
  {
    key: "PENDING",
    label: "Order placed",
    description: "We received your order and will confirm it shortly.",
  },
  {
    key: "CONFIRMED",
    label: "Confirmed",
    description: "The store accepted your order.",
  },
  {
    key: "PREPARING",
    label: "Preparing",
    description: "Your drinks are being prepared.",
  },
  {
    key: "READY",
    label: "Ready",
    description: "Order is packed and waiting for a rider.",
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "On the way",
    description: "Your rider is heading to you.",
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    description: "Enjoy your Island Coolers!",
  },
];

export const PICKUP_TRACKING_STEPS: TrackingStep[] = [
  {
    key: "PENDING",
    label: "Order placed",
    description: "We received your order and will confirm it shortly.",
  },
  {
    key: "CONFIRMED",
    label: "Confirmed",
    description: "The store accepted your order.",
  },
  {
    key: "PREPARING",
    label: "Preparing",
    description: "Your drinks are being prepared.",
  },
  {
    key: "READY",
    label: "Ready for pickup",
    description: "You can pick up your order at the counter.",
  },
  {
    key: "DELIVERED",
    label: "Completed",
    description: "Thanks for picking up your order!",
  },
];

/** Map internal statuses onto the customer-facing step keys */
export function resolveCustomerStep(
  status: OrderStatus,
  orderType: OrderType
): OrderStatus | null {
  if (status === "CANCELLED") return null;

  if (orderType === "PICKUP") {
    if (["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"].includes(status)) {
      return "READY";
    }
    if (PICKUP_TRACKING_STEPS.some((s) => s.key === status)) return status;
    return "PENDING";
  }

  // Delivery
  if (status === "ASSIGNED" || status === "PICKED_UP") return "OUT_FOR_DELIVERY";
  if (status === "ARRIVED") return "OUT_FOR_DELIVERY";
  if (DELIVERY_TRACKING_STEPS.some((s) => s.key === status)) return status;
  return "PENDING";
}

export function getTrackingSteps(orderType: OrderType): TrackingStep[] {
  return orderType === "PICKUP" ? PICKUP_TRACKING_STEPS : DELIVERY_TRACKING_STEPS;
}

export function getTrackingProgress(
  status: OrderStatus,
  orderType: OrderType
): { currentIdx: number; percent: number; current: TrackingStep | null } {
  const steps = getTrackingSteps(orderType);
  const stepKey = resolveCustomerStep(status, orderType);
  if (stepKey === null) {
    return { currentIdx: -1, percent: 0, current: null };
  }
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );
  const percent = Math.round(((currentIdx + 1) / steps.length) * 100);
  return { currentIdx, percent, current: steps[currentIdx] ?? null };
}

export function stepTimestamp(
  order: Order,
  stepKey: OrderStatus
): string | null {
  switch (stepKey) {
    case "PENDING":
      return order.created_at;
    case "CONFIRMED":
      return order.confirmed_at;
    case "PREPARING":
      return order.preparing_at;
    case "READY":
      return order.ready_at;
    case "DELIVERED":
      return order.delivered_at;
    default:
      return null;
  }
}

export function trackingHeadline(
  status: OrderStatus,
  orderType: OrderType
): string {
  if (status === "CANCELLED") return "This order was cancelled";
  const { current } = getTrackingProgress(status, orderType);
  if (!current) return "Tracking your order";
  if (status === "DELIVERED") {
    return orderType === "PICKUP" ? "Order completed" : "Order delivered";
  }
  if (status === "ARRIVED") return "Rider has arrived";
  if (status === "ASSIGNED" || status === "PICKED_UP") {
    return "Rider is on the way";
  }
  return current.label;
}

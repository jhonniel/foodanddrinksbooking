import type { Notification, NotificationType } from "@/types";

export function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Notification {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data || {},
    is_read: false,
    created_at: new Date().toISOString(),
  };
}

export const NotificationTemplates = {
  orderConfirmed: (orderNumber: string) => ({
    type: "ORDER" as const,
    title: "Order confirmed",
    body: `Your order #${orderNumber} has been confirmed and is being prepared.`,
  }),
  orderPreparing: (orderNumber: string) => ({
    type: "ORDER" as const,
    title: "Preparing your drinks",
    body: `We're crafting order #${orderNumber} now.`,
  }),
  orderReady: (orderNumber: string) => ({
    type: "ORDER" as const,
    title: "Order ready",
    body: `Order #${orderNumber} is ready for pickup.`,
  }),
  driverAssigned: (orderNumber: string, driverName: string) => ({
    type: "DELIVERY" as const,
    title: "Driver assigned",
    body: `${driverName} will deliver order #${orderNumber}.`,
  }),
  outForDelivery: (orderNumber: string) => ({
    type: "DELIVERY" as const,
    title: "Out for delivery",
    body: `Order #${orderNumber} is on the way!`,
  }),
  delivered: (orderNumber: string) => ({
    type: "DELIVERY" as const,
    title: "Delivered!",
    body: `Order #${orderNumber} has been delivered. Enjoy!`,
  }),
  pointsEarned: (points: number) => ({
    type: "POINTS" as const,
    title: "Points earned!",
    body: `You earned ${points} points from your order.`,
  }),
  newOrderAdmin: (orderNumber: string) => ({
    type: "ORDER" as const,
    title: "New order",
    body: `Order #${orderNumber} just came in.`,
  }),
  newDeliveryDriver: (orderNumber: string) => ({
    type: "DELIVERY" as const,
    title: "New delivery",
    body: `You have a new delivery assignment: #${orderNumber}.`,
  }),
  lowInventory: (itemName: string) => ({
    type: "INVENTORY" as const,
    title: "Low stock alert",
    body: `${itemName} is running low. Restock soon.`,
  }),
};

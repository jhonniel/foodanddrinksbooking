import "server-only";

import { NotificationTemplates } from "@/services/notificationService";
import type { Order, OrderStatus } from "@/types";
import {
  createNotificationInSupabase,
  notifyStaffInSupabase,
} from "@/lib/supabase/notifications";

function statusTemplate(orderNumber: string, status: OrderStatus) {
  const templates: Partial<
    Record<
      OrderStatus,
      { type: "ORDER" | "DELIVERY"; title: string; body: string }
    >
  > = {
    CONFIRMED: NotificationTemplates.orderConfirmed(orderNumber),
    PREPARING: NotificationTemplates.orderPreparing(orderNumber),
    READY: NotificationTemplates.orderReady(orderNumber),
    OUT_FOR_DELIVERY: NotificationTemplates.outForDelivery(orderNumber),
    DELIVERED: NotificationTemplates.delivered(orderNumber),
  };

  return templates[status] ?? null;
}

export async function notifyOrderPlacedInSupabase(order: Order): Promise<void> {
  await createNotificationInSupabase({
    userId: order.customer_id,
    type: "ORDER",
    title: "Order placed!",
    body: `Your order ${order.order_number} has been received.`,
    data: { orderId: order.id },
  });

  await notifyStaffInSupabase({
    ...NotificationTemplates.newOrderAdmin(order.order_number),
    data: { orderId: order.id },
  });
}

export async function notifyOrderStatusInSupabase(
  order: Order,
  status: OrderStatus
): Promise<void> {
  const template = statusTemplate(order.order_number, status);
  if (template) {
    await createNotificationInSupabase({
      userId: order.customer_id,
      type: template.type,
      title: template.title,
      body: template.body,
      data: { orderId: order.id },
    });
  }

  if (status === "DELIVERED" && order.points_earned > 0) {
    await createNotificationInSupabase({
      userId: order.customer_id,
      ...NotificationTemplates.pointsEarned(order.points_earned),
      data: { orderId: order.id },
    });
  }
}

export async function notifyOrderAutoCancelledInSupabase(
  order: Order
): Promise<void> {
  await createNotificationInSupabase({
    userId: order.customer_id,
    ...NotificationTemplates.orderAutoCancelled(order.order_number),
    data: { orderId: order.id },
  });

  await notifyStaffInSupabase({
    type: "ORDER",
    title: "Order auto-cancelled",
    body: `Order #${order.order_number} was cancelled after 1 hour without acceptance.`,
    data: { orderId: order.id },
  });
}

export async function notifyDriverAssignedInSupabase(input: {
  order: Order;
  driverName: string;
  driverProfileId: string | null;
}): Promise<void> {
  const { order, driverName, driverProfileId } = input;

  await createNotificationInSupabase({
    userId: order.customer_id,
    ...NotificationTemplates.driverAssigned(order.order_number, driverName),
    data: { orderId: order.id },
  });

  if (driverProfileId) {
    await createNotificationInSupabase({
      userId: driverProfileId,
      ...NotificationTemplates.newDeliveryDriver(order.order_number),
      data: { orderId: order.id },
    });
  }
}

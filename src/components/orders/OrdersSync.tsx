"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import {
  createNotification,
  NotificationTemplates,
} from "@/services/notificationService";
import { AUTO_CANCEL_REASON } from "@/lib/constants";
import { canAccessAdmin } from "@/lib/auth/config";
import type { DeliveryOrder, Order } from "@/types";

/**
 * Keeps the client order board in sync with the shared server store
 * so admin can process orders placed from any browser/session.
 * Also surfaces auto-cancel notices when a PENDING order times out.
 */
export function OrdersSync() {
  const user = useAuthStore((s) => s.user);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const addNotification = useAppStore((s) => s.addNotification);
  const notifiedAutoCancel = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          orders?: Order[];
          deliveries?: DeliveryOrder[];
          autoCancelled?: Order[];
        };
        if (cancelled) return;
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.deliveries)) setDeliveries(data.deliveries);

        const newlyCancelled = (data.autoCancelled ?? []).filter(
          (o) =>
            o.cancelled_reason === AUTO_CANCEL_REASON &&
            !notifiedAutoCancel.current.has(o.id)
        );

        for (const order of newlyCancelled) {
          notifiedAutoCancel.current.add(order.id);
          const template = NotificationTemplates.orderAutoCancelled(
            order.order_number
          );

          if (order.customer_id === user.id) {
            addNotification(
              createNotification({
                userId: user.id,
                ...template,
                data: { orderId: order.id },
              })
            );
            toast.error(template.body);
          } else if (canAccessAdmin(user.role)) {
            addNotification(
              createNotification({
                userId: "staff",
                type: "ORDER",
                title: "Order auto-cancelled",
                body: `Order #${order.order_number} was cancelled after 1 hour without acceptance.`,
                data: { orderId: order.id },
              })
            );
          }
        }
      } catch {
        /* ignore transient network errors */
      }
    };

    void pull();
    const id = window.setInterval(pull, 4000);
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, setOrders, setDeliveries, addNotification]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import {
  clearLegacyOrderLocalStorage,
  useAppStore,
} from "@/stores/app";
import { useDataStore } from "@/stores/data";
import {
  createNotification,
  NotificationTemplates,
} from "@/services/notificationService";
import { AUTO_CANCEL_REASON } from "@/lib/constants";
import { canAccessAdmin } from "@/lib/auth/config";
import type { DeliveryOrder, Driver, Order } from "@/types";

/**
 * Syncs in-memory order state from Supabase.
 * Drivers use /api/drivers/me/deliveries (assignments only).
 * Staff/customers use /api/orders.
 */
export function OrdersSync() {
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const addNotification = useAppStore((s) => s.addNotification);
  const setDrivers = useDataStore((s) => s.setDrivers);
  const notifiedAutoCancel = useRef(new Set<string>());

  useEffect(() => {
    clearLegacyOrderLocalStorage();
  }, []);

  useEffect(() => {
    if (authInitializing || !user) return;
    // Driver assignments are synced by DriverDeliveriesSync in /driver layout.
    if (user.role === "DRIVER") return;

    let cancelled = false;
    const isStaff = canAccessAdmin(user.role);

    const pull = async () => {
      try {
        const res = await fetch("/api/orders", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          orders?: Order[];
          deliveries?: DeliveryOrder[];
          autoCancelled?: Order[];
          driver?: Driver | null;
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
          } else if (isStaff) {
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
    const id = window.setInterval(pull, 3000);
    const onFocus = () => void pull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    user,
    authInitializing,
    setOrders,
    setDeliveries,
    addNotification,
    setDrivers,
  ]);

  return null;
}

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
 * Keeps the client order board in sync with the shared server store.
 * Waits for localStorage rehydrate + auth so refresh does not wipe orders.
 */
export function OrdersSync() {
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const mergeOrders = useAppStore((s) => s.mergeOrders);
  const mergeDeliveries = useAppStore((s) => s.mergeDeliveries);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const addNotification = useAppStore((s) => s.addNotification);
  const notifiedAutoCancel = useRef(new Set<string>());

  useEffect(() => {
    // Only mark hydrated if persist never calls back (e.g. empty/blocked storage).
    // Keep this delay long enough that a normal rehydrate can finish first.
    if (!hasHydrated) {
      const t = window.setTimeout(() => {
        if (!useAppStore.getState().hasHydrated) {
          useAppStore.getState().setHasHydrated(true);
        }
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [hasHydrated]);

  useEffect(() => {
    // Critical: never pull before persist rehydrate finishes, or an empty
    // localStorage snapshot can overwrite a successful server fetch.
    if (!hasHydrated || authInitializing || !user) return;

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
        };
        if (cancelled) return;

        if (Array.isArray(data.orders)) {
          if (isStaff) {
            // Staff board: shared server list is source of truth.
            setOrders(data.orders);
          } else {
            // Customer: merge server rows in; never wipe local-only orders
            // when Supabase returns [] (common before service role / failed insert).
            mergeOrders(data.orders);
          }
        }
        if (Array.isArray(data.deliveries)) {
          if (isStaff) setDeliveries(data.deliveries);
          else mergeDeliveries(data.deliveries);
        }

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
    hasHydrated,
    setOrders,
    setDeliveries,
    mergeOrders,
    mergeDeliveries,
    addNotification,
  ]);

  return null;
}

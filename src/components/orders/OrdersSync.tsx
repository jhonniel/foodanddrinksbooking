"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import type { DeliveryOrder, Order } from "@/types";

/**
 * Keeps the client order board in sync with the shared server store
 * so admin can process orders placed from any browser/session.
 */
export function OrdersSync() {
  const user = useAuthStore((s) => s.user);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);

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
        };
        if (cancelled) return;
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.deliveries)) setDeliveries(data.deliveries);
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
  }, [user, setOrders, setDeliveries]);

  return null;
}

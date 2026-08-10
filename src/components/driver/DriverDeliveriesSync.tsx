"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";
import type { DeliveryOrder, Driver, Order } from "@/types";

/**
 * Driver-only sync: loads /api/drivers/me/deliveries into the app store.
 * Depends on user.id (not the whole user object) to avoid canceling in-flight fetches.
 */
export function DriverDeliveriesSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const userRole = useAuthStore((s) => s.user?.role);
  const userEmail = useAuthStore((s) => s.user?.email);
  const initializing = useAuthStore((s) => s.initializing);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const setDrivers = useDataStore((s) => s.setDrivers);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const pull = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/me/deliveries", {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as {
        orders?: Order[];
        deliveries?: DeliveryOrder[];
        driver?: Driver | null;
        error?: string;
      } | null;

      if (!res.ok) {
        setLastError(data?.error || `Could not load deliveries (${res.status})`);
        return;
      }

      setLastError(null);
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      const deliveries = Array.isArray(data?.deliveries) ? data.deliveries : [];
      setOrders(orders);
      setDeliveries(deliveries);
      setLastCount(deliveries.length);

      if (data?.driver) {
        const others = useDataStore
          .getState()
          .drivers.filter(
            (d) =>
              d.id !== data.driver!.id &&
              d.profile_id !== data.driver!.profile_id
          );
        setDrivers([data.driver, ...others]);
      }
    } catch {
      setLastError("Network error loading deliveries.");
    }
  }, [setOrders, setDeliveries, setDrivers]);

  useEffect(() => {
    if (initializing || !userId || userRole !== "DRIVER") return;

    void pull();
    const id = window.setInterval(() => void pull(), 2500);
    const onFocus = () => void pull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, userRole, initializing, pull]);

  if (!lastError && lastCount !== 0) return null;

  if (lastError) {
    return (
      <div className="mx-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mx-4">
        {lastError}{" "}
        <button type="button" className="underline" onClick={() => void pull()}>
          Retry
        </button>
      </div>
    );
  }

  // Helpful hint when API returned zero assignments for this login
  if (lastCount === 0 && userEmail) {
    return (
      <div className="mx-3 mt-2 rounded-lg border border-sky/30 bg-sky/5 px-3 py-2 text-xs text-navy/80 sm:mx-4">
        Signed in as <strong>{userEmail}</strong>. No deliveries are assigned to
        this account. In Admin → Assign, pick this same email.
      </div>
    );
  }

  return null;
}

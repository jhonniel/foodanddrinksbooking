"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Package, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/motion";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { greeting, formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  refreshDriverLocation,
  resolveDriverOnline,
  setDriverOnlineStatus,
} from "@/services/driverPresence";
import type { DeliveryOrder, Driver, Order } from "@/types";

export default function DriverHomePage() {
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const driverOnlineFlag = useAppStore((s) => s.driverOnline);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const drivers = useDataStore((s) => s.drivers);
  const setDrivers = useDataStore((s) => s.setDrivers);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orders, setLocalOrders] = useState<Order[]>([]);
  const [deliveries, setLocalDeliveries] = useState<DeliveryOrder[]>([]);

  const driverRecord =
    drivers.find((d) => d.profile_id === user?.id || d.id === user?.id) ??
    null;
  const driverOnline = resolveDriverOnline(driverRecord, driverOnlineFlag);
  const driverName = user?.full_name?.split(" ")[0] ?? "Driver";

  const loadAssignments = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
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
        setLoadError(data?.error || `Failed to load (${res.status})`);
        return;
      }

      const nextOrders = Array.isArray(data?.orders) ? data.orders : [];
      const nextDeliveries = Array.isArray(data?.deliveries)
        ? data.deliveries
        : [];

      setLoadError(null);
      setLocalOrders(nextOrders);
      setLocalDeliveries(nextDeliveries);
      // Keep shared store in sync for other driver pages
      setOrders(nextOrders);
      setDeliveries(nextDeliveries);

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
      setLoadError("Network error. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, setOrders, setDeliveries, setDrivers]);

  useEffect(() => {
    void loadAssignments();
    const id = window.setInterval(() => void loadAssignments(), 3000);
    return () => window.clearInterval(id);
  }, [loadAssignments]);

  const activeDeliveries = deliveries.filter(
    (d) => !["DELIVERED", "CANCELLED"].includes(d.status)
  );
  const completedToday = deliveries.filter((d) => {
    if (d.status !== "DELIVERED") return false;
    const completedAt = new Date(d.delivered_at ?? d.updated_at);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return completedAt.getTime() >= start.getTime();
  }).length;

  const pendingCount = activeDeliveries.length;
  const activeDelivery = activeDeliveries[0];
  const activeOrder =
    activeDelivery?.order ??
    (activeDelivery
      ? orders.find((o) => o.id === activeDelivery.order_id)
      : null);

  useEffect(() => {
    if (!driverOnline || !user?.id) return;
    void refreshDriverLocation(user.id);
    const timer = window.setInterval(() => {
      void refreshDriverLocation(user.id);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [driverOnline, user?.id]);

  const handleToggleOnline = async () => {
    if (!user?.id) return;
    setToggling(true);
    try {
      const next = !driverOnline;
      await setDriverOnlineStatus(user.id, next);
      toast.success(next ? "You're online" : "You're offline");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not update online status. Try signing out and back in."
      );
    } finally {
      setToggling(false);
    }
  };

  return (
    <PageTransition className="p-4">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-navy">
              {greeting()}, {driverName}!
            </h1>
            <p className="text-sm text-muted-foreground">
              {driverOnline
                ? "You're online and ready for deliveries"
                : "Go online to receive deliveries"}
            </p>
            {user?.email && (
              <p className="mt-1 text-xs text-muted-foreground/80">
                {user.email}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            disabled={loading}
            onClick={() => void loadAssignments()}
            aria-label="Refresh assignments"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <motion.div
          whileHover={reduce ? undefined : { y: -2 }}
          className="rounded-2xl bg-white p-4 shadow-card"
        >
          <p className="text-xs text-muted-foreground">Completed Today</p>
          <p className="text-2xl font-bold text-green">
            <AnimatedNumber value={completedToday} />
          </p>
        </motion.div>
        <motion.div
          whileHover={reduce ? undefined : { y: -2 }}
          className="rounded-2xl bg-white p-4 shadow-card"
        >
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-navy">
            <AnimatedNumber value={pendingCount} />
          </p>
        </motion.div>
      </div>

      <motion.div whileTap={{ scale: 0.98 }} className="mb-6 rounded-xl">
        <Button
          size="lg"
          className={cn(
            "h-14 w-full text-base font-semibold",
            driverOnline
              ? "bg-navy hover:bg-navy/90"
              : "bg-green hover:bg-green/90"
          )}
          disabled={toggling}
          onClick={() => void handleToggleOnline()}
        >
          <Power className="mr-2 h-5 w-5" />
          {driverOnline ? "Go Offline" : "Go Online"}
        </Button>
      </motion.div>

      <h2 className="mb-3 text-lg font-semibold text-navy">Active Delivery</h2>
      {loadError ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-card">
          <p className="text-sm text-amber-800">{loadError}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void loadAssignments()}
          >
            Retry
          </Button>
        </div>
      ) : !activeDelivery ? (
        <EmptyState
          icon={Package}
          title="No active delivery"
          description={
            user?.email
              ? `No orders assigned to ${user.email}. In Admin, assign using this exact email.`
              : "New assignments will appear here after admin assigns you."
          }
          className="rounded-2xl bg-white py-12 shadow-card"
        />
      ) : (
        <Link href={`/driver/deliveries/${activeDelivery.id}`}>
          <motion.div
            whileHover={reduce ? undefined : { y: -3 }}
            className="rounded-2xl bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-navy">
                  #{activeOrder?.order_number ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeOrder?.customer?.full_name ?? "Customer"}
                </p>
              </div>
              <StatusBadge status={activeDelivery.status} />
            </div>
            {activeOrder?.delivery_address_snapshot && (
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
                {activeOrder.delivery_address_snapshot.full_address}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-green">
                {activeOrder ? formatCurrency(activeOrder.total) : "—"}
              </span>
              <span className="text-sm font-semibold text-sky">
                View Details →
              </span>
            </div>
          </motion.div>
        </Link>
      )}
    </PageTransition>
  );
}

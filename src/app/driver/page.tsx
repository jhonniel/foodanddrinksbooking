"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Package, Power } from "lucide-react";
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

export default function DriverHomePage() {
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const deliveries = useAppStore((s) => s.deliveries);
  const driverOnlineFlag = useAppStore((s) => s.driverOnline);
  const orders = useAppStore((s) => s.orders);
  const drivers = useDataStore((s) => s.drivers);
  const [toggling, setToggling] = useState(false);

  const driverRecord =
    drivers.find((d) => d.profile_id === user?.id || d.id === user?.id) ??
    null;
  const driverOnline = resolveDriverOnline(driverRecord, driverOnlineFlag);

  const driverIds = new Set(
    [user?.id, driverRecord?.id, driverRecord?.profile_id].filter(
      (id): id is string => typeof id === "string" && id.length > 0
    )
  );

  const driverName = user?.full_name?.split(" ")[0] ?? "Driver";
  const matchesDriver = (id?: string | null) =>
    !!id && driverIds.has(id);

  const activeDeliveries = deliveries.filter(
    (d) =>
      !["DELIVERED", "CANCELLED"].includes(d.status) &&
      (matchesDriver(d.driver_id) ||
        matchesDriver(d.driver?.id) ||
        matchesDriver(d.driver?.profile_id))
  );
  const completedToday = deliveries.filter(
    (d) =>
      d.status === "DELIVERED" &&
      (matchesDriver(d.driver_id) || matchesDriver(d.driver?.id))
  ).length;
  const pendingCount = activeDeliveries.length;

  const activeDelivery = activeDeliveries[0];

  const activeOrder = activeDelivery
    ? orders.find((o) => o.id === activeDelivery.order_id)
    : null;

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
        <h1 className="text-2xl font-bold text-navy">
          {greeting()}, {driverName}!
        </h1>
        <p className="text-sm text-muted-foreground">
          {driverOnline
            ? "You're online and ready for deliveries"
            : "Go online to receive deliveries"}
        </p>
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

      <motion.div
        whileTap={{ scale: 0.98 }}
        animate={
          !driverOnline && !reduce
            ? {
                boxShadow: [
                  "0 0 0 0 rgba(23,107,58,0.35)",
                  "0 0 0 12px rgba(23,107,58,0)",
                  "0 0 0 0 rgba(23,107,58,0)",
                ],
              }
            : undefined
        }
        transition={
          !driverOnline
            ? { duration: 2, repeat: Infinity, ease: "easeOut" }
            : undefined
        }
        className="mb-6 rounded-xl"
      >
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
      {!activeDelivery || !activeOrder ? (
        <EmptyState
          icon={Package}
          title="No active delivery"
          description="New assignments will appear here when you're online."
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
                  #{activeOrder.order_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeOrder.customer?.full_name}
                </p>
              </div>
              <StatusBadge status={activeDelivery.status} />
            </div>
            {activeOrder.delivery_address_snapshot && (
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
                {activeOrder.delivery_address_snapshot.full_address}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-green">
                {formatCurrency(activeOrder.total)}
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

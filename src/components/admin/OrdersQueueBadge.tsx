"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/app";
import {
  countActiveQueueOrders,
  countPendingOrders,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type OrdersQueueBadgeProps = {
  variant?: "sidebar" | "mobile";
  className?: string;
};

export function useOrdersQueueCounts() {
  const orders = useAppStore((s) => s.orders);
  return useMemo(
    () => ({
      queueCount: countActiveQueueOrders(orders),
      pendingCount: countPendingOrders(orders),
    }),
    [orders]
  );
}

export function OrdersQueueBadge({
  variant = "sidebar",
  className,
}: OrdersQueueBadgeProps) {
  const { queueCount, pendingCount } = useOrdersQueueCounts();

  if (queueCount <= 0) return null;

  const label =
    pendingCount > 0
      ? `${queueCount} in queue, ${pendingCount} new`
      : `${queueCount} in queue`;

  if (variant === "mobile") {
    return (
      <span
        className={cn(
          "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white",
          className
        )}
        aria-label={label}
      >
        {queueCount > 99 ? "99+" : queueCount}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        pendingCount > 0
          ? "bg-amber-400 text-navy"
          : "bg-white/20 text-white",
        className
      )}
      aria-label={label}
    >
      {queueCount > 99 ? "99+" : queueCount}
    </span>
  );
}

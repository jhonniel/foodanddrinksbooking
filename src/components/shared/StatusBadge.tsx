"use client";

import { cn } from "@/lib/utils";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus, PaymentStatus } from "@/types";
import { motion, useReducedMotion } from "framer-motion";

const variants = {
  default: "bg-slate-100 text-navy",
  success: "bg-green/10 text-green",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  info: "bg-sky/10 text-sky",
  pending: "bg-orange-50 text-orange-600",
};

interface StatusBadgeProps {
  status: OrderStatus | PaymentStatus | string;
  className?: string;
  label?: string;
}

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const reduce = useReducedMotion();
  const orderColor = ORDER_STATUS_COLORS[status as OrderStatus];
  const paymentColors: Record<string, keyof typeof variants> = {
    PAID: "success",
    PENDING: "pending",
    FAILED: "danger",
    REFUNDED: "warning",
    CANCELLED: "danger",
  };

  const variant =
    orderColor || paymentColors[status] || ("default" as keyof typeof variants);

  const display =
    label ||
    ORDER_STATUS_LABELS[status as OrderStatus] ||
    status.replace(/_/g, " ");

  const isLive =
    status === "PENDING" ||
    status === "PREPARING" ||
    status === "OUT_FOR_DELIVERY" ||
    status === "IN_TRANSIT";

  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        variants[variant],
        className
      )}
    >
      {isLive && !reduce && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {display}
    </motion.span>
  );
}

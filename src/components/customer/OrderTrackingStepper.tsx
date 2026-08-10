"use client";

import { Check, Circle, MapPinned, Package, Bike, Store } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";
import {
  getTrackingProgress,
  getTrackingSteps,
  stepTimestamp,
  trackingHeadline,
} from "@/lib/orderTracking";
import type { Order, OrderType } from "@/types";

function StepIcon({
  index,
  orderType,
}: {
  index: number;
  orderType: OrderType;
}) {
  if (index === 0) return <Package className="h-3.5 w-3.5" />;
  if (orderType === "PICKUP" && index === 3) return <Store className="h-3.5 w-3.5" />;
  if (orderType === "DELIVERY" && index === 4) return <Bike className="h-3.5 w-3.5" />;
  if (index === getTrackingSteps(orderType).length - 1) {
    return <MapPinned className="h-3.5 w-3.5" />;
  }
  return <Circle className="h-3 w-3" />;
}

export function OrderTrackingStepper({
  order,
  compact = false,
}: {
  order: Order;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const steps = getTrackingSteps(order.order_type);
  const { currentIdx, percent, current } = getTrackingProgress(
    order.status,
    order.order_type
  );
  const isLive = order.status !== "DELIVERED" && order.status !== "CANCELLED";

  if (order.status === "CANCELLED") {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">
        This order was cancelled
      </div>
    );
  }

  if (compact) {
    return (
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-navy">
            {current?.label ?? "Tracking"}
            {isLive && (
              <span className="tracking-now-badge ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green align-middle" />
            )}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Step {Math.max(currentIdx + 1, 1)} of {steps.length}
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn(
              "h-full rounded-full bg-green",
              isLive && !reduce && "tracking-progress-live"
            )}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-2xl bg-white p-4 shadow-card sm:p-5"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky">
            Live tracking
            {isLive && (
              <motion.span
                className="inline-flex h-1.5 w-1.5 rounded-full bg-green"
                animate={
                  reduce
                    ? undefined
                    : { scale: [1, 1.35, 1], opacity: [1, 0.45, 1] }
                }
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </p>
          <h2 className="mt-1 text-lg font-bold text-navy">
            {trackingHeadline(order.status, order.order_type)}
          </h2>
          {current && (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.status === "ARRIVED"
                ? "Your rider is at the delivery location."
                : current.description}
            </p>
          )}
        </div>
        <motion.div
          className="rounded-xl bg-green/10 px-3 py-2 text-center"
          key={percent}
          initial={reduce ? false : { scale: 0.92, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <p className="text-lg font-bold text-green">{percent}%</p>
          <p className="text-[10px] text-muted-foreground">complete</p>
        </motion.div>
      </div>

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn(
            "h-full rounded-full bg-green",
            isLive && !reduce && "tracking-progress-live"
          )}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="space-y-0">
        {steps.map((step, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx && isLive;
          const completed = idx < currentIdx || order.status === "DELIVERED";
          const stamp = stepTimestamp(order, step.key);

          return (
            <motion.div
              key={step.key}
              className="flex gap-3"
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: reduce ? 0 : idx * 0.05,
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    done
                      ? "border-green bg-green text-white"
                      : "border-border bg-white text-muted-foreground",
                    active && "tracking-active-ring tracking-active-dot ring-4 ring-green/20"
                  )}
                >
                  {completed && idx < currentIdx ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <motion.span
                      animate={
                        reduce
                          ? undefined
                          : { rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }
                      }
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="flex items-center justify-center"
                    >
                      <StepIcon index={idx} orderType={order.order_type} />
                    </motion.span>
                  ) : (
                    <StepIcon index={idx} orderType={order.order_type} />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className="relative my-1 w-0.5 min-h-[28px] flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="absolute inset-x-0 top-0 w-full origin-top rounded-full bg-green"
                      initial={false}
                      animate={{
                        height: idx < currentIdx ? "100%" : "0%",
                      }}
                      transition={{
                        duration: 0.55,
                        delay: reduce ? 0 : 0.15,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "min-w-0 flex-1 pb-5",
                  idx === steps.length - 1 && "pb-0"
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm",
                      active
                        ? "font-bold text-navy"
                        : done
                          ? "font-semibold text-navy"
                          : "font-medium text-muted-foreground"
                    )}
                  >
                    {step.label}
                    {active && (
                      <span className="tracking-now-badge ml-2 rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky">
                        Now
                      </span>
                    )}
                  </p>
                  {stamp && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(stamp)}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    active ? "text-navy/70" : "text-muted-foreground"
                  )}
                >
                  {step.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

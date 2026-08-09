"use client";

import { Check, Circle, MapPinned, Package, Bike, Store } from "lucide-react";
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
  const steps = getTrackingSteps(order.order_type);
  const { currentIdx, percent, current } = getTrackingProgress(
    order.status,
    order.order_type
  );

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
          </p>
          <p className="text-[10px] text-muted-foreground">
            Step {Math.max(currentIdx + 1, 1)} of {steps.length}
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky">
            Live tracking
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
        <div className="rounded-xl bg-green/10 px-3 py-2 text-center">
          <p className="text-lg font-bold text-green">{percent}%</p>
          <p className="text-[10px] text-muted-foreground">complete</p>
        </div>
      </div>

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-green transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="space-y-0">
        {steps.map((step, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          const stamp = stepTimestamp(order, step.key);

          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    done
                      ? "border-green bg-green text-white"
                      : "border-border bg-white text-muted-foreground",
                    active && "ring-4 ring-green/20"
                  )}
                >
                  {done && idx < currentIdx ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon index={idx} orderType={order.order_type} />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "my-1 w-0.5 min-h-[28px] flex-1",
                      idx < currentIdx ? "bg-green" : "bg-muted"
                    )}
                  />
                )}
              </div>
              <div className={cn("min-w-0 flex-1 pb-5", idx === steps.length - 1 && "pb-0")}>
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
                    {active && order.status !== "DELIVERED" && (
                      <span className="ml-2 rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Clock, Package, PackageCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AssignDriverControls, canAssignOrReassignOrderStatus } from "@/components/admin/AssignDriverControls";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { ORDERS_QUEUE_COLUMNS, STATUS_ACTIONS, staffCanCancelOrder } from "@/lib/constants";
import { canAccessAdmin, canAssignDrivers } from "@/lib/auth/config";
import {
  formatCurrency,
  formatDateTime,
  formatPoints,
  relativeTime,
} from "@/lib/utils/format";
import { Stagger, StaggerItem } from "@/components/motion";
import type { DeliveryOrder, Order } from "@/types";
import { cn } from "@/lib/utils";
import { calculateOrderPointsEarned } from "@/services/loyaltyService";

export default function AdminOrdersPage() {
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const updateOrderStatus = useAppStore((s) => s.updateOrderStatus);
  const updateDeliveryStatus = useAppStore((s) => s.updateDeliveryStatus);
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const role = user?.role;
  const [selected, setSelected] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pickupBusyId, setPickupBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const deliveryForOrder = (orderId: string) =>
    deliveries.find((d) => d.order_id === orderId);

  const handleMarkPickedUp = async (order: Order, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const delivery = deliveryForOrder(order.id);
    if (!delivery) {
      toast.error("No delivery record for this order.");
      return;
    }
    if (delivery.status !== "ACCEPTED") {
      toast.error(
        delivery.status === "ASSIGNED"
          ? "Wait until the driver accepts the delivery."
          : "This delivery is not ready for pickup confirmation."
      );
      return;
    }
    setPickupBusyId(delivery.id);
    try {
      await updateDeliveryStatus(delivery.id, "PICKED_UP");
      toast.success(`Order #${order.order_number} marked as picked up`);
      setSelected(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not mark as picked up."
      );
    } finally {
      setPickupBusyId(null);
    }
  };

  const refreshOrders = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const res = await fetch("/api/orders", {
        cache: "no-store",
        credentials: "include",
      });

      const payload = (await res.json().catch(() => null)) as {
        orders?: Order[];
        deliveries?: DeliveryOrder[];
        error?: string;
      } | null;

      if (res.status === 401) {
        // Don't flash this on background polls — cookie can race with HMR.
        if (!opts?.silent) {
          setLoadError("Session expired. Please sign in again.");
        }
        return;
      }

      if (!res.ok) {
        if (!opts?.silent) {
          setLoadError(payload?.error || `Could not load orders (${res.status}).`);
        }
        return;
      }

      if (!Array.isArray(payload?.orders)) {
        if (!opts?.silent) {
          setLoadError("Could not load orders from server.");
        }
        return;
      }

      setOrders(payload.orders);
      if (Array.isArray(payload.deliveries)) setDeliveries(payload.deliveries);
      setLoadError(null);
    } catch {
      // Background poll failures (dev reload / brief offline) should not
      // replace an already-working board with a scary error banner.
      if (!opts?.silent) {
        setLoadError("Could not load orders from server.");
      }
    } finally {
      if (!opts?.silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authInitializing || !user || !canAccessAdmin(user.role)) {
      return;
    }

    void refreshOrders();
    const id = window.setInterval(() => void refreshOrders({ silent: true }), 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInitializing, user?.id, user?.role]);

  const handleAdvance = (order: Order) => {
    const action = STATUS_ACTIONS[order.status];
    // Pickup: from Ready, staff can complete without a rider
    if (
      !action &&
      !(order.order_type === "PICKUP" && order.status === "READY")
    ) {
      return;
    }
    if (order.status === "READY" && order.order_type !== "PICKUP") return;
    const next =
      order.order_type === "PICKUP" && order.status === "READY"
        ? ("DELIVERED" as const)
        : action!.next;
    updateOrderStatus(order.id, next);
    toast.success(`Order #${order.order_number} → ${next}`);
  };

  const handleCancelOrder = (order: Order) => {
    if (!staffCanCancelOrder(order.status)) {
      toast.error("This order can no longer be cancelled.");
      return;
    }
    if (
      !window.confirm(
        `Cancel order #${order.order_number}? The customer will no longer be able to track it as active.`
      )
    ) {
      return;
    }
    updateOrderStatus(order.id, "CANCELLED");
    toast.success(`Order #${order.order_number} cancelled`);
    setSelected(null);
  };

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const queueOrders = orders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
  );
  const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");
  const visibleOrders = normalizedQuery
    ? queueOrders.filter((o) => {
        const hay = [
          o.order_number,
          o.customer?.full_name,
          o.customer?.email,
          o.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(normalizedQuery);
      })
    : queueOrders;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4rem)] flex-col lg:h-dvh">
      <div className="border-b bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-navy sm:text-2xl">
              Orders Queue
            </h1>
            <p className="text-sm text-muted-foreground">
              {queueOrders.length} in queue · {pendingCount} new · swipe right
              for later columns
            </p>
            {loadError && (
              <p className="mt-1 text-sm text-red-600">
                {loadError}{" "}
                {loadError.includes("Session") && (
                  <a href="/login?next=/admin/orders" className="underline">
                    Sign in again
                  </a>
                )}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => void refreshOrders()}
            disabled={refreshing || authInitializing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order #, customer…"
          className="mt-3 w-full max-w-md rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none ring-sky/30 focus:ring-2"
        />
        {normalizedQuery && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Showing {visibleOrders.length} match
            {visibleOrders.length === 1 ? "" : "es"} for “{query.trim()}”
          </p>
        )}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4 lg:p-6 hide-scrollbar">
        <div className="flex h-full min-w-max gap-3 snap-x snap-mandatory sm:gap-4">
          {ORDERS_QUEUE_COLUMNS.map(({ status, label }) => {
            const columnOrders = visibleOrders
              .filter((o) => o.status === status)
              .sort((a, b) =>
                b.order_number.localeCompare(a.order_number, undefined, {
                  numeric: true,
                })
              );
            return (
              <div
                key={status}
                className="flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-2xl bg-white shadow-card sm:w-72"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="text-sm font-semibold text-navy">{label}</h2>
                  <span className="rounded-full bg-light-blue px-2 py-0.5 text-xs font-medium text-sky">
                    {columnOrders.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {columnOrders.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No orders
                    </p>
                  ) : (
                    <Stagger className="space-y-3" fast>
                      {columnOrders.map((order) => {
                      const action = STATUS_ACTIONS[order.status];
                      const showAssign = canAssignOrReassignOrderStatus(
                        order.status
                      );
                      const delivery = deliveryForOrder(order.id);
                      const driverAccepted = delivery?.status === "ACCEPTED";
                      const awaitingDriver =
                        order.status === "ASSIGNED" &&
                        delivery?.status === "ASSIGNED";
                      return (
                        <StaggerItem key={order.id}>
                        <div
                          className="cursor-pointer rounded-xl border border-border/60 bg-surface p-3 transition hover:border-sky/30 hover:shadow-sm"
                          onClick={() => setSelected(order)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-navy">
                              #{order.order_number}
                            </p>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.customer?.full_name ?? "Guest"}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {order.items?.length ?? 0} items
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {order.scheduled_at
                                ? `Scheduled ${formatDateTime(order.scheduled_at)}`
                                : relativeTime(order.created_at)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-green">
                            {formatCurrency(order.total)}
                          </p>
                          {driverAccepted && canAccessAdmin(role) ? (
                            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-medium text-amber-800">
                                Driver accepted — confirm handover
                              </p>
                              <Button
                                size="sm"
                                className="w-full bg-green hover:bg-green/90"
                                disabled={pickupBusyId === delivery.id}
                                onClick={(e) => void handleMarkPickedUp(order, e)}
                              >
                                <PackageCheck className="mr-1.5 h-4 w-4" />
                                {pickupBusyId === delivery.id
                                  ? "Saving…"
                                  : "Mark Picked Up"}
                              </Button>
                              {canAssignDrivers(role) && (
                                <AssignDriverControls
                                  orderId={order.id}
                                  compact
                                />
                              )}
                            </div>
                          ) : showAssign ? (
                            canAssignDrivers(role) ? (
                              <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                {awaitingDriver && (
                                  <p className="text-xs text-muted-foreground">
                                    Waiting for driver to accept
                                  </p>
                                )}
                                <AssignDriverControls
                                  orderId={order.id}
                                  compact
                                />
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Waiting for manager to assign a driver
                              </p>
                            )
                          ) : (
                            action && (
                              <Button
                                size="sm"
                                className={cn(
                                  "mt-3 w-full",
                                  "bg-green hover:bg-green/90"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdvance(order);
                                }}
                              >
                                {action.label}
                              </Button>
                            )
                          )}
                        </div>
                        </StaggerItem>
                      );
                    })}
                    </Stagger>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full bg-surface sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>Order #{selected.order_number}</SheetTitle>
                  <StatusBadge status={selected.status} />
                </div>
                <SheetDescription>
                  {formatDateTime(selected.created_at)} ·{" "}
                  {selected.order_type === "PICKUP" ? "Pickup" : "Delivery"}
                  {selected.scheduled_at &&
                    ` · Scheduled ${formatDateTime(selected.scheduled_at)}`}
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="rounded-2xl bg-white p-3.5 shadow-card">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer
                  </p>
                  <p className="mt-1 font-semibold text-navy">
                    {selected.customer?.full_name}
                  </p>
                  {selected.customer?.phone && (
                    <p className="text-sm text-muted-foreground">
                      {selected.customer.phone}
                    </p>
                  )}
                  {selected.customer && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-sky/10 px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-sky">
                          Balance
                        </p>
                        <p className="text-sm font-bold tabular-nums text-navy">
                          {formatPoints(selected.customer.points_balance ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-green/10 px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-green">
                          Lifetime
                        </p>
                        <p className="text-sm font-bold tabular-nums text-navy">
                          {formatPoints(selected.customer.lifetime_points ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {selected.delivery_address_snapshot && (
                  <div className="rounded-2xl bg-white p-3.5 shadow-card">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Delivery address
                    </p>
                    <p className="mt-1 text-sm text-navy">
                      {selected.delivery_address_snapshot.full_address}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl bg-white p-3.5 shadow-card">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Items
                  </p>
                  <ul className="space-y-2">
                    {(selected.items ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span className="text-navy">
                          <span className="font-medium text-muted-foreground">
                            {item.quantity}×
                          </span>{" "}
                          {item.product_name}
                        </span>
                        <span className="shrink-0 tabular-nums text-navy">
                          {formatCurrency(item.total_price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl bg-white p-3.5 shadow-card">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {formatCurrency(selected.subtotal)}
                    </span>
                  </div>
                  {selected.delivery_fee > 0 && (
                    <div className="mt-1.5 flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="tabular-nums">
                        {formatCurrency(selected.delivery_fee)}
                      </span>
                    </div>
                  )}
                  {(selected.discount > 0 || selected.points_discount > 0) && (
                    <div className="mt-1.5 flex justify-between text-sm text-green">
                      <span>Discounts</span>
                      <span className="tabular-nums">
                        −
                        {formatCurrency(
                          selected.discount + selected.points_discount
                        )}
                      </span>
                    </div>
                  )}
                  <div className="mt-2.5 flex justify-between border-t border-border/50 pt-2.5 font-bold text-navy">
                    <span>Total</span>
                    <span className="tabular-nums text-green">
                      {formatCurrency(selected.total)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex justify-between rounded-xl bg-sky/10 px-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">
                      Points to earn
                      <span className="block text-[11px]">
                        Items only · delivery excluded
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-sky">
                      +
                      {formatPoints(
                        calculateOrderPointsEarned({
                          subtotal: selected.subtotal,
                          discount: selected.discount,
                          pointsDiscount: selected.points_discount,
                        })
                      )}{" "}
                      pts
                    </span>
                  </div>
                </div>
              </SheetBody>

              <SheetFooter>
                {(() => {
                  const delivery = deliveryForOrder(selected.id);
                  const driverAccepted = delivery?.status === "ACCEPTED";
                  if (driverAccepted && canAccessAdmin(role) && delivery) {
                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-800">
                          Driver accepted. Hand over the order, then mark picked
                          up.
                        </p>
                        <Button
                          className="w-full bg-green hover:bg-green/90"
                          disabled={pickupBusyId === delivery.id}
                          onClick={() => void handleMarkPickedUp(selected)}
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />
                          {pickupBusyId === delivery.id
                            ? "Saving…"
                            : "Mark Picked Up"}
                        </Button>
                        {canAssignDrivers(role) && (
                          <AssignDriverControls
                            orderId={selected.id}
                            compact
                            onAssigned={() => setSelected(null)}
                          />
                        )}
                      </div>
                    );
                  }
                  if (
                    selected.order_type === "PICKUP" &&
                    selected.status === "READY"
                  ) {
                    return (
                      <Button
                        className="w-full bg-green hover:bg-green/90"
                        onClick={() => {
                          handleAdvance(selected);
                          setSelected(null);
                        }}
                      >
                        Mark Completed (Pickup)
                      </Button>
                    );
                  }
                  if (canAssignOrReassignOrderStatus(selected.status)) {
                    return canAssignDrivers(role) ? (
                      <div className="space-y-2">
                        {delivery?.status === "ASSIGNED" && (
                          <p className="text-sm text-muted-foreground">
                            Waiting for driver to accept
                          </p>
                        )}
                        <AssignDriverControls
                          orderId={selected.id}
                          compact
                          onAssigned={() => setSelected(null)}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Waiting for manager to assign a driver
                      </p>
                    );
                  }
                  if (STATUS_ACTIONS[selected.status]) {
                    return (
                      <Button
                        className="w-full bg-green hover:bg-green/90"
                        onClick={() => {
                          handleAdvance(selected);
                          setSelected(null);
                        }}
                      >
                        {STATUS_ACTIONS[selected.status]!.label}
                      </Button>
                    );
                  }
                  return null;
                })()}
                {staffCanCancelOrder(selected.status) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleCancelOrder(selected)}
                  >
                    Cancel order
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

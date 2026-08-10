"use client";

import { useEffect, useState } from "react";
import { Clock, Package, RefreshCw } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AssignDriverControls } from "@/components/admin/AssignDriverControls";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { KANBAN_COLUMNS, STATUS_ACTIONS } from "@/lib/constants";
import { canAssignDrivers } from "@/lib/auth/config";
import {
  formatCurrency,
  formatDateTime,
  relativeTime,
} from "@/lib/utils/format";
import type { DeliveryOrder, Order } from "@/types";
import { cn } from "@/lib/utils";

export default function AdminOrdersPage() {
  const orders = useAppStore((s) => s.orders);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const updateOrderStatus = useAppStore((s) => s.updateOrderStatus);
  const role = useAuthStore((s) => s.user?.role);
  const [selected, setSelected] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshOrders = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/orders", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        orders?: Order[];
        deliveries?: DeliveryOrder[];
      };
      if (Array.isArray(data.orders)) setOrders(data.orders);
      if (Array.isArray(data.deliveries)) setDeliveries(data.deliveries);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdvance = (order: Order) => {
    const action = STATUS_ACTIONS[order.status];
    if (!action || order.status === "READY") return;
    updateOrderStatus(order.id, action.next);
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4rem)] flex-col lg:h-dvh">
      <div className="border-b bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-navy sm:text-2xl">Orders</h1>
            <p className="text-sm text-muted-foreground">
              {orders.length} order{orders.length === 1 ? "" : "s"} · swipe
              columns to manage fulfillment
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => void refreshOrders()}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4 lg:p-6 hide-scrollbar">
        <div className="flex h-full min-w-max gap-3 snap-x snap-mandatory sm:gap-4">
          {KANBAN_COLUMNS.map(({ status, label }) => {
            const columnOrders = orders.filter((o) => o.status === status);
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
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {columnOrders.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No orders
                    </p>
                  ) : (
                    columnOrders.map((order) => {
                      const action = STATUS_ACTIONS[order.status];
                      const isReady = order.status === "READY";
                      return (
                        <div
                          key={order.id}
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
                              {relativeTime(order.created_at)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-green">
                            {formatCurrency(order.total)}
                          </p>
                          {isReady ? (
                            canAssignDrivers(role) ? (
                              <AssignDriverControls
                                orderId={order.id}
                                compact
                                className="mt-3"
                              />
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
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-navy">
                  Order #{selected.order_number}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={selected.status} />
                  <span className="text-sm text-muted-foreground">
                    {formatDateTime(selected.created_at)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-navy">Customer</p>
                  <p className="text-sm text-muted-foreground">
                    {selected.customer?.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.customer?.phone}
                  </p>
                </div>
                {selected.delivery_address_snapshot && (
                  <div>
                    <p className="text-sm font-medium text-navy">Delivery</p>
                    <p className="text-sm text-muted-foreground">
                      {selected.delivery_address_snapshot.full_address}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-sm font-medium text-navy">Items</p>
                  <ul className="space-y-2">
                    {(selected.items ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {item.quantity}× {item.product_name}
                        </span>
                        <span>{formatCurrency(item.total_price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-light-blue p-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selected.subtotal)}</span>
                  </div>
                  {selected.delivery_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Delivery</span>
                      <span>{formatCurrency(selected.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between font-bold text-navy">
                    <span>Total</span>
                    <span>{formatCurrency(selected.total)}</span>
                  </div>
                </div>
                {selected.status === "READY" ? (
                  canAssignDrivers(role) ? (
                    <AssignDriverControls
                      orderId={selected.id}
                      compact
                      onAssigned={() => setSelected(null)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Waiting for manager to assign a driver
                    </p>
                  )
                ) : (
                  STATUS_ACTIONS[selected.status] && (
                    <Button
                      className="w-full bg-green hover:bg-green/90"
                      onClick={() => {
                        handleAdvance(selected);
                        setSelected(null);
                      }}
                    >
                      {STATUS_ACTIONS[selected.status]!.label}
                    </Button>
                  )
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

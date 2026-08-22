"use client";

import { useEffect, useMemo, useState } from "react";
import { History, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { canAccessAdmin } from "@/lib/auth/config";
import { Stagger, StaggerItem, Reveal } from "@/components/motion";
import {
  formatCurrency,
  formatDateTime,
  relativeTime,
} from "@/lib/utils/format";
import type { DeliveryOrder, Order } from "@/types";
import { cn } from "@/lib/utils";

type HistoryFilter = "ALL" | "DELIVERED" | "CANCELLED";

export default function AdminOrderHistoryPage() {
  const orders = useAppStore((s) => s.orders);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const removeOrder = useAppStore((s) => s.removeOrder);
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        if (!opts?.silent) {
          setLoadError("Session expired. Please sign in again.");
        }
        return;
      }
      if (!res.ok) {
        if (!opts?.silent) {
          setLoadError(
            payload?.error || `Could not load orders (${res.status}).`
          );
        }
        return;
      }
      if (!Array.isArray(payload?.orders)) {
        if (!opts?.silent) setLoadError("Could not load orders from server.");
        return;
      }
      setOrders(payload.orders);
      if (Array.isArray(payload.deliveries)) setDeliveries(payload.deliveries);
      setLoadError(null);
    } catch {
      if (!opts?.silent) setLoadError("Could not load orders from server.");
    } finally {
      if (!opts?.silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authInitializing || !user || !canAccessAdmin(user.role)) return;
    void refreshOrders();
    const id = window.setInterval(
      () => void refreshOrders({ silent: true }),
      8000
    );
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInitializing, user?.id, user?.role]);

  const historyOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "DELIVERED" || o.status === "CANCELLED")
        .sort((a, b) => {
          const aTime = a.delivered_at || a.cancelled_at || a.updated_at;
          const bTime = b.delivered_at || b.cancelled_at || b.updated_at;
          return bTime.localeCompare(aTime);
        }),
    [orders]
  );

  const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");

  const filtered = useMemo(() => {
    let list = historyOrders;
    if (filter === "DELIVERED") {
      list = list.filter((o) => o.status === "DELIVERED");
    } else if (filter === "CANCELLED") {
      list = list.filter((o) => o.status === "CANCELLED");
    }
    if (!normalizedQuery) return list;
    return list.filter((o) => {
      const hay = [
        o.order_number,
        o.customer?.full_name,
        o.customer?.email,
        o.status,
        o.cancelled_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [historyOrders, filter, normalizedQuery]);

  const deliveredCount = historyOrders.filter(
    (o) => o.status === "DELIVERED"
  ).length;
  const cancelledCount = historyOrders.filter(
    (o) => o.status === "CANCELLED"
  ).length;

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        toast.error(payload?.error || "Could not delete order.");
        return;
      }

      removeOrder(deleteTarget.id);
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
      }
      const { requestServerDataSync } = await import(
        "@/services/dataSyncService"
      );
      requestServerDataSync();
      toast.success(`Order #${deleteTarget.order_number} deleted.`);
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete order.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <Reveal className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Order History</h1>
          <p className="text-sm text-muted-foreground">
            Delivered and cancelled orders
            {historyOrders.length > 0
              ? ` · ${deliveredCount} delivered · ${cancelledCount} cancelled`
              : ""}
          </p>
          {loadError && (
            <p className="mt-1 text-sm text-red-600">
              {loadError}{" "}
              {loadError.includes("Session") && (
                <a
                  href="/login?next=/admin/order-history"
                  className="underline"
                >
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
      </Reveal>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as HistoryFilter)}
        >
          <TabsList>
            <TabsTrigger value="ALL">All ({historyOrders.length})</TabsTrigger>
            <TabsTrigger value="DELIVERED">
              Delivered ({deliveredCount})
            </TabsTrigger>
            <TabsTrigger value="CANCELLED">
              Cancelled ({cancelledCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order #, customer…"
            className="w-full rounded-xl border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none ring-sky/30 focus:ring-2"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="No orders here yet"
          description={
            normalizedQuery
              ? "No history matches your search."
              : "Delivered and cancelled orders will appear here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="hidden grid-cols-[1fr_1.2fr_1fr_1fr_auto] gap-3 border-b bg-surface px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>When</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          <Stagger className="divide-y" fast>
            {filtered.map((order) => {
              const when =
                order.status === "DELIVERED"
                  ? order.delivered_at || order.updated_at
                  : order.cancelled_at || order.updated_at;
              return (
                <StaggerItem key={order.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(order)}
                    className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-surface/80 md:grid-cols-[1fr_1.2fr_1fr_1fr_auto] md:items-center md:gap-3"
                  >
                    <div>
                      <p className="font-semibold text-navy">
                        #{order.order_number}
                      </p>
                      <p className="text-xs text-muted-foreground md:hidden">
                        {order.customer?.full_name ?? "Guest"}
                      </p>
                    </div>
                    <p className="hidden text-sm text-muted-foreground md:block">
                      {order.customer?.full_name ?? "Guest"}
                    </p>
                    <div>
                      <p className="text-sm text-navy">{formatDateTime(when)}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(when)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-green">
                      {formatCurrency(order.total)}
                    </p>
                    <StatusBadge status={order.status} />
                  </button>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete order?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently remove order{" "}
                  <span className="font-medium text-foreground">
                    #{deleteTarget.order_number}
                  </span>{" "}
                  ({formatCurrency(deleteTarget.total)}) from history. Related
                  payments, delivery records, and loyalty entries will also be
                  removed. This action cannot be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                {selected.status === "CANCELLED" && selected.cancelled_reason && (
                  <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {selected.cancelled_reason}
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteTarget(selected)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete order
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

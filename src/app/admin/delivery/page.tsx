"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { AssignDriverControls } from "@/components/admin/AssignDriverControls";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMapProvider } from "@/lib/maps/provider";
import { canAccessAdmin, canAssignDrivers } from "@/lib/auth/config";
import { STORE_LOCATION } from "@/data/demo";
import {
  formatCurrency,
  formatDateTime,
  relativeTime,
} from "@/lib/utils/format";
import type { DeliveryOrder, Order } from "@/types";

export default function AdminDeliveryPage() {
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const role = useAuthStore((s) => s.user?.role);
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);

  const mapProvider = getMapProvider();

  useEffect(() => {
    if (authInitializing || !user || !canAccessAdmin(user.role)) return;

    const refresh = async () => {
      try {
        const res = await fetch("/api/orders", {
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await res.json().catch(() => null)) as {
          orders?: Order[];
          deliveries?: DeliveryOrder[];
        } | null;
        if (!res.ok) return;
        if (Array.isArray(payload?.orders)) setOrders(payload.orders);
        if (Array.isArray(payload?.deliveries)) {
          setDeliveries(payload.deliveries);
        }
      } catch {
        /* ignore background poll errors */
      }
    };

    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [authInitializing, user, setOrders, setDeliveries]);

  const grouped = useMemo(() => {
    const pending = deliveries.filter((d) =>
      ["PENDING", "ASSIGNED"].includes(d.status)
    );
    const awaitingPickup = deliveries.filter((d) => d.status === "ACCEPTED");
    const active = deliveries.filter((d) =>
      ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ARRIVED"].includes(d.status)
    );
    const completed = deliveries.filter((d) =>
      ["DELIVERED", "CANCELLED"].includes(d.status)
    );
    const readyOrders = orders.filter(
      (o) => o.status === "READY" || o.status === "ASSIGNED"
    );
    return { pending, awaitingPickup, active, completed, readyOrders };
  }, [deliveries, orders]);

  const activeDelivery = grouped.active[0];

  const getOrderForDelivery = (d: DeliveryOrder) =>
    orders.find((o) => o.id === d.order_id);

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Manage deliveries and assign drivers
        </p>
      </div>

      {grouped.readyOrders.length > 0 && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-navy">
            Ready / Assigned — assign or reassign
          </h2>
          <div className="space-y-3">
            {grouped.readyOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 rounded-xl bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-navy">#{order.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer?.full_name} · {formatCurrency(order.total)}
                    {order.status === "ASSIGNED" ? " · Assigned" : " · Ready"}
                  </p>
                </div>
                {canAssignDrivers(role) ? (
                  <AssignDriverControls orderId={order.id} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Waiting for manager to assign a driver
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {grouped.awaitingPickup.length > 0 && canAccessAdmin(role) && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-navy">
            <PackageCheck className="h-5 w-5 text-amber-700" />
            Driver accepted — confirm pickup
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Hand the order to the rider, then mark it picked up.
          </p>
          <div className="space-y-3">
            {grouped.awaitingPickup.map((delivery) => (
              <AwaitingPickupRow
                key={delivery.id}
                delivery={delivery}
                order={getOrderForDelivery(delivery)}
              />
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending ({grouped.pending.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({grouped.active.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({grouped.completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {grouped.pending.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No pending deliveries"
              description="Assigned deliveries waiting for rider acceptance will appear here."
            />
          ) : (
            <DeliveryList
              deliveries={grouped.pending}
              getOrder={getOrderForDelivery}
            />
          )}
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-6 lg:grid-cols-2">
            {grouped.active.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState
                  icon={Truck}
                  title="No active deliveries"
                  description="Deliveries in progress will show here with live map."
                />
              </div>
            ) : (
              <>
                <DeliveryList
                  deliveries={grouped.active}
                  getOrder={getOrderForDelivery}
                />
                {activeDelivery && (
                  <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                    <div className="border-b px-4 py-3">
                      <h3 className="flex items-center gap-2 font-semibold text-navy">
                        <MapPin className="h-4 w-4 text-sky" />
                        Live Map
                      </h3>
                    </div>
                    <div className="aspect-video">
                      <iframe
                        title="Delivery map"
                        src={mapProvider.getEmbedUrl({
                          lat:
                            activeDelivery.customer_latitude ??
                            STORE_LOCATION.lat,
                          lng:
                            activeDelivery.customer_longitude ??
                            STORE_LOCATION.lng,
                        })}
                        className="h-full w-full border-0"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          {grouped.completed.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No completed deliveries"
              description="Finished deliveries will appear here."
            />
          ) : (
            <DeliveryList
              deliveries={grouped.completed}
              getOrder={getOrderForDelivery}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AwaitingPickupRow({
  delivery,
  order,
}: {
  delivery: DeliveryOrder;
  order: ReturnType<typeof useAppStore.getState>["orders"][0] | undefined;
}) {
  const updateDeliveryStatus = useAppStore((s) => s.updateDeliveryStatus);
  const [busy, setBusy] = useState(false);

  const markPickedUp = async () => {
    setBusy(true);
    try {
      await updateDeliveryStatus(delivery.id, "PICKED_UP");
      toast.success("Marked as picked up");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not mark as picked up."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-navy">
          #{order?.order_number ?? delivery.order_id}
        </p>
        <p className="text-sm text-muted-foreground">
          {order?.customer?.full_name} ·{" "}
          {delivery.driver?.profile?.full_name ?? "Driver"}
        </p>
      </div>
      <Button
        className="bg-green hover:bg-green/90"
        onClick={() => void markPickedUp()}
        disabled={busy}
      >
        <PackageCheck className="mr-2 h-4 w-4" />
        {busy ? "Saving…" : "Mark Picked Up"}
      </Button>
    </div>
  );
}

function DeliveryList({
  deliveries,
  getOrder,
}: {
  deliveries: DeliveryOrder[];
  getOrder: (
    d: DeliveryOrder
  ) => ReturnType<typeof useAppStore.getState>["orders"][0] | undefined;
}) {
  const role = useAuthStore((s) => s.user?.role);
  const updateDeliveryStatus = useAppStore((s) => s.updateDeliveryStatus);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {deliveries.map((delivery) => {
        const order = getOrder(delivery);
        const canReassign =
          !!order &&
          canAssignDrivers(role) &&
          ["PENDING", "ASSIGNED"].includes(delivery.status);
        const canMarkPickup =
          canAccessAdmin(role) && delivery.status === "ACCEPTED";

        const markPickedUp = async () => {
          setBusyId(delivery.id);
          try {
            await updateDeliveryStatus(delivery.id, "PICKED_UP");
            toast.success("Marked as picked up");
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Could not mark as picked up."
            );
          } finally {
            setBusyId(null);
          }
        };

        return (
          <div
            key={delivery.id}
            className="rounded-2xl bg-white p-4 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-navy">
                  #{order?.order_number ?? delivery.order_id}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order?.customer?.full_name} ·{" "}
                  {delivery.driver?.profile?.full_name ?? "Unassigned"}
                </p>
              </div>
              <StatusBadge status={delivery.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Fee: {formatCurrency(delivery.delivery_fee ?? 0)}</span>
              <span>{delivery.distance_km ?? 0} km</span>
              <span>{relativeTime(delivery.updated_at)}</span>
            </div>
            {delivery.estimated_arrival && (
              <p className="mt-1 text-xs text-sky">
                ETA: {formatDateTime(delivery.estimated_arrival)}
              </p>
            )}
            {canReassign && order && (
              <AssignDriverControls
                orderId={order.id}
                compact
                className="mt-3"
              />
            )}
            {canMarkPickup && (
              <Button
                className="mt-3 w-full bg-green hover:bg-green/90 sm:w-auto"
                onClick={() => void markPickedUp()}
                disabled={busyId === delivery.id}
              >
                <PackageCheck className="mr-2 h-4 w-4" />
                {busyId === delivery.id ? "Saving…" : "Mark Picked Up"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

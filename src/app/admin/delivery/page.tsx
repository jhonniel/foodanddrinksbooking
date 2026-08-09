"use client";

import { useMemo } from "react";
import { MapPin, Truck } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { AssignDriverControls } from "@/components/admin/AssignDriverControls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMapProvider } from "@/lib/maps/provider";
import { canAssignDrivers } from "@/lib/auth/config";
import { STORE_LOCATION } from "@/data/demo";
import {
  formatCurrency,
  formatDateTime,
  relativeTime,
} from "@/lib/utils/format";
import type { DeliveryOrder } from "@/types";

export default function AdminDeliveryPage() {
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const role = useAuthStore((s) => s.user?.role);

  const mapProvider = getMapProvider();

  const grouped = useMemo(() => {
    const pending = deliveries.filter((d) =>
      ["PENDING", "ASSIGNED"].includes(d.status)
    );
    const active = deliveries.filter((d) =>
      ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ARRIVED"].includes(d.status)
    );
    const completed = deliveries.filter((d) =>
      ["DELIVERED", "CANCELLED"].includes(d.status)
    );
    const readyOrders = orders.filter((o) => o.status === "READY");
    return { pending, active, completed, readyOrders };
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
          <h2 className="mb-3 font-semibold text-navy">Ready for Pickup</h2>
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

function DeliveryList({
  deliveries,
  getOrder,
}: {
  deliveries: DeliveryOrder[];
  getOrder: (
    d: DeliveryOrder
  ) => ReturnType<typeof useAppStore.getState>["orders"][0] | undefined;
}) {
  return (
    <div className="space-y-3">
      {deliveries.map((delivery) => {
        const order = getOrder(delivery);
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
          </div>
        );
      })}
    </div>
  );
}

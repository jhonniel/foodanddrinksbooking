"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stagger, StaggerItem } from "@/components/motion";
import { formatCurrency, relativeTime } from "@/lib/utils/format";
import { filterDeliveriesForDriver } from "@/services/deliveryService";
import type { DeliveryStatus } from "@/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: DeliveryStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "DELIVERED", label: "Delivered" },
];

export default function DriverDeliveriesPage() {
  const user = useAuthStore((s) => s.user);
  const deliveries = useAppStore((s) => s.deliveries);
  const orders = useAppStore((s) => s.orders);
  const drivers = useDataStore((s) => s.drivers);
  const [filter, setFilter] = useState<DeliveryStatus | "ALL">("ALL");

  const driverRecord =
    drivers.find((d) => d.profile_id === user?.id || d.id === user?.id) ??
    null;

  const myDeliveries = useMemo(
    () =>
      filterDeliveriesForDriver({
        deliveries,
        orders,
        user,
        driverRecord,
      }),
    [deliveries, orders, user, driverRecord]
  );

  const filtered = useMemo(() => {
    if (filter === "ALL") return myDeliveries;
    if (filter === "IN_TRANSIT") {
      return myDeliveries.filter((d) =>
        ["PICKED_UP", "IN_TRANSIT", "ARRIVED"].includes(d.status)
      );
    }
    return myDeliveries.filter((d) => d.status === filter);
  }, [myDeliveries, filter]);

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Your assigned delivery orders
        </p>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as DeliveryStatus | "ALL")}
        className="mb-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-white p-1 shadow-card">
          {FILTERS.map((f) => (
            <TabsTrigger
              key={f.value}
              value={f.value}
              className={cn(
                "rounded-lg text-xs data-[state=active]:bg-green data-[state=active]:text-white"
              )}
            >
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No deliveries"
          description="Deliveries matching this filter will appear here."
          className="rounded-2xl bg-white shadow-card"
        />
      ) : (
        <Stagger className="space-y-3" fast>
          {filtered.map((delivery) => {
            const order = orders.find((o) => o.id === delivery.order_id);
            return (
              <StaggerItem key={delivery.id}>
                <div className="rounded-2xl bg-white shadow-card">
                  <Link
                    href={`/driver/deliveries/${delivery.id}`}
                    className="block p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-navy">
                          #{order?.order_number ?? "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order?.customer?.full_name}
                        </p>
                      </div>
                      <StatusBadge status={delivery.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-medium text-green">
                        {order ? formatCurrency(order.total) : "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {relativeTime(delivery.updated_at)}
                      </span>
                    </div>
                  </Link>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}

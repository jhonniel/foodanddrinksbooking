"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { OrderTrackingStepper } from "@/components/customer/OrderTrackingStepper";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { trackingHeadline } from "@/lib/orderTracking";
import type { DeliveryOrder, Order, OrderStatus } from "@/types";

const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
];

function OrderCard({ order }: { order: Order }) {
  const itemPreview = order.items
    ?.slice(0, 2)
    .map((i) => `${i.quantity}x ${i.product_name}`)
    .join(", ");
  const isActive = ACTIVE_STATUSES.includes(order.status);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block rounded-2xl bg-white p-4 shadow-card transition-shadow hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-navy">#{order.order_number}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDateTime(order.created_at)} ·{" "}
            {order.order_type === "DELIVERY" ? "Delivery" : "Pickup"}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      {isActive && (
        <p className="mt-2 text-sm font-medium text-sky">
          {trackingHeadline(order.status, order.order_type)}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        {order.items?.[0]?.product_image_url && (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-light-blue">
            <Image
              src={order.items[0].product_image_url}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {itemPreview}
            {(order.items?.length ?? 0) > 2 && "..."}
          </p>
          <p className="mt-1 text-sm font-bold text-green">
            {formatCurrency(order.total)}
          </p>
        </div>
      </div>
      {isActive && <OrderTrackingStepper order={order} compact />}
      <p className="mt-3 text-xs font-semibold text-green">
        {isActive ? "Track order →" : "View details →"}
      </p>
    </Link>
  );
}

function OrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No orders here"
        description="Orders in this category will appear here"
        actionLabel="Order Now"
        onAction={() => (window.location.href = "/menu")}
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const allOrders = useAppStore((s) => s.orders);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const mergeOrders = useAppStore((s) => s.mergeOrders);
  const mergeDeliveries = useAppStore((s) => s.mergeDeliveries);
  const [tab, setTab] = useState("active");

  useEffect(() => {
    if (!hasHydrated || authInitializing || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/orders", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          orders?: Order[];
          deliveries?: DeliveryOrder[];
        };
        if (cancelled) return;
        if (Array.isArray(data.orders)) mergeOrders(data.orders);
        if (Array.isArray(data.deliveries)) mergeDeliveries(data.deliveries);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, authInitializing, user, mergeOrders, mergeDeliveries]);

  const customerOrders = useMemo(
    () =>
      allOrders
        .filter((o) => o.customer_id === user?.id)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [allOrders, user?.id]
  );

  const active = customerOrders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const completed = customerOrders.filter((o) => o.status === "DELIVERED");
  const cancelled = customerOrders.filter((o) => o.status === "CANCELLED");

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track and reorder your drinks
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted p-1">
          <TabsTrigger value="active" className="rounded-lg text-sm">
            Active ({active.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg text-sm">
            Completed ({completed.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-lg text-sm">
            Cancelled ({cancelled.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <OrderList orders={active} />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <OrderList orders={completed} />
        </TabsContent>
        <TabsContent value="cancelled" className="mt-4">
          <OrderList orders={cancelled} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

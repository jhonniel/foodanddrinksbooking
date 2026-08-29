"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Phone,
  RotateCcw,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OrderTrackingStepper } from "@/components/customer/OrderTrackingStepper";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import { MapEmbed } from "@/components/shared/MapEmbed";
import {
  canReorderItems,
  getInsufficientStockReorderItems,
  getUnavailableReorderItems,
  orderItemToCartItem,
} from "@/lib/orders/reorder";
import { maxStockToastMessage } from "@/lib/cart/stockLimits";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { customerCanCancelOrder } from "@/lib/constants";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const setOrders = useAppStore((s) => s.setOrders);
  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const products = useDataStore((s) => s.products);
  const inventory = useDataStore((s) => s.inventory);
  const [cancelling, setCancelling] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const delivery = deliveries.find((d) => d.order_id === orderId);

  const mapCenter = useMemo(() => {
    if (!order || order.order_type !== "DELIVERY") return null;
    return {
      lat:
        order.delivery_address_snapshot?.latitude ??
        delivery?.customer_latitude ??
        10.335,
      lng:
        order.delivery_address_snapshot?.longitude ??
        delivery?.customer_longitude ??
        123.905,
    };
  }, [order, delivery]);

  const rider = delivery?.driver ?? null;

  const reorderAvailable = useMemo(
    () =>
      order?.items?.length
        ? canReorderItems(order.items, products, inventory, cartItems)
        : false,
    [order?.items, products, inventory, cartItems]
  );

  const handleReorder = () => {
    if (!order?.items?.length) return;

    const unavailable = getUnavailableReorderItems(
      order.items,
      products,
      inventory
    );
    if (unavailable.length > 0) {
      toast.error(
        unavailable.length === 1
          ? `${unavailable[0]} is no longer available and cannot be reordered.`
          : `Some items are no longer available: ${unavailable.join(", ")}.`
      );
      return;
    }

    const insufficient = getInsufficientStockReorderItems(
      order.items,
      products,
      inventory,
      cartItems
    );
    if (insufficient.length > 0) {
      const name = insufficient[0];
      const product = products.find((p) => p.name === name);
      toast.error(
        product
          ? maxStockToastMessage(name)
          : `Not enough stock for ${name} to complete this reorder.`
      );
      return;
    }

    order.items.forEach((item) => {
      const product = products.find((p) => p.id === item.product_id);
      addItem(orderItemToCartItem(item), product);
    });
    toast.success("Items added to cart");
    router.push("/cart");
  };

  const handleCancel = async () => {
    if (!order) return;
    if (!customerCanCancelOrder(order.status)) {
      toast.error(
        "This order is already Confirmed. Only the store can cancel it."
      );
      return;
    }
    if (
      !window.confirm(
        "Cancel this order? You can only cancel before the store Confirms it."
      )
    ) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          cancelledReason: "Cancelled by customer",
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        order?: typeof order;
        error?: string;
      } | null;
      if (!res.ok || !data?.order) {
        toast.error(
          data?.error ||
            "Could not cancel order. If it is already processing, contact the store."
        );
        return;
      }
      setOrders(
        useAppStore
          .getState()
          .orders.map((o) => (o.id === data.order!.id ? { ...o, ...data.order! } : o))
      );
      toast.success("Order cancelled");
    } catch {
      toast.error("Could not cancel order. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (!order) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold text-navy">Order not found</h1>
        <Link
          href="/orders"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green/90"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  const isDelivery = order.order_type === "DELIVERY";
  const showLiveExtras =
    isDelivery &&
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED";

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy">
            Order #{order.order_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.scheduled_at
              ? `Scheduled ${formatDateTime(order.scheduled_at)}`
              : formatDateTime(order.created_at)}{" "}
            · {isDelivery ? "Delivery" : "Pickup"}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <OrderTrackingStepper order={order} />

      {showLiveExtras && mapCenter && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-navy">Delivery location</h2>
            <p className="text-xs text-muted-foreground">
              Where your order is headed
            </p>
          </div>
          <div className="relative aspect-video w-full bg-light-blue">
            <MapEmbed center={mapCenter} />
          </div>
        </div>
      )}

      {showLiveExtras && rider && (
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-3 font-semibold text-navy">Your Rider</h2>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {rider.profile?.full_name?.charAt(0) ?? "R"}
              </div>
              <div>
                <p className="font-semibold text-navy">
                  {rider.profile?.full_name ?? "Rider"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rider.vehicle_type} · {rider.rating}★
                </p>
              </div>
            </div>
            <a
              href={`tel:${rider.profile?.phone ?? ""}`}
              className="inline-flex items-center justify-center rounded-xl bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green/90"
            >
              <Phone className="mr-2 h-4 w-4" />
              Call
            </a>
          </div>
          {delivery?.delivery_pin && (
            <p className="mt-3 rounded-xl bg-light-blue px-3 py-2 text-center text-sm">
              Delivery PIN:{" "}
              <span className="font-bold text-navy">
                {delivery.delivery_pin}
              </span>
            </p>
          )}
        </div>
      )}

      {order.delivery_address_snapshot && (
        <div className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
          <MapPin className="h-5 w-5 shrink-0 text-sky" />
          <div>
            <p className="font-semibold text-navy">
              {order.delivery_address_snapshot.label ?? "Delivery Address"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {order.delivery_address_snapshot.full_address}
            </p>
          </div>
        </div>
      )}

      {!isDelivery && (
        <div className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
          <MapPin className="h-5 w-5 shrink-0 text-sky" />
          <div>
            <p className="font-semibold text-navy">Pickup at store</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Show your order number at the counter when you arrive.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 font-semibold text-navy">Items</h2>
        <div className="space-y-3">
          {order.items?.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-light-blue">
                {item.product_image_url && (
                  <Image
                    src={item.product_image_url}
                    alt={item.product_name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                )}
              </div>
              <div className="flex flex-1 justify-between gap-2">
                <div>
                  <p className="font-medium text-navy">
                    {item.quantity}x {item.product_name}
                  </p>
                  {item.options && item.options.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.options.map((o) => o.value_name).join(" · ")}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-medium text-navy">
                  {formatCurrency(item.total_price)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span>
              {order.delivery_fee === 0
                ? "Free"
                : formatCurrency(order.delivery_fee)}
            </span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green">
              <span>Discount</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          {order.points_discount > 0 && (
            <div className="flex justify-between text-green">
              <span>Points</span>
              <span>-{formatCurrency(order.points_discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-navy">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {(user?.role === "CUSTOMER" || !user) &&
        customerCanCancelOrder(order.status) && (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => void handleCancel()}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </Button>
        )}

      {(user?.role === "CUSTOMER" || !user) &&
        !customerCanCancelOrder(order.status) &&
        order.status !== "DELIVERED" &&
        order.status !== "CANCELLED" && (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
            This order is Confirmed and can only be cancelled by the store.
          </p>
        )}

      {(user?.role === "CUSTOMER" || !user) &&
        order.status === "DELIVERED" && (
          <>
            <Button
              onClick={handleReorder}
              variant="outline"
              disabled={!reorderAvailable}
              className="h-12 w-full rounded-xl border-green text-green hover:bg-green/5 disabled:opacity-50"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reorder
            </Button>
            {!reorderAvailable && (
              <p className="text-center text-xs text-muted-foreground">
                One or more items from this order are no longer available.
              </p>
            )}
          </>
        )}
    </div>
  );
}

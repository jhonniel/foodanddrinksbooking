"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Phone, MapPin, Navigation, CheckCircle } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCurrency,
  formatDateTime,
} from "@/lib/utils/format";
import { openExternalNavigation } from "@/lib/maps/provider";
import type { DeliveryStatus } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_FLOW: {
  status: DeliveryStatus;
  label: string;
  next: DeliveryStatus;
  success?: string;
}[] = [
  {
    status: "ASSIGNED",
    label: "Accept Delivery",
    next: "ACCEPTED",
    success: "Delivery accepted",
  },
  // PICKED_UP is set by store staff — driver waits after accept
  {
    status: "PICKED_UP",
    label: "Start Navigation",
    next: "IN_TRANSIT",
    success: "En route to customer",
  },
  {
    status: "IN_TRANSIT",
    label: "Mark Arrived",
    next: "ARRIVED",
    success: "Arrived at customer",
  },
  {
    status: "ARRIVED",
    label: "Mark Delivered",
    next: "DELIVERED",
    success: "Delivery completed!",
  },
];

export default function DriverDeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const deliveries = useAppStore((s) => s.deliveries);
  const orders = useAppStore((s) => s.orders);
  const updateDeliveryStatus = useAppStore((s) => s.updateDeliveryStatus);
  const [pin, setPin] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [busy, setBusy] = useState(false);

  const delivery = deliveries.find((d) => d.id === id);
  const order =
    delivery?.order ??
    (delivery ? orders.find((o) => o.id === delivery.order_id) : null) ??
    null;

  if (!delivery || !order) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Delivery not found</p>
        <Link
          href="/driver/deliveries"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "mt-4 inline-flex"
          )}
        >
          Back to deliveries
        </Link>
      </div>
    );
  }

  const currentStep = STATUS_FLOW.find((s) => s.status === delivery.status);
  const customerPhone = order.customer?.phone;

  const applyStatus = async (next: DeliveryStatus, successMsg?: string) => {
    setBusy(true);
    try {
      await updateDeliveryStatus(delivery.id, next);
      toast.success(successMsg || "Status updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update delivery status."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleNavigate = () => {
    if (
      delivery.customer_latitude != null &&
      delivery.customer_longitude != null
    ) {
      openExternalNavigation(
        {
          lat: delivery.customer_latitude,
          lng: delivery.customer_longitude,
        },
        order.delivery_address_snapshot?.full_address
      );
      if (delivery.status === "PICKED_UP") {
        void applyStatus("IN_TRANSIT", "En route to customer");
      }
    } else {
      toast.error("Customer location not available");
    }
  };

  const handleAction = () => {
    if (!currentStep || busy) return;

    if (currentStep.next === "DELIVERED") {
      if (!showPinInput) {
        setShowPinInput(true);
        return;
      }
      if (delivery.delivery_pin && pin !== delivery.delivery_pin) {
        toast.error("Incorrect delivery PIN");
        return;
      }
    }

    if (currentStep.next === "IN_TRANSIT") {
      handleNavigate();
      return;
    }

    void applyStatus(currentStep.next, currentStep.success);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">
            Order #{order.order_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(delivery.updated_at)}
          </p>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-2 font-semibold text-navy">Customer</h2>
        <p className="font-medium">{order.customer?.full_name}</p>
        {customerPhone && (
          <a
            href={`tel:${customerPhone.replace(/\s/g, "")}`}
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-light-blue text-base font-semibold text-sky"
          >
            <Phone className="h-5 w-5" />
            Call Customer
          </a>
        )}
        {order.delivery_address_snapshot && (
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
            {order.delivery_address_snapshot.full_address}
          </p>
        )}
        {order.delivery_instructions && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Note: {order.delivery_instructions}
          </p>
        )}
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 font-semibold text-navy">Items</h2>
        <ul className="space-y-2">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.product_name}
              </span>
              <span>{formatCurrency(item.total_price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-3">
          <div className="flex justify-between font-bold text-navy">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Payment</span>
            <StatusBadge status={order.payment_status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Method: {order.payment_method}
          </p>
        </div>
      </div>

      {showPinInput && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-card">
          <Label htmlFor="pin">Delivery PIN</Label>
          <Input
            id="pin"
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Enter 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-2 h-12 text-center text-lg tracking-widest"
          />
        </div>
      )}

      <div className="space-y-3">
        {(delivery.status === "PICKED_UP" ||
          delivery.status === "IN_TRANSIT" ||
          delivery.status === "ARRIVED") && (
          <>
            <Link
              href={`/driver/navigate?id=${delivery.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-14 w-full border-sky text-base text-sky"
              )}
            >
              <Navigation className="mr-2 h-5 w-5" />
              Open Map
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full text-base"
              onClick={handleNavigate}
              disabled={busy}
            >
              <Navigation className="mr-2 h-5 w-5" />
              Navigate
            </Button>
          </>
        )}

        {delivery.status === "ACCEPTED" && (
          <div className="rounded-2xl bg-amber-50 p-4 text-center">
            <p className="font-semibold text-amber-900">Waiting for pickup</p>
            <p className="mt-1 text-sm text-amber-800">
              Go to the store. Staff will mark this order as picked up, then you
              can start navigation.
            </p>
          </div>
        )}

        {currentStep && delivery.status !== "DELIVERED" && (
          <Button
            size="lg"
            className="h-14 w-full bg-green text-base hover:bg-green/90"
            onClick={handleAction}
            disabled={busy}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            {busy
              ? "Saving…"
              : showPinInput && currentStep.next === "DELIVERED"
                ? "Confirm Delivery"
                : currentStep.label}
          </Button>
        )}

        {delivery.status === "DELIVERED" && (
          <div className="rounded-2xl bg-green/10 p-4 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-green" />
            <p className="mt-2 font-semibold text-green">Delivery Complete</p>
          </div>
        )}
      </div>
    </div>
  );
}

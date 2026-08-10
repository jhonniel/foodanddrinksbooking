"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  CreditCard,
  Banknote,
  Smartphone,
  Globe,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore, formatCartOptions, getCartItemPrice } from "@/stores/cart";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { DELIVERY_CONFIG, STORE_LOCATION } from "@/data/demo";
import {
  calculateDeliveryFee,
  formatDeliveryRateLabel,
  formatDistanceKm,
} from "@/lib/delivery/pricing";
import type { Order, PaymentMethod } from "@/types";

const DEMO_ADDRESSES = [
  {
    id: "addr-1",
    label: "Home",
    full_address: "42 Palm Avenue, Lahug, Cebu City",
    latitude: 10.335,
    longitude: 123.905,
  },
  {
    id: "addr-2",
    label: "Office",
    full_address: "88 IT Park, Apas, Cebu City",
    latitude: 10.33,
    longitude: 123.898,
  },
  {
    id: "addr-3",
    label: "Condo",
    full_address: "Mactan Newtown, Lapu-Lapu City",
    latitude: 10.307,
    longitude: 123.965,
  },
];

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  icon: typeof CreditCard;
}[] = [
  { value: "COD", label: "Cash on Delivery", icon: Banknote },
  { value: "GCASH", label: "GCash", icon: Smartphone },
  { value: "CARD", label: "Credit / Debit Card", icon: CreditCard },
  { value: "ONLINE", label: "Online Payment", icon: Globe },
];

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const addOrder = useAppStore((s) => s.addOrder);
  const addNotification = useAppStore((s) => s.addNotification);

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const promoCode = useCartStore((s) => s.promoCode);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const pointsDiscount = useCartStore((s) => s.pointsDiscount);
  const pointsToUse = useCartStore((s) => s.pointsToUse);
  const setDeliveryLocation = useCartStore((s) => s.setDeliveryLocation);
  const clearCart = useCartStore((s) => s.clearCart);
  const { subtotal, deliveryQuote, deliveryFee, total } = useCartTotals();

  const [selectedAddress, setSelectedAddress] = useState(DEMO_ADDRESSES[0].id);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("GCASH");
  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    const addr = DEMO_ADDRESSES.find((a) => a.id === selectedAddress);
    if (!addr) return;
    setDeliveryLocation(
      { lat: addr.latitude, lng: addr.longitude },
      addr.label
    );
  }, [selectedAddress, setDeliveryLocation]);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold text-navy">Nothing to checkout</h1>
        <Link
          href="/menu"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green/90"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  const address = DEMO_ADDRESSES.find((a) => a.id === selectedAddress);

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error("Please sign in to place an order");
      return;
    }
    if (orderType === "DELIVERY" && !deliveryQuote.withinRadius) {
      toast.error(
        `Sorry, this address is outside our ${DELIVERY_CONFIG.radiusKm} km delivery radius.`
      );
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          paymentMethod,
          addressId: address?.id,
          fullAddress: address?.full_address,
          latitude: address?.latitude,
          longitude: address?.longitude,
          deliveryInstructions: instructions || undefined,
          items: items.map((item) => ({
            ...item,
            productImage: item.productImage ?? null,
            options: item.options ?? [],
            addons: item.addons ?? [],
          })),
          deliveryFee,
          subtotal,
          discount: promoDiscount,
          pointsDiscount,
          pointsUsed: pointsToUse,
          promoCode: promoCode ?? null,
        }),
      });
      const data = (await res.json()) as {
        order?: Order;
        error?: string;
        details?: Record<string, string[] | undefined>;
      };
      if (!res.ok || !data.order) {
        if (res.status === 401) {
          toast.error("Please sign in to place an order");
          router.push("/login?next=/checkout");
          return;
        }
        const detailHint = data.details
          ? Object.entries(
              (data.details as { fieldErrors?: Record<string, string[]> })
                .fieldErrors ?? {}
            )
              .flatMap(([k, v]) => (v ?? []).map((msg) => `${k}: ${msg}`))
              .slice(0, 2)
              .join(" · ")
          : "";
        toast.error(
          detailHint
            ? `${data.error ?? "Failed to place order"} (${detailHint})`
            : data.error ?? "Failed to place order"
        );
        return;
      }

      addOrder(data.order);
      addNotification({
        id: `n-${Date.now()}`,
        user_id: user.id,
        type: "ORDER",
        title: "Order placed!",
        body: `Your order ${data.order.order_number} has been received.`,
        data: { orderId: data.order.id },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (data.order.points_earned > 0) {
        updateUser({
          points_balance: user.points_balance + data.order.points_earned,
          lifetime_points: user.lifetime_points + data.order.points_earned,
        });
      }

      clearCart();
      toast.success("Order placed successfully!");
      router.push(`/orders/${data.order.id}`);
    } catch {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <div className="flex items-center gap-3">
        <Link
          href="/cart"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy">Checkout</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 4</p>
        </div>
      </div>

      <div className="flex gap-1">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              s <= step ? "bg-green" : "bg-muted"
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">Delivery Type</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["DELIVERY", "PICKUP"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-colors",
                  orderType === type
                    ? "border-green bg-green/5"
                    : "border-border bg-white shadow-card"
                )}
              >
                <p className="font-semibold text-navy">
                  {type === "DELIVERY" ? "Delivery" : "Pickup"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {type === "DELIVERY"
                    ? `~${deliveryQuote.estimatedMinutes} min · ${
                        deliveryFee === 0
                          ? "Free"
                          : `${formatCurrency(deliveryFee)} · ${formatDistanceKm(deliveryQuote.distanceKm)}`
                      }`
                    : `Ready in ~15 min · Free`}
                </p>
              </button>
            ))}
          </div>
          {orderType === "PICKUP" && (
            <div className="rounded-2xl bg-light-blue p-4 text-sm">
              <p className="font-semibold text-navy">{STORE_LOCATION.name}</p>
              <p className="mt-1 text-muted-foreground">{STORE_LOCATION.address}</p>
              <p className="mt-1 text-muted-foreground">{STORE_LOCATION.hours}</p>
            </div>
          )}
          <Button
            onClick={() => setStep(2)}
            className="h-12 w-full rounded-xl bg-green hover:bg-green/90"
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">
            {orderType === "DELIVERY" ? "Delivery Address" : "Pickup Details"}
          </h2>
          {orderType === "DELIVERY" ? (
            <>
              <RadioGroup
                value={selectedAddress}
                onValueChange={(v) => v && setSelectedAddress(v)}
                className="space-y-3"
              >
                {DEMO_ADDRESSES.map((addr) => {
                  const quote = calculateDeliveryFee(
                    { lat: addr.latitude, lng: addr.longitude },
                    subtotal
                  );
                  return (
                    <label
                      key={addr.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors",
                        selectedAddress === addr.id
                          ? "border-green bg-green/5"
                          : "border-border bg-white shadow-card",
                        !quote.withinRadius && "opacity-70"
                      )}
                    >
                      <RadioGroupItem value={addr.id} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-sky" />
                            <span className="font-semibold text-navy">
                              {addr.label}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-navy">
                            {quote.withinRadius
                              ? quote.isFree
                                ? "Free"
                                : formatCurrency(quote.fee)
                              : "Out of range"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {addr.full_address}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceKm(quote.distanceKm)} from store · ~
                          {quote.estimatedMinutes} min
                          {!quote.withinRadius &&
                            ` · max ${DELIVERY_CONFIG.radiusKm} km`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
              <div>
                <Label htmlFor="instructions">Delivery Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder="Gate code, landmarks, etc."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Show your order number at the counter when you arrive.
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl">
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={
                orderType === "DELIVERY" && !deliveryQuote.withinRadius
              }
              className="flex-1 rounded-xl bg-green hover:bg-green/90"
            >
              Continue
            </Button>
          </div>
          {orderType === "DELIVERY" && !deliveryQuote.withinRadius && (
            <p className="text-center text-xs text-destructive">
              Selected address is outside our {DELIVERY_CONFIG.radiusKm} km
              delivery area.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">Payment Method</h2>
          <RadioGroup
            value={paymentMethod}
          onValueChange={(v) => v && setPaymentMethod(v as PaymentMethod)}
            className="space-y-3"
          >
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-colors",
                  paymentMethod === value
                    ? "border-green bg-green/5"
                    : "border-border bg-white shadow-card"
                )}
              >
                <RadioGroupItem value={value} />
                <Icon className="h-5 w-5 text-sky" />
                <span className="font-medium text-navy">{label}</span>
              </label>
            ))}
          </RadioGroup>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 rounded-xl">
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              className="flex-1 rounded-xl bg-green hover:bg-green/90"
            >
              Review Order
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">Review Order</h2>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-navy">
                      {item.quantity}x {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCartOptions(item.options, item.addons)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatCurrency(getCartItemPrice(item))}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Delivery
                  {orderType === "DELIVERY" && deliveryQuote.distanceKm > 0 && (
                    <span className="ml-1 text-xs">
                      ({formatDistanceKm(deliveryQuote.distanceKm)})
                    </span>
                  )}
                </span>
                <span>
                  {deliveryFee === 0 ? "Free" : formatCurrency(deliveryFee)}
                </span>
              </div>
              {orderType === "DELIVERY" && deliveryFee > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatDeliveryRateLabel()} ·{" "}
                  {formatDistanceKm(deliveryQuote.distanceKm)}
                  {deliveryQuote.breakdown.succeedingKm > 0 &&
                    ` (+${deliveryQuote.breakdown.succeedingKm} km after first)`}
                </p>
              )}
              {promoDiscount > 0 && (
                <div className="flex justify-between text-green">
                  <span>Promo ({promoCode})</span>
                  <span>-{formatCurrency(promoDiscount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-green">
                  <span>Points</span>
                  <span>-{formatCurrency(pointsDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-navy">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-light-blue p-4 text-sm">
            <p>
              <span className="font-semibold text-navy">
                {orderType === "DELIVERY" ? "Deliver to: " : "Pickup at: "}
              </span>
              {orderType === "DELIVERY" && address
                ? address.full_address
                : STORE_LOCATION.address}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-navy">Payment: </span>
              {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1 rounded-xl">
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="flex-1 rounded-xl bg-green hover:bg-green/90"
            >
              {placing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing...
                </>
              ) : (
                `Place Order — ${formatCurrency(total)}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

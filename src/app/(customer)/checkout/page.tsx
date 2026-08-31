"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Banknote,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore, formatCartOptions, getCartItemPrice } from "@/stores/cart";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { PURCHASE_SOON_MESSAGE } from "@/lib/settings/types";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";
import { validateCartStock } from "@/lib/cart/stockLimits";
import { fetchCurrentProfile } from "@/services/authService";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  calculateDeliveryFee,
  formatDeliveryRateLabel,
  formatDistanceKm,
} from "@/lib/delivery/pricing";
import { SAMAL_SERVICE_MESSAGE } from "@/lib/delivery/samal";
import {
  formatScheduledDateTime,
  formatWeeklySchedule,
  isScheduledSlotValid,
} from "@/lib/storeHours";
import { ScheduleOrderPicker } from "@/components/customer/ScheduleOrderPicker";
import { QRPhPaymentPanel } from "@/components/customer/QRPhPaymentPanel";
import {
  CodCashPanel,
  parseCodCashInput,
  validateCodCashAmount,
} from "@/components/customer/CodCashPanel";
import { uploadPaymentProof } from "@/services/paymentProofService";
import type { Address, Order, PaymentMethod } from "@/types";

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  icon?: typeof Banknote;
  logoSrc?: string;
}[] = [
  { value: "COD", label: "Cash on Delivery", icon: Banknote },
  {
    value: "QRPH",
    label: "QR Ph",
    logoSrc: "/qrph-logo.png",
  },
];

function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const addOrder = useAppStore((s) => s.addOrder);

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const fulfillmentTiming = useCartStore((s) => s.fulfillmentTiming);
  const scheduledAt = useCartStore((s) => s.scheduledAt);
  const setFulfillmentTiming = useCartStore((s) => s.setFulfillmentTiming);
  const setScheduledAt = useCartStore((s) => s.setScheduledAt);
  const promoCode = useCartStore((s) => s.promoCode);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const pointsDiscount = useCartStore((s) => s.pointsDiscount);
  const pointsToUse = useCartStore((s) => s.pointsToUse);
  const setDeliveryLocation = useCartStore((s) => s.setDeliveryLocation);
  const clearCart = useCartStore((s) => s.clearCart);
  const normalizeCart = useCartStore((s) => s.normalizeCart);
  const products = useDataStore((s) => s.products);
  const inventory = useDataStore((s) => s.inventory);
  const catalogHydrated = useDataStore((s) => s.hydrated);
  const { subtotal, deliveryQuote, deliveryFee, total } = useCartTotals();
  const { purchaseSoon, storeOpen, storeClosedMessage, storeHours, store, delivery, loading: settingsLoading } =
    useStoreSettings();
  const hoursLabel = formatWeeklySchedule(storeHours);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRPH");
  const [codCashAmount, setCodCashAmount] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(
    null
  );
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAddressesLoading(true);
      try {
        const res = await fetch("/api/me/addresses", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as {
          addresses?: Address[];
        } | null;
        if (cancelled) return;
        const list = data?.addresses ?? [];
        setAddresses(list);
        const preferred =
          list.find((a) => a.is_default)?.id ?? list[0]?.id ?? "";
        setSelectedAddress(preferred);
      } catch {
        if (!cancelled) setAddresses([]);
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const addr = addresses.find((a) => a.id === selectedAddress);
    if (!addr) return;
    if (addr.latitude != null && addr.longitude != null) {
      setDeliveryLocation(
        { lat: addr.latitude, lng: addr.longitude },
        addr.label
      );
    }
  }, [selectedAddress, addresses, setDeliveryLocation]);

  useEffect(() => {
    if (!catalogHydrated) return;
    normalizeCart();
  }, [normalizeCart, products, inventory, catalogHydrated]);

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

  if (!settingsLoading && purchaseSoon) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold text-navy">Checkout unavailable</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {PURCHASE_SOON_MESSAGE}
        </p>
        <Link
          href="/cart"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green/90"
        >
          Back to Cart
        </Link>
      </div>
    );
  }

  const address = addresses.find((a) => a.id === selectedAddress);

  const resetPaymentProof = () => {
    setPaymentProofUrl(null);
    if (paymentProofPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(paymentProofPreview);
    }
    setPaymentProofPreview(null);
  };

  const handlePaymentProofSelect = async (file: File) => {
    let activeUser = user;
    if (!activeUser) {
      activeUser = await fetchCurrentProfile();
      if (activeUser) useAuthStore.getState().setUser(activeUser);
    }
    if (!activeUser) {
      toast.error("Please sign in to upload payment proof.");
      router.push("/login?next=/checkout");
      return;
    }

    if (paymentProofPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(paymentProofPreview);
    }
    setPaymentProofPreview(URL.createObjectURL(file));
    setUploadingPaymentProof(true);
    try {
      const uploaded = await uploadPaymentProof(file, activeUser.id);
      if ("error" in uploaded) {
        toast.error(uploaded.error);
        resetPaymentProof();
        return;
      }
      setPaymentProofUrl(uploaded.publicUrl);
      toast.success("Payment proof uploaded.");
    } finally {
      setUploadingPaymentProof(false);
    }
  };

  const finishOrder = (order: Order) => {
    addOrder(order);

    clearCart();
    toast.success("Order placed successfully!");
    router.push(`/orders/${order.id}`);
  };

  const handlePlaceOrder = async () => {
    if (purchaseSoon) {
      toast.error(PURCHASE_SOON_MESSAGE);
      return;
    }
    if (fulfillmentTiming === "ASAP" && !storeOpen) {
      toast.error(storeClosedMessage);
      return;
    }
    if (fulfillmentTiming === "SCHEDULED") {
      if (!scheduledAt) {
        toast.error("Please choose when you want your order.");
        return;
      }
      if (!isScheduledSlotValid(storeHours, new Date(scheduledAt))) {
        toast.error("That schedule time is no longer available. Pick another slot.");
        return;
      }
    }
    // Session cookie can exist while the auth store is still empty — refresh first.
    let activeUser = user;
    if (!activeUser) {
      activeUser = await fetchCurrentProfile();
      if (activeUser) useAuthStore.getState().setUser(activeUser);
    }
    if (!activeUser) {
      toast.error("Please sign in to place an order");
      router.push("/login?next=/checkout");
      return;
    }
    if (orderType === "DELIVERY" && !address) {
      toast.error("Add a delivery address on your Profile first.");
      return;
    }
    if (
      orderType === "DELIVERY" &&
      (address?.latitude == null ||
        address?.longitude == null ||
        !deliveryQuote.withinRadius)
    ) {
      toast.error(SAMAL_SERVICE_MESSAGE);
      return;
    }

    let codAmount: number | undefined;
    if (paymentMethod === "COD") {
      const cashCheck = validateCodCashAmount(codCashAmount, total);
      if (!cashCheck.ok) {
        toast.error(cashCheck.message);
        return;
      }
      codAmount = cashCheck.amount;
    }

    if (paymentMethod === "QRPH" && !paymentProofUrl) {
      toast.error("Upload proof of payment before placing your order.");
      return;
    }

    normalizeCart();
    const latestItems = useCartStore.getState().items;
    const stockCheck = validateCartStock(latestItems, products, inventory);
    if (!stockCheck.ok) {
      toast.error(stockCheck.message);
      router.push("/cart");
      return;
    }

    const payload = {
      orderType,
      paymentMethod,
      addressId: address?.id,
      fullAddress: address?.full_address,
      latitude: address?.latitude ?? undefined,
      longitude: address?.longitude ?? undefined,
      deliveryInstructions:
        instructions || address?.delivery_instructions || undefined,
      items: latestItems.map((item) => ({
        ...item,
        productImage: item.productImage ?? null,
        options: (item.options ?? []).map((o) => ({
          ...o,
          priceAdjustment: o.priceAdjustment ?? 0,
        })),
        addons: (item.addons ?? []).map((a) => ({
          ...a,
          price: a.price ?? 0,
          quantity: a.quantity ?? 1,
        })),
      })),
      deliveryFee,
      subtotal,
      discount: promoDiscount ?? 0,
      pointsDiscount: pointsDiscount ?? 0,
      pointsUsed: pointsToUse ?? 0,
      promoCode: promoCode ?? null,
      scheduledAt:
        fulfillmentTiming === "SCHEDULED" ? scheduledAt : null,
      codCashAmount: codAmount,
      paymentProofUrl:
        paymentMethod === "QRPH" ? paymentProofUrl ?? undefined : undefined,
    };

    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        order?: Order;
        error?: string;
      } | null;

      if (res.status === 401) {
        toast.error("Please sign in to place an order");
        router.push("/login?next=/checkout");
        return;
      }

      if (!res.ok || !data?.order) {
        toast.error(
          data?.error ||
            "Could not save order to Supabase. Use products from the live menu and try again."
        );
        return;
      }

      finishOrder(data.order);
    } catch {
      toast.error("Could not reach order API. Please try again.");
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
          <ScheduleOrderPicker
            storeHours={storeHours}
            fulfillmentTiming={fulfillmentTiming}
            scheduledAt={scheduledAt}
            storeOpen={storeOpen}
            onTimingChange={setFulfillmentTiming}
            onScheduledAtChange={setScheduledAt}
          />
          {orderType === "PICKUP" && (
            <div className="rounded-2xl bg-light-blue p-4 text-sm">
              <p className="font-semibold text-navy">{store.name}</p>
              <p className="mt-1 text-muted-foreground">{store.address}</p>
              <p className="mt-1 text-muted-foreground">{hoursLabel}</p>
            </div>
          )}
          <Button
            onClick={() => setStep(2)}
            disabled={
              fulfillmentTiming === "SCHEDULED" &&
              (!scheduledAt ||
                !isScheduledSlotValid(storeHours, new Date(scheduledAt)))
            }
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
              {addressesLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading addresses…
                </div>
              ) : addresses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-white p-5 text-center shadow-card">
                  <MapPin className="mx-auto h-8 w-8 text-sky" />
                  <p className="mt-2 text-sm font-medium text-navy">
                    No saved addresses
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add up to 3 delivery addresses on your Profile.
                  </p>
                  <Link
                    href="/profile"
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-green px-4 text-sm font-medium text-white hover:bg-green/90"
                  >
                    Manage addresses
                  </Link>
                </div>
              ) : (
                <RadioGroup
                  value={selectedAddress}
                  onValueChange={(v) => v && setSelectedAddress(v)}
                  className="space-y-3"
                >
                  {addresses.map((addr) => {
                    const hasCoords =
                      addr.latitude != null && addr.longitude != null;
                    const quote = hasCoords
                      ? calculateDeliveryFee(
                          { lat: addr.latitude!, lng: addr.longitude! },
                          subtotal,
                          delivery,
                          store
                        )
                      : null;
                    return (
                      <label
                        key={addr.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors",
                          selectedAddress === addr.id
                            ? "border-green bg-green/5"
                            : "border-border bg-white shadow-card",
                          quote && !quote.withinRadius && "opacity-70"
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
                              {addr.is_default && (
                                <span className="text-[10px] font-semibold uppercase text-sky">
                                  Default
                                </span>
                              )}
                            </div>
                            {quote && (
                              <span className="shrink-0 text-xs font-semibold text-navy">
                                {quote.withinRadius
                                  ? quote.isFree
                                    ? "Free"
                                    : formatCurrency(quote.fee)
                                  : "Outside Samal"}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {addr.full_address}
                          </p>
                          {quote && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {quote.withinRadius
                                ? `${formatDistanceKm(quote.distanceKm)} from store · ~${quote.estimatedMinutes} min`
                                : SAMAL_SERVICE_MESSAGE}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
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
                orderType === "DELIVERY" &&
                (addresses.length === 0 ||
                  !selectedAddress ||
                  !address ||
                  address.latitude == null ||
                  address.longitude == null ||
                  deliveryQuote.withinRadius === false)
              }
              className="flex-1 rounded-xl bg-green hover:bg-green/90"
            >
              Continue
            </Button>
          </div>
          {orderType === "DELIVERY" &&
            address &&
            (address.latitude == null ||
              address.longitude == null ||
              !deliveryQuote.withinRadius) && (
            <p className="text-center text-xs text-destructive">
              {SAMAL_SERVICE_MESSAGE} Edit the address pin on your Profile.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">Payment Method</h2>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => {
              if (!v) return;
              setPaymentMethod(v as PaymentMethod);
              if (v !== "COD") setCodCashAmount("");
              if (v !== "QRPH") resetPaymentProof();
            }}
            className="space-y-3"
          >
            {PAYMENT_METHODS.map(({ value, label, icon: Icon, logoSrc }) => (
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
                {logoSrc ? (
                  <Image
                    src={logoSrc}
                    alt={label}
                    width={80}
                    height={28}
                    className="h-7 w-auto object-contain"
                  />
                ) : Icon ? (
                  <Icon className="h-5 w-5 text-sky" />
                ) : null}
                <span className="font-medium text-navy">{label}</span>
              </label>
            ))}
          </RadioGroup>
          {paymentMethod === "QRPH" && (
            <QRPhPaymentPanel
              amount={total}
              proofPreviewUrl={paymentProofPreview}
              onProofFileSelect={(file) => void handlePaymentProofSelect(file)}
              uploadingProof={uploadingPaymentProof}
            />
          )}
          {paymentMethod === "COD" && (
            <CodCashPanel
              total={total}
              value={codCashAmount}
              onChange={setCodCashAmount}
            />
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 rounded-xl">
              Back
            </Button>
            <Button
              onClick={() => {
                if (paymentMethod === "COD") {
                  const cashCheck = validateCodCashAmount(codCashAmount, total);
                  if (!cashCheck.ok) {
                    toast.error(cashCheck.message);
                    return;
                  }
                }
                if (paymentMethod === "QRPH") {
                  if (uploadingPaymentProof) {
                    toast.error("Wait for the payment proof upload to finish.");
                    return;
                  }
                  if (!paymentProofUrl) {
                    toast.error("Upload proof of payment before continuing.");
                    return;
                  }
                }
                setStep(4);
              }}
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
                  {formatDeliveryRateLabel(delivery)} ·{" "}
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
                : store.address}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-navy">When: </span>
              {fulfillmentTiming === "SCHEDULED" && scheduledAt
                ? formatScheduledDateTime(scheduledAt, storeHours.timezone)
                : "As soon as possible"}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-navy">Payment: </span>
              {paymentMethodLabel(paymentMethod)}
            </p>
          </div>

          {paymentMethod === "QRPH" && (
            <QRPhPaymentPanel
              amount={total}
              proofPreviewUrl={paymentProofPreview}
              readOnly
            />
          )}

          {paymentMethod === "COD" && (
            <CodCashPanel
              total={total}
              value={codCashAmount}
              onChange={setCodCashAmount}
              readOnly
              cashAmount={parseCodCashInput(codCashAmount)}
            />
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1 rounded-xl">
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={
                placing ||
                authInitializing ||
                uploadingPaymentProof ||
                (paymentMethod === "QRPH" && !paymentProofUrl)
              }
              className="flex-1 rounded-xl bg-green hover:bg-green/90"
            >
              {placing || authInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {authInitializing ? "Checking session..." : "Placing..."}
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

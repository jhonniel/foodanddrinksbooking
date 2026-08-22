"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCartStore,
  getCartItemPrice,
  formatCartOptions,
} from "@/stores/cart";
import { useCartTotals } from "@/hooks/useCartTotals";
import { validatePromoCode } from "@/services/productService";
import { formatCurrency } from "@/lib/utils/format";
import { useDataStore } from "@/stores/data";
import { DELIVERY_CONFIG } from "@/data/demo";
import {
  formatDeliveryRateLabel,
  formatDistanceKm,
} from "@/lib/delivery/pricing";

export default function CartPage() {
  const searchParams = useSearchParams();
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const normalizeCart = useCartStore((s) => s.normalizeCart);
  const setPromo = useCartStore((s) => s.setPromo);
  const products = useDataStore((s) => s.products);
  const inventory = useDataStore((s) => s.inventory);
  const catalogHydrated = useDataStore((s) => s.hydrated);
  const {
    items,
    itemCount,
    promoCode,
    promoDiscount,
    orderType,
    subtotal,
    deliveryQuote,
    deliveryFee,
    total,
  } = useCartTotals();

  const [codeInput, setCodeInput] = useState(promoCode ?? "");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("code")?.trim();
    if (fromUrl) setCodeInput(fromUrl.toUpperCase());
  }, [searchParams]);

  const handleApplyPromo = async () => {
    if (!codeInput.trim()) return;
    setApplying(true);
    const result = await validatePromoCode(codeInput.trim(), subtotal);
    setApplying(false);
    if (result.valid) {
      setPromo(codeInput.trim().toUpperCase(), result.discount);
      toast.success("Promo code applied!");
    } else {
      setPromo(null, 0);
      toast.error(result.error ?? "Invalid promo code");
    }
  };

  const handleRemovePromo = () => {
    setCodeInput("");
    setPromo(null, 0);
  };

  useEffect(() => {
    if (!catalogHydrated) return;
    normalizeCart();
  }, [normalizeCart, products, inventory, catalogHydrated]);

  const handleIncreaseQuantity = (item: (typeof items)[number]) => {
    updateQuantity(item.id, item.quantity + 1);
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add some refreshing drinks from our menu"
        actionLabel="Browse Menu"
        onAction={() => (window.location.href = "/menu")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-navy">Your Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 rounded-2xl bg-white p-3 shadow-card"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-light-blue">
              {item.productImage && (
                <Image
                  src={item.productImage}
                  alt={item.productName}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy">{item.productName}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatCartOptions(item.options, item.addons)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.productName}`}
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-1 py-0.5">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-navy"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => handleIncreaseQuantity(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-navy"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="font-bold text-navy">
                  {formatCurrency(getCartItemPrice(item))}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <p className="mb-1 text-sm font-semibold text-navy">Promo Code</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Redeem a code on Rewards first, or apply a saved voucher here.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Enter code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            className="h-11 rounded-xl"
          />
          {promoCode ? (
            <Button
              variant="outline"
              onClick={handleRemovePromo}
              className="h-11 shrink-0 rounded-xl"
            >
              Remove
            </Button>
          ) : (
            <Button
              onClick={handleApplyPromo}
              disabled={applying || !codeInput.trim()}
              className="h-11 shrink-0 rounded-xl bg-green hover:bg-green/90"
            >
              Apply
            </Button>
          )}
        </div>
        {promoCode && (
          <p className="mt-2 text-xs text-green">
            {promoCode} applied — {formatCurrency(promoDiscount)} off
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 font-semibold text-navy">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-navy">{formatCurrency(subtotal)}</span>
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
            <span className="font-medium text-navy">
              {orderType === "PICKUP" || deliveryFee === 0 ? (
                <span className="text-green">Free</span>
              ) : (
                formatCurrency(deliveryFee)
              )}
            </span>
          </div>
          {orderType === "DELIVERY" && deliveryFee > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatDeliveryRateLabel()}
            </p>
          )}
          {promoDiscount > 0 && (
            <div className="flex justify-between text-green">
              <span>Discount</span>
              <span>-{formatCurrency(promoDiscount)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2">
            <div className="flex justify-between text-base font-bold text-navy">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        {orderType === "DELIVERY" &&
          subtotal < DELIVERY_CONFIG.freeAbove &&
          deliveryFee > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Add {formatCurrency(DELIVERY_CONFIG.freeAbove - subtotal)} more
              for free delivery
            </p>
          )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-md lg:bottom-0">
        <Link
          href="/checkout"
          className="mx-auto flex h-12 w-full max-w-lg items-center justify-center rounded-xl bg-green text-base font-bold text-white hover:bg-green/90"
        >
          CHECKOUT — {formatCurrency(total)}
        </Link>
      </div>
    </div>
  );
}

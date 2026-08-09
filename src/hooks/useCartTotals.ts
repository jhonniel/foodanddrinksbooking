"use client";

import { useMemo } from "react";
import { useCartStore, getCartItemPrice } from "@/stores/cart";
import {
  calculateDeliveryFee,
  type DeliveryQuote,
} from "@/lib/delivery/pricing";
import { LOYALTY_SETTINGS } from "@/data/demo";

const PICKUP_QUOTE: DeliveryQuote = {
  distanceKm: 0,
  fee: 0,
  isFree: true,
  withinRadius: true,
  estimatedMinutes: 15,
  breakdown: { baseFee: 0, distanceFee: 0, succeedingKm: 0 },
};

/**
 * Stable cart totals for React 19 / useSyncExternalStore.
 * Do NOT call store methods like `s.deliveryQuote()` inside zustand selectors —
 * they return new objects every time and cause infinite re-renders.
 */
export function useCartTotals() {
  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const deliveryLocation = useCartStore((s) => s.deliveryLocation);
  const promoCode = useCartStore((s) => s.promoCode);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const pointsDiscount = useCartStore((s) => s.pointsDiscount);
  const pointsToUse = useCartStore((s) => s.pointsToUse);

  return useMemo(() => {
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + getCartItemPrice(i), 0);
    const deliveryQuote =
      orderType === "PICKUP"
        ? PICKUP_QUOTE
        : calculateDeliveryFee(deliveryLocation, subtotal);
    const deliveryFee = deliveryQuote.fee;
    const total = Math.max(
      0,
      subtotal + deliveryFee - promoDiscount - pointsDiscount
    );
    const pointsEarned = Math.floor(
      total * LOYALTY_SETTINGS.points_per_peso
    );

    return {
      items,
      itemCount,
      orderType,
      subtotal,
      deliveryQuote,
      deliveryFee,
      promoCode,
      promoDiscount,
      pointsDiscount,
      pointsToUse,
      total,
      pointsEarned,
    };
  }, [
    items,
    orderType,
    deliveryLocation,
    promoCode,
    promoDiscount,
    pointsDiscount,
    pointsToUse,
  ]);
}

export function useCartItemCount() {
  return useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.quantity, 0)
  );
}

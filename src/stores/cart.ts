import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CartItemAddon, CartItemOption } from "@/types";
import { DELIVERY_CONFIG } from "@/data/demo";
import { calculateOrderPointsEarned } from "@/services/loyaltyService";
import {
  calculateDeliveryFee,
  type DeliveryQuote,
  type LatLng,
} from "@/lib/delivery/pricing";

interface CartState {
  items: CartItem[];
  promoCode: string | null;
  promoDiscount: number;
  pointsToUse: number;
  pointsDiscount: number;
  orderType: "DELIVERY" | "PICKUP";
  deliveryLocation: LatLng | null;
  deliveryAddressLabel: string | null;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setPromo: (code: string | null, discount: number) => void;
  setPointsToUse: (points: number, discount: number) => void;
  setOrderType: (type: "DELIVERY" | "PICKUP") => void;
  setDeliveryLocation: (
    location: LatLng | null,
    label?: string | null
  ) => void;
  itemCount: () => number;
  subtotal: () => number;
  deliveryQuote: () => DeliveryQuote;
  deliveryFee: () => number;
  deliveryDistanceKm: () => number;
  total: () => number;
  pointsEarned: () => number;
}

function itemUnitPrice(item: CartItem): number {
  const optionsTotal = (item.options ?? []).reduce(
    (s, o) => s + (o.priceAdjustment ?? 0),
    0
  );
  const addonsTotal = (item.addons ?? []).reduce(
    (s, a) => s + (a.price ?? 0) * (a.quantity ?? 1),
    0
  );
  return (item.basePrice ?? 0) + optionsTotal + addonsTotal;
}

export function getCartItemPrice(item: CartItem): number {
  return itemUnitPrice(item) * item.quantity;
}

export function formatCartOptions(
  options: CartItemOption[],
  addons: CartItemAddon[]
): string {
  const parts = [
    ...options.map((o) => o.valueName),
    ...addons.map((a) =>
      a.quantity > 1 ? `${a.name} x${a.quantity}` : a.name
    ),
  ];
  return parts.join(" · ");
}

/** Default: no pin until user confirms Samal location */
const DEFAULT_DELIVERY: LatLng | null = null;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      promoDiscount: 0,
      pointsToUse: 0,
      pointsDiscount: 0,
      orderType: "DELIVERY",
      deliveryLocation: DEFAULT_DELIVERY,
      deliveryAddressLabel: null,

      addItem: (item) => {
        const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ items: [...s.items, { ...item, id }] }));
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        }));
      },

      clearCart: () =>
        set({
          items: [],
          promoCode: null,
          promoDiscount: 0,
          pointsToUse: 0,
          pointsDiscount: 0,
          orderType: "DELIVERY",
          deliveryLocation: DEFAULT_DELIVERY,
          deliveryAddressLabel: null,
        }),

      setPromo: (code, discount) =>
        set({ promoCode: code, promoDiscount: discount }),

      setPointsToUse: (points, discount) =>
        set({ pointsToUse: points, pointsDiscount: discount }),

      setOrderType: (orderType) => set({ orderType }),

      setDeliveryLocation: (location, label = null) =>
        set({
          deliveryLocation: location,
          deliveryAddressLabel: label,
        }),

      itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),

      subtotal: () => get().items.reduce((s, i) => s + getCartItemPrice(i), 0),

      deliveryQuote: () => {
        const { orderType, deliveryLocation, subtotal } = get();
        if (orderType === "PICKUP") {
          return {
            distanceKm: 0,
            fee: 0,
            isFree: true,
            withinRadius: true,
            estimatedMinutes: 15,
            breakdown: { baseFee: 0, distanceFee: 0, succeedingKm: 0 },
          };
        }
        return calculateDeliveryFee(deliveryLocation, subtotal());
      },

      deliveryFee: () => get().deliveryQuote().fee,

      deliveryDistanceKm: () => get().deliveryQuote().distanceKm,

      total: () => {
        const { subtotal, deliveryFee, promoDiscount, pointsDiscount } = get();
        return Math.max(
          0,
          subtotal() + deliveryFee() - promoDiscount - pointsDiscount
        );
      },

      pointsEarned: () => {
        const { promoDiscount, pointsDiscount, subtotal } = get();
        return calculateOrderPointsEarned({
          subtotal: subtotal(),
          discount: promoDiscount,
          pointsDiscount,
        });
      },
    }),
    { name: "island-coolers-cart-v3" }
  )
);

export { DELIVERY_CONFIG };

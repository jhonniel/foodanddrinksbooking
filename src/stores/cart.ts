import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";
import type { CartItem, CartItemAddon, CartItemOption } from "@/types";
import { DELIVERY_CONFIG } from "@/data/demo";
import { calculateOrderPointsEarned } from "@/services/loyaltyService";
import {
  calculateDeliveryFee,
  type DeliveryQuote,
  type LatLng,
} from "@/lib/delivery/pricing";
import {
  cartItemSignature,
  consolidateCartItems,
} from "@/lib/cartHelpers";
import {
  clampCartToStockLimits,
  getCartProductQuantity,
  getProductCanMake,
  maxStockToastMessage,
  resolveProductForStock,
  unavailableStockToastMessage,
  type ProductStockSource,
} from "@/lib/cart/stockLimits";
import { useDataStore } from "@/stores/data";

interface CartState {
  items: CartItem[];
  promoCode: string | null;
  promoDiscount: number;
  pointsToUse: number;
  pointsDiscount: number;
  orderType: "DELIVERY" | "PICKUP";
  deliveryLocation: LatLng | null;
  deliveryAddressLabel: string | null;
  addItem: (
    item: Omit<CartItem, "id">,
    sourceProduct?: ProductStockSource
  ) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  normalizeCart: () => void;
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

function getCatalogState() {
  const { products, inventory, hydrated } = useDataStore.getState();
  return { products, inventory, hydrated };
}

function applyStockRules(items: CartItem[], strict = true): CartItem[] {
  const { products, inventory, hydrated } = getCatalogState();
  const consolidated = consolidateCartItems(items);
  if (!hydrated) return consolidated;
  return clampCartToStockLimits(consolidated, products, inventory, {
    keepUnknownProducts: !strict,
  });
}

export const CART_STORAGE_KEY = "island-coolers-cart-v4";

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

      addItem: (item, sourceProduct) => {
        const { products, inventory } = getCatalogState();
        const product = resolveProductForStock(
          item.productId,
          products,
          sourceProduct
        );
        const qtyRequested = Math.max(1, item.quantity ?? 1);
        const signature = cartItemSignature(item);
        let capped = false;
        let added = false;

        if (!product) {
          toast.error(unavailableStockToastMessage(item.productName));
          return false;
        }

        set((s) => {
          let items = consolidateCartItems(s.items);
          const existing = items.find((i) => cartItemSignature(i) === signature);
          const inCart = getCartProductQuantity(items, item.productId);
          const canMake = getProductCanMake(product, inventory);
          const remaining = Math.max(0, canMake - inCart);

          if (remaining <= 0) {
            capped = true;
            return { items };
          }

          const qtyToAdd = Math.min(qtyRequested, remaining);
          if (qtyToAdd < qtyRequested) capped = true;
          if (qtyToAdd <= 0) {
            capped = true;
            return { items };
          }

          added = true;

          if (existing) {
            items = items.map((i) =>
              i.id === existing.id
                ? { ...i, quantity: i.quantity + qtyToAdd }
                : i
            );
          } else {
            const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            items = [...items, { ...item, quantity: qtyToAdd, id }];
          }

          return { items: clampCartToStockLimits(items, products, inventory) };
        });

        if (capped) {
          toast.error(maxStockToastMessage(product.name));
        }

        return added;
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const { products, inventory } = getCatalogState();
        let capped = false;
        let productName = "";

        set((s) => {
          let items = consolidateCartItems(s.items);
          const item = items.find((i) => i.id === id);
          if (!item) return { items };

          const product = resolveProductForStock(item.productId, products);
          if (!product) {
            if (quantity > item.quantity) {
              capped = true;
              productName = item.productName;
            }
            return { items };
          }

          productName = product.name;
          const otherQty = getCartProductQuantity(items, item.productId, id);
          const maxForLine = Math.max(
            0,
            getProductCanMake(product, inventory) - otherQty
          );
          const cappedQty = Math.min(quantity, maxForLine);
          if (cappedQty < quantity) capped = true;

          items = items.map((i) =>
            i.id === id ? { ...i, quantity: cappedQty } : i
          );
          return { items: clampCartToStockLimits(items, products, inventory) };
        });

        if (capped && productName) {
          toast.error(maxStockToastMessage(productName));
        }
      },

      normalizeCart: () => {
        const { hydrated } = getCatalogState();
        if (!hydrated) return;
        set((s) => ({
          items: applyStockRules(s.items, true),
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
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        promoCode: state.promoCode,
        promoDiscount: state.promoDiscount,
        pointsToUse: state.pointsToUse,
        pointsDiscount: state.pointsDiscount,
        orderType: state.orderType,
        deliveryLocation: state.deliveryLocation,
        deliveryAddressLabel: state.deliveryAddressLabel,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { hydrated } = useDataStore.getState();
        if (hydrated) {
          queueMicrotask(() => useCartStore.getState().normalizeCart());
        }
      },
    }
  )
);

export { DELIVERY_CONFIG };

import {
  getProductMakeable,
  getProductStockStatus,
} from "@/lib/inventory/availability";
import type { CartItem, InventoryItem, Product } from "@/types";

export function getCartProductQuantity(
  cartItems: Pick<CartItem, "id" | "productId" | "quantity">[],
  productId: string,
  excludeCartItemId?: string
): number {
  return cartItems
    .filter(
      (item) =>
        item.productId === productId &&
        (excludeCartItemId == null || item.id !== excludeCartItemId)
    )
    .reduce((sum, item) => sum + item.quantity, 0);
}

/** Same "Can make" count shown on admin products — max units from recipe × inventory. */
export function getProductCanMake(
  product: Pick<Product, "recipes" | "is_available">,
  inventory: InventoryItem[]
): number {
  if (!product.is_available) return 0;
  return getProductMakeable(product, inventory);
}

/** @deprecated Use getProductCanMake */
export const getProductStockCap = getProductCanMake;

/** How many more units can still be added to the cart (can make minus already in cart). */
export function getRemainingPurchasable(
  product: Pick<Product, "id" | "recipes" | "is_available">,
  inventory: InventoryItem[],
  cartItems: Pick<CartItem, "id" | "productId" | "quantity">[],
  excludeCartItemId?: string
): number {
  const canMake = getProductCanMake(product, inventory);
  const inCart = getCartProductQuantity(
    cartItems,
    product.id,
    excludeCartItemId
  );
  return Math.max(0, canMake - inCart);
}

/** Max quantity allowed for a single cart line (same product may appear on multiple lines). */
export function getMaxQuantityForCartLine(
  product: Pick<Product, "id" | "recipes" | "is_available">,
  inventory: InventoryItem[],
  cartItems: Pick<CartItem, "id" | "productId" | "quantity">[],
  cartItemId: string
): number {
  const item = cartItems.find((i) => i.id === cartItemId);
  if (!item) return 0;
  const canMake = getProductCanMake(product, inventory);
  const otherLines = getCartProductQuantity(
    cartItems,
    item.productId,
    cartItemId
  );
  return Math.max(0, canMake - otherLines);
}

export function maxStockToastMessage(productName: string): string {
  return `You've reached the available capacity for ${productName}.`;
}

export function unavailableStockToastMessage(productName: string): string {
  return `${productName} is currently unavailable.`;
}

/** Trim cart lines so total per product never exceeds can-make. */
export function clampCartToStockLimits(
  items: CartItem[],
  products: Product[],
  inventory: InventoryItem[]
): CartItem[] {
  const usedByProduct = new Map<string, number>();
  const result: CartItem[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      result.push(item);
      continue;
    }

    const canMake = getProductCanMake(product, inventory);
    const used = usedByProduct.get(item.productId) ?? 0;
    const room = Math.max(0, canMake - used);
    if (room <= 0) continue;

    const quantity = Math.min(item.quantity, room);
    usedByProduct.set(item.productId, used + quantity);
    result.push({ ...item, quantity });
  }

  return result;
}

/** True when product has a recipe and can-make is computed. */
export function productHasMakeableStock(
  product: Pick<Product, "recipes">,
  inventory: InventoryItem[]
): boolean {
  return getProductStockStatus(product, inventory).level !== "no_recipe";
}

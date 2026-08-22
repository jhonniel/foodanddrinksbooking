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

export type ProductStockSource = Pick<
  Product,
  "id" | "name" | "recipes" | "is_available"
>;

export function resolveProductForStock(
  productId: string,
  products: Product[],
  sourceProduct?: ProductStockSource
): ProductStockSource | undefined {
  if (sourceProduct && sourceProduct.id === productId) return sourceProduct;
  return products.find((product) => product.id === productId);
}

export function getAddableQuantity(
  product: ProductStockSource,
  inventory: InventoryItem[],
  cartItems: Pick<CartItem, "id" | "productId" | "quantity">[],
  quantityRequested: number
): number {
  const inCart = getCartProductQuantity(cartItems, product.id);
  const canMake = getProductCanMake(product, inventory);
  const remaining = Math.max(0, canMake - inCart);
  return Math.min(Math.max(1, quantityRequested), remaining);
}

export function validateCartStock(
  items: Pick<CartItem, "productId" | "quantity" | "productName">[],
  products: Product[],
  inventory: InventoryItem[]
): { ok: true } | { ok: false; message: string } {
  const neededByProduct = new Map<string, { name: string; quantity: number }>();

  for (const item of items) {
    const existing = neededByProduct.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      neededByProduct.set(item.productId, {
        name: item.productName,
        quantity: item.quantity,
      });
    }
  }

  for (const [productId, { name, quantity }] of neededByProduct) {
    const product = resolveProductForStock(productId, products);
    if (!product) {
      return {
        ok: false,
        message: `${name} is no longer available.`,
      };
    }

    const canMake = getProductCanMake(product, inventory);
    if (canMake <= 0) {
      return {
        ok: false,
        message: unavailableStockToastMessage(product.name),
      };
    }

    if (quantity > canMake) {
      return {
        ok: false,
        message: maxStockToastMessage(product.name),
      };
    }
  }

  return { ok: true };
}

/** Trim cart lines so total per product never exceeds can-make. */
export function clampCartToStockLimits(
  items: CartItem[],
  products: Product[],
  inventory: InventoryItem[],
  options?: { keepUnknownProducts?: boolean }
): CartItem[] {
  const usedByProduct = new Map<string, number>();
  const result: CartItem[] = [];

  for (const item of items) {
    const product = resolveProductForStock(item.productId, products);
    if (!product) {
      if (options?.keepUnknownProducts) {
        result.push(item);
      }
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

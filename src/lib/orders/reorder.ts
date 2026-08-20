import { isProductOrderable } from "@/lib/inventory/availability";
import type { CartItem, InventoryItem, OrderItem, Product } from "@/types";

export function getUnavailableReorderItems(
  items: OrderItem[],
  products: Product[],
  inventory: InventoryItem[]
): string[] {
  const unavailable: string[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id);
    if (!product || !isProductOrderable(product, inventory)) {
      unavailable.push(item.product_name);
    }
  }

  return unavailable;
}

export function canReorderItems(
  items: OrderItem[],
  products: Product[],
  inventory: InventoryItem[]
): boolean {
  if (!items.length) return false;
  return getUnavailableReorderItems(items, products, inventory).length === 0;
}

export function orderItemToCartItem(item: OrderItem): Omit<CartItem, "id"> {
  return {
    productId: item.product_id,
    productName: item.product_name,
    productImage: item.product_image_url,
    basePrice: item.unit_price,
    quantity: item.quantity,
    options: (item.options ?? []).map((o) => ({
      optionId: o.id,
      optionName: o.option_name,
      valueId: o.id,
      valueName: o.value_name,
      priceAdjustment: o.price_adjustment,
    })),
    addons: (item.addons ?? []).map((a) => ({
      addonId: a.id,
      name: a.addon_name,
      price: a.price,
      quantity: a.quantity,
    })),
  };
}

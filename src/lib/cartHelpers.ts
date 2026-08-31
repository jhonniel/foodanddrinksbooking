import type { CartItem, CartItemAddon, CartItemMixComponent, CartItemOption, Product } from "@/types";

export function cartItemSignature(
  item: Pick<CartItem, "productId" | "options" | "addons" | "mixComponents">
): string {
  const optionsKey = [...(item.options ?? [])]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((o) => `${o.optionId}:${o.valueId}`)
    .join("|");
  const addonsKey = [...(item.addons ?? [])]
    .sort((a, b) => a.addonId.localeCompare(b.addonId))
    .map((a) => `${a.addonId}:${a.quantity}`)
    .join("|");
  const mixKey = [...(item.mixComponents ?? [])]
    .map((m) => m.productId)
    .sort()
    .join("|");
  return `${item.productId}::${optionsKey}::${addonsKey}::${mixKey}`;
}

/** Merge separate lines that are the same product + options + add-ons. */
export function consolidateCartItems(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  for (const item of items) {
    const key = cartItemSignature(item);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
      });
    } else {
      merged.set(key, { ...item });
    }
  }

  return Array.from(merged.values());
}

export function buildDefaultCartItem(
  product: Product,
  quantity = 1
): Omit<CartItem, "id"> {
  const options: CartItemOption[] = (product.options ?? [])
    .map((opt) => {
      const val =
        opt.values?.find((v) => v.is_default) ?? opt.values?.[0];
      if (!val) return null;
      return {
        optionId: opt.id,
        optionName: opt.display_name,
        valueId: val.id,
        valueName: val.name,
        priceAdjustment: val.price_adjustment ?? 0,
      };
    })
    .filter((o): o is CartItemOption => o != null);

  return {
    productId: product.id,
    productName: product.name,
    productImage: product.image_url ?? null,
    basePrice: product.base_price,
    quantity,
    options,
    addons: [],
  };
}

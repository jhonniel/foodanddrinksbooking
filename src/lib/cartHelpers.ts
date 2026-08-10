import type { CartItem, CartItemOption, Product } from "@/types";

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

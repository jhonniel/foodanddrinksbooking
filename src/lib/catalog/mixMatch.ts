import type { CartItemMixComponent, Category, Product } from "@/types";

export type MixSettings = Pick<
  Product,
  "allows_mix_match" | "mix_max_flavors" | "mix_candidate_ids"
>;

/** Merge category defaults with per-product mix settings (product wins when set). */
export function mergeMixSettingsForProduct(
  product: Product,
  category?: Category | null
): MixSettings {
  const productEnabled = Boolean(product.allows_mix_match);
  const categoryEnabled = Boolean(category?.allows_mix_match);
  const enabled = productEnabled || categoryEnabled;

  const maxFlavors = productEnabled
    ? (product.mix_max_flavors ?? 2)
    : categoryEnabled
      ? (category?.mix_max_flavors ?? 2)
      : 2;

  const productCandidates = product.mix_candidate_ids ?? [];
  const categoryCandidates = category?.mix_candidate_ids ?? [];
  const candidateIds =
    productCandidates.length > 0 ? productCandidates : categoryCandidates;

  return {
    allows_mix_match: enabled,
    mix_max_flavors: maxFlavors,
    mix_candidate_ids: candidateIds,
  };
}

/** Flavors the customer can pick when building a mix for this product. */
export function resolveMixFlavorOptions(
  product: Pick<Product, "id" | "category_id" | "mix_candidate_ids">,
  allProducts: Product[]
): Product[] {
  const configured = product.mix_candidate_ids ?? [];
  const fromIds = configured
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is Product => p != null && p.id !== product.id);

  if (fromIds.length > 0) {
    return fromIds.filter((p) => p.is_available);
  }

  return allProducts.filter(
    (p) =>
      p.id !== product.id &&
      p.category_id === product.category_id &&
      p.is_available
  );
}

/** Flavors the customer can add — excludes the drink they're already viewing. */
export function resolveMixPickerOptions(
  product: Product,
  allProducts: Product[]
): Product[] {
  return resolveMixFlavorOptions(product, allProducts);
}

export function formatMixComponentsLabel(
  components: Pick<CartItemMixComponent, "name">[]
): string {
  if (!components.length) return "";
  return `Mix: ${components.map((c) => c.name).join(" · ")}`;
}

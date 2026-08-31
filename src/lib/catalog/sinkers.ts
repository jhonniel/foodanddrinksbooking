import type { ProductAddon } from "@/types";

/** Merge category sinkers with drink-specific sinkers (drink wins on same name). */
export function mergeSinkersForProduct(
  categorySinkers: ProductAddon[],
  productSinkers: ProductAddon[]
): ProductAddon[] {
  const available = (list: ProductAddon[]) =>
    list.filter((a) => !a.is_global && a.is_available);

  const byName = new Map<string, ProductAddon>();
  for (const addon of available(categorySinkers)) {
    byName.set(addon.name.trim().toLowerCase(), addon);
  }
  for (const addon of available(productSinkers)) {
    byName.set(addon.name.trim().toLowerCase(), addon);
  }

  return [...byName.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
}

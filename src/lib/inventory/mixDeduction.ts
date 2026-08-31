import type { InventoryItem, OrderItemMixComponent, Product, ProductRecipe } from "@/types";

/** Names/SKUs that count as one-per-drink packaging (not doubled when mixing flavors). */
const PACKAGING_NAME =
  /\b(cup|cups|lid|lids|straw|straws|plastic|plastics|bag|bags|takeout|packaging|sleeve|holder|wrapper|container)\b/i;
const PACKAGING_SKU = /^(INV-)?(CUP|LID|STRAW|BAG|PACK|PLAST)/i;

export function isSharedPackagingInventory(
  item: Pick<InventoryItem, "name" | "sku" | "unit">
): boolean {
  if (item.unit === "pcs") {
    if (PACKAGING_NAME.test(item.name)) return true;
    if (item.sku && PACKAGING_SKU.test(item.sku)) return true;
  }
  return false;
}

export type OrderLineForInventory = {
  product_id: string;
  quantity: number;
  mix_components?: Pick<
    OrderItemMixComponent,
    "component_product_id"
  >[];
};

function mixComponentProductIds(
  line: OrderLineForInventory
): string[] {
  const fromMix = (line.mix_components ?? [])
    .map((m) => m.component_product_id)
    .filter(Boolean);
  if (fromMix.length >= 2) return fromMix;
  return [];
}

function addToTotals(
  totals: Map<string, number>,
  inventoryItemId: string,
  amount: number
) {
  if (amount <= 0) return;
  totals.set(inventoryItemId, (totals.get(inventoryItemId) ?? 0) + amount);
}

function applyRecipeLines(
  totals: Map<string, number>,
  recipes: ProductRecipe[],
  lineQty: number,
  mixCount: number,
  inventory: InventoryItem[],
  packagingOnce: Map<string, number>
) {
  const flavorShare = mixCount > 1 ? 1 / mixCount : 1;

  for (const recipe of recipes) {
    const inv = inventory.find((i) => i.id === recipe.inventory_item_id);
    const required = Number(recipe.quantity_required) || 0;
    if (required <= 0) continue;

    if (inv && isSharedPackagingInventory(inv)) {
      const perDrink = required * lineQty;
      const existing = packagingOnce.get(recipe.inventory_item_id);
      packagingOnce.set(
        recipe.inventory_item_id,
        existing != null ? Math.max(existing, perDrink) : perDrink
      );
    } else {
      addToTotals(
        totals,
        recipe.inventory_item_id,
        required * flavorShare * lineQty
      );
    }
  }
}

/**
 * Compute inventory to deduct for one order line.
 * Mix drinks: flavor ingredients from each selected product (split evenly),
 * packaging (cup, straw, lid, etc.) only once per drink.
 */
export function computeInventoryTotalsForLine(
  line: OrderLineForInventory,
  products: Product[],
  inventory: InventoryItem[]
): Map<string, number> {
  const totals = new Map<string, number>();
  const lineQty = Math.max(1, line.quantity || 1);
  const mixIds = mixComponentProductIds(line);
  const packagingOnce = new Map<string, number>();

  if (mixIds.length >= 2) {
    const mixCount = mixIds.length;
    for (const productId of mixIds) {
      const component = products.find((p) => p.id === productId);
      applyRecipeLines(
        totals,
        component?.recipes ?? [],
        lineQty,
        mixCount,
        inventory,
        packagingOnce
      );
    }

    const container = products.find((p) => p.id === line.product_id);
    if (container) {
      for (const recipe of container.recipes ?? []) {
        const inv = inventory.find((i) => i.id === recipe.inventory_item_id);
        if (!inv || !isSharedPackagingInventory(inv)) continue;
        const perDrink = Number(recipe.quantity_required) * lineQty;
        const existing = packagingOnce.get(recipe.inventory_item_id);
        packagingOnce.set(
          recipe.inventory_item_id,
          existing != null ? Math.max(existing, perDrink) : perDrink
        );
      }
    }
  } else {
    const product = products.find((p) => p.id === line.product_id);
    for (const recipe of product?.recipes ?? []) {
      addToTotals(
        totals,
        recipe.inventory_item_id,
        Number(recipe.quantity_required) * lineQty
      );
    }
  }

  for (const [inventoryItemId, amount] of packagingOnce) {
    addToTotals(totals, inventoryItemId, amount);
  }

  return totals;
}

export function computeInventoryTotalsForOrder(
  lines: OrderLineForInventory[],
  products: Product[],
  inventory: InventoryItem[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const lineTotals = computeInventoryTotalsForLine(line, products, inventory);
    for (const [id, amount] of lineTotals) {
      addToTotals(totals, id, amount);
    }
  }
  return totals;
}

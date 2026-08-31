import type { InventoryItem } from "@/types";
import { formatCurrency } from "@/lib/utils/format";

/** Cost per single unit (₱/pcs, ₱/g, etc.) from a batch purchase. */
export function computeCostPerUnit(
  totalPurchaseCost: number,
  quantity: number
): number | null {
  if (!Number.isFinite(totalPurchaseCost) || totalPurchaseCost < 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return totalPurchaseCost / quantity;
}

/** Total value of stock on hand. */
export function inventoryStockValue(item: Pick<
  InventoryItem,
  "current_quantity" | "cost_per_unit"
>): number {
  const qty = item.current_quantity;
  const cost = item.cost_per_unit;
  if (!Number.isFinite(qty) || !Number.isFinite(cost) || qty < 0 || cost < 0) {
    return 0;
  }
  return qty * cost;
}

export function formatCostPerUnit(costPerUnit: number, unit: string): string {
  if (!Number.isFinite(costPerUnit) || costPerUnit <= 0) {
    return "—";
  }
  return `${formatCurrency(costPerUnit)}/${unit}`;
}

export function formatStockValue(item: Pick<
  InventoryItem,
  "current_quantity" | "cost_per_unit"
>): string {
  const value = inventoryStockValue(item);
  if (value <= 0) return "—";
  return formatCurrency(value);
}

/** Sum of on-hand stock value for all inventory rows. */
export function totalInventoryStockValue(
  items: Pick<InventoryItem, "current_quantity" | "cost_per_unit">[]
): number {
  return items.reduce((sum, item) => sum + inventoryStockValue(item), 0);
}

export type RecipeCostLine = {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lineCost: number;
};

/** Ingredient cost to make one unit of a product (recipes × inventory cost_per_unit). */
export function breakdownRecipeCostForOneUnit(
  recipes: Array<{ inventory_item_id: string; quantity_required: number }>,
  inventory: Pick<
    InventoryItem,
    "id" | "name" | "unit" | "cost_per_unit"
  >[]
): { total: number; lines: RecipeCostLine[] } {
  const lines: RecipeCostLine[] = [];

  for (const recipe of recipes) {
    const inv = inventory.find((i) => i.id === recipe.inventory_item_id);
    if (!inv) continue;
    const qty = Number(recipe.quantity_required);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const unitCost = Number(inv.cost_per_unit ?? 0);
    const lineCost = Math.round(qty * unitCost * 100) / 100;
    lines.push({
      inventoryItemId: inv.id,
      name: inv.name,
      quantity: qty,
      unit: inv.unit,
      unitCost,
      lineCost,
    });
  }

  const total = Math.round(lines.reduce((s, l) => s + l.lineCost, 0) * 100) / 100;
  return { total, lines };
}

export function estimateRecipeCostForOneUnit(
  recipes: Array<{ inventory_item_id: string; quantity_required: number }>,
  inventory: Pick<InventoryItem, "id" | "cost_per_unit">[]
): number {
  return breakdownRecipeCostForOneUnit(recipes, inventory).total;
}

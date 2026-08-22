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

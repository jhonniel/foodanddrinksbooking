import { useDataStore } from "@/stores/data";
import type { InventoryItem, OrderItem } from "@/types";

export async function getInventory(): Promise<InventoryItem[]> {
  return useDataStore.getState().inventory;
}

export async function getLowStockItems(): Promise<InventoryItem[]> {
  return useDataStore
    .getState()
    .inventory.filter((i) => i.current_quantity <= i.minimum_stock);
}

/**
 * Deduct product ingredients from inventory when an order is completed.
 * Uses each product's recipe × line quantity. Idempotent per order id.
 */
export async function deductInventoryForOrder(
  orderId: string,
  items: Pick<OrderItem, "product_id" | "quantity">[]
): Promise<{
  success: boolean;
  alreadyDeducted: boolean;
  deductions: { inventoryItemId: string; name: string; amount: number }[];
}> {
  const store = useDataStore.getState();

  if (store.wasOrderInventoryDeducted(orderId)) {
    return { success: true, alreadyDeducted: true, deductions: [] };
  }

  const totals = new Map<string, number>();

  for (const line of items) {
    const product = store.products.find((p) => p.id === line.product_id);
    const recipes = product?.recipes ?? [];
    const qty = Math.max(1, line.quantity || 1);

    for (const recipe of recipes) {
      const amount = recipe.quantity_required * qty;
      totals.set(
        recipe.inventory_item_id,
        (totals.get(recipe.inventory_item_id) ?? 0) + amount
      );
    }
  }

  const deductions: {
    inventoryItemId: string;
    name: string;
    amount: number;
  }[] = [];

  for (const [inventoryItemId, amount] of totals) {
    const item = store.inventory.find((i) => i.id === inventoryItemId);
    if (!item || amount <= 0) continue;
    store.decrementInventory(inventoryItemId, amount);
    deductions.push({
      inventoryItemId,
      name: item.name,
      amount,
    });
  }

  store.markOrderInventoryDeducted(orderId);

  return { success: true, alreadyDeducted: false, deductions };
}

export function isOrderInventoryDeducted(orderId: string): boolean {
  return useDataStore.getState().wasOrderInventoryDeducted(orderId);
}

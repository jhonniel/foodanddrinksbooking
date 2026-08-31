import { useDataStore } from "@/stores/data";
import type { InventoryItem, OrderItem, Product } from "@/types";
import { getProductStockStatus } from "@/lib/inventory/availability";
import { syncProduct } from "@/services/catalogService";

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

export async function getInventory(): Promise<InventoryItem[]> {
  return useDataStore.getState().inventory;
}

export async function getLowStockItems(): Promise<InventoryItem[]> {
  return useDataStore
    .getState()
    .inventory.filter((i) => i.current_quantity <= i.minimum_stock);
}

/**
 * Mark products Unavailable when:
 * - no recipe is set, or
 * - any recipe ingredient cannot make 1 unit.
 * Syncs UUID products to Supabase. Returns products flipped off.
 */
export async function applyInventoryAvailabilityRules(options?: {
  /** When set, only evaluate these products (avoids flipping unrelated menu items). */
  onlyProductIds?: Iterable<string>;
  /** Push availability changes to Supabase (default true). */
  syncToServer?: boolean;
}): Promise<Product[]> {
  const store = useDataStore.getState();
  const flipped: Product[] = [];
  const onlyIds = options?.onlyProductIds
    ? new Set(options.onlyProductIds)
    : null;
  const syncToServer = options?.syncToServer ?? true;

  for (const product of store.products) {
    if (onlyIds && !onlyIds.has(product.id)) continue;

    const status = getProductStockStatus(product, store.inventory);
    const shouldBeUnavailable =
      status.level === "no_recipe" || (status.makeable ?? 0) <= 0;
    if (!shouldBeUnavailable) continue;
    if (!product.is_available) continue;

    store.updateProduct(product.id, { is_available: false });
    const updated = useDataStore
      .getState()
      .products.find((p) => p.id === product.id);
    if (updated) {
      flipped.push(updated);
    }
  }

  if (syncToServer && flipped.length > 0) {
    await Promise.all(
      flipped
        .filter((p) => isUuid(p.id))
        .map((p) => syncProduct(p))
    );
  }

  return flipped;
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
  await applyInventoryAvailabilityRules();

  return { success: true, alreadyDeducted: false, deductions };
}

export function isOrderInventoryDeducted(orderId: string): boolean {
  return useDataStore.getState().wasOrderInventoryDeducted(orderId);
}

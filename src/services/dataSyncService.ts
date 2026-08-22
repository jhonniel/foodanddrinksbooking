import type { Promotion, Reward } from "@/types";
import { loadCatalog } from "@/services/catalogService";
import { fetchExpenses } from "@/services/expenseService";

export const DATA_SYNC_EVENT = "foodbooking:sync-data";

/** Ask all mounted sync providers/tabs to pull fresh data from Supabase now. */
export function requestServerDataSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_SYNC_EVENT));
  }
}

export async function fetchPromotions(): Promise<{
  configured: boolean;
  promotions: Promotion[];
}> {
  const res = await fetch("/api/promotions", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    return { configured: false, promotions: [] };
  }
  const payload = (await res.json()) as {
    configured?: boolean;
    promotions?: Promotion[];
  };
  return {
    configured: payload.configured ?? true,
    promotions: Array.isArray(payload.promotions) ? payload.promotions : [],
  };
}

export async function fetchRewards(): Promise<{
  configured: boolean;
  rewards: Reward[];
}> {
  const res = await fetch("/api/admin/rewards", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    return { configured: false, rewards: [] };
  }
  const payload = (await res.json()) as {
    configured?: boolean;
    rewards?: Reward[];
  };
  return {
    configured: payload.configured ?? true,
    rewards: Array.isArray(payload.rewards) ? payload.rewards : [],
  };
}

/**
 * Replace in-memory catalog/expenses/promotions/rewards with Supabase truth.
 * Always overwrites local slices on successful API responses so other admin
 * sessions cannot keep showing deleted rows.
 */
export async function syncAllDataFromServer(): Promise<void> {
  const { useDataStore } = await import("@/stores/data");
  const store = useDataStore.getState();

  const [catalog, promotions, rewards, expenses] = await Promise.all([
    loadCatalog(),
    fetchPromotions(),
    fetchRewards(),
    fetchExpenses(),
  ]);

  if (catalog.configured) {
    store.applyCatalog({
      categories: catalog.categories,
      products: catalog.products,
      inventory: catalog.inventory,
    });

    const { useCartStore } = await import("@/stores/cart");
    useCartStore.getState().normalizeCart();
  }

  if (promotions.configured) {
    store.setPromotions(promotions.promotions);
  }

  if (rewards.configured) {
    store.setRewards(rewards.rewards);
  }

  if (!expenses.error) {
    store.setExpenses(expenses.expenses);
  }

  store.setHydrated(true);
}

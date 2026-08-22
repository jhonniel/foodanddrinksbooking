import type { Promotion, Reward } from "@/types";
import { loadCatalog } from "@/services/catalogService";
import { fetchExpenses } from "@/services/expenseService";

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

export async function syncAllDataFromServer(): Promise<void> {
  const { useDataStore } = await import("@/stores/data");
  const store = useDataStore.getState();

  const [catalog, promotions, rewards] = await Promise.all([
    loadCatalog(),
    fetchPromotions(),
    fetchRewards(),
  ]);

  if (catalog.configured) {
    store.applyCatalog({
      categories: catalog.categories,
      products: catalog.products,
      inventory: catalog.inventory,
    });
  }

  if (promotions.configured) {
    store.setPromotions(promotions.promotions);
  }

  if (rewards.configured) {
    store.setRewards(rewards.rewards);
  }

  const expenses = await fetchExpenses();
  if (!expenses.error) {
    store.setExpenses(expenses.expenses);
  }

  store.setHydrated(true);
}

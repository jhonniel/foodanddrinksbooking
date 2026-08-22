"use client";

import { useEffect } from "react";
import { useDataStore } from "@/stores/data";
import { loadCatalog } from "@/services/catalogService";

/** Keep catalog (products, categories, inventory) in sync across admin sessions. */
export function useCatalogSync(pollMs = 12_000) {
  const applyCatalog = useDataStore((s) => s.applyCatalog);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const catalog = await loadCatalog();
      if (cancelled || !catalog.configured) return;
      if (catalog.categories.length > 0 || catalog.products.length > 0) {
        applyCatalog({
          categories: catalog.categories,
          products: catalog.products,
          inventory: catalog.inventory,
        });
      } else if (catalog.inventory.length > 0) {
        applyCatalog({
          categories: catalog.categories,
          products: catalog.products,
          inventory: catalog.inventory,
        });
      }
    };

    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applyCatalog, pollMs]);
}

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { loadCatalog } from "@/services/catalogService";

/**
 * Loads the real session from the server on mount.
 * Never restores a user from localStorage.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const updateCustomer = useDataStore((s) => s.updateCustomer);
  const applyCatalog = useDataStore((s) => s.applyCatalog);

  useEffect(() => {
    void initialize();
    // Sync maintenance cookie for Edge middleware (local mode)
    void fetch("/api/settings", { credentials: "include", cache: "no-store" });
    void (async () => {
      const catalog = await loadCatalog();
      if (
        catalog.configured &&
        catalog.categories.length > 0 &&
        catalog.products.length > 0
      ) {
        applyCatalog({
          categories: catalog.categories,
          products: catalog.products,
          inventory: catalog.inventory,
        });
      }
    })();
  }, [initialize, applyCatalog]);

  useEffect(() => {
    if (initializing || !user) return;

    const customers = useDataStore.getState().customers;
    const existing = customers.find((c) => c.id === user.id);
    if (!existing) {
      useDataStore.setState((s) => ({
        customers: [
          user,
          ...s.customers.filter(
            (c) => c.email.toLowerCase() !== user.email.toLowerCase()
          ),
        ],
      }));
      return;
    }

    if (
      existing.full_name !== user.full_name ||
      existing.points_balance !== user.points_balance ||
      existing.role !== user.role
    ) {
      updateCustomer(user.id, {
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        points_balance: user.points_balance,
        lifetime_points: user.lifetime_points,
      });
    }
  }, [user, initializing, updateCustomer]);

  return <>{children}</>;
}

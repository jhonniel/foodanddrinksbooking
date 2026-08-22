"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

/**
 * Loads the real session from the server on mount.
 * Never restores a user from localStorage.
 * Catalog/promotions/rewards load via DataSyncProvider from Supabase.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
    void fetch("/api/settings", { credentials: "include", cache: "no-store" });
  }, [initialize]);

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { canAccessDriver } from "@/lib/auth/config";
import { syncMyDriverProfile } from "@/services/driverPresence";

/** Ensures the signed-in driver has a Supabase drivers row in local state. */
export function DriverProfileSync() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const dataHydrated = useDataStore((s) => s.hydrated);

  useEffect(() => {
    if (initializing || !dataHydrated || !user || !canAccessDriver(user.role)) {
      return;
    }
    void syncMyDriverProfile().catch((err) => {
      console.warn("[driver] profile sync failed:", err);
    });
  }, [user, initializing, dataHydrated]);

  return null;
}

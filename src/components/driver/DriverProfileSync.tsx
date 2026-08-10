"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { canAccessDriver } from "@/lib/auth/config";
import { syncMyDriverProfile } from "@/services/driverPresence";

/** Ensures the signed-in driver has a Supabase drivers row in local state. */
export function DriverProfileSync() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (initializing || !user || !canAccessDriver(user.role)) return;
    void syncMyDriverProfile().catch(() => {
      /* toast on toggle if still missing */
    });
  }, [user, initializing]);

  return null;
}

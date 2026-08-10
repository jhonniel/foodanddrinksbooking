"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { canAccessDriver } from "@/lib/auth/config";
import { syncMyDriverProfile } from "@/services/driverPresence";

/** Ensures the signed-in driver has a Supabase drivers row in local state. */
export function DriverProfileSync() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const dataHydrated = useDataStore((s) => s.hydrated);
  const [attemptedFor, setAttemptedFor] = useState<string | null>(null);

  useEffect(() => {
    if (initializing || !dataHydrated || !user || !canAccessDriver(user.role)) {
      return;
    }
    if (attemptedFor === user.id) return;

    setAttemptedFor(user.id);
    void syncMyDriverProfile().catch((err) => {
      console.warn("[driver] profile sync failed:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not link driver profile. Try signing out and back in."
      );
      // Allow retry on next mount / user change
      setAttemptedFor(null);
    });
  }, [user, initializing, dataHydrated, attemptedFor]);

  return null;
}

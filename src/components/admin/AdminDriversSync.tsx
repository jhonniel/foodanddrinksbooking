"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { canAccessAdmin } from "@/lib/auth/config";
import { fetchDriversFromApi } from "@/services/driverPresence";

/** Loads Supabase drivers into the admin Zustand store. */
export function AdminDriversSync() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (initializing || !user || !canAccessAdmin(user.role)) return;
    void fetchDriversFromApi().catch((err) => {
      console.warn("[admin] drivers sync failed:", err);
    });
  }, [user, initializing]);

  return null;
}

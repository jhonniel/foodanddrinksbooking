"use client";

import { useEffect } from "react";
import { clearLegacyDataStorage } from "@/lib/storage/clearLegacyStorage";
import { syncAllDataFromServer } from "@/services/dataSyncService";

const POLL_MS = 12_000;

/**
 * Loads catalog, promotions, rewards, and staff expenses from Supabase.
 * Replaces all Zustand persist slices — nothing is stored in localStorage.
 */
export function DataSyncProvider() {
  useEffect(() => {
    clearLegacyDataStorage();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (cancelled) return;
      await syncAllDataFromServer();
    };

    void sync();
    const id = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}

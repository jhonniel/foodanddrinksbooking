"use client";

import { useEffect } from "react";
import { clearLegacyDataStorage } from "@/lib/storage/clearLegacyStorage";
import { isCatalogSyncPaused } from "@/lib/catalog/syncPause";
import {
  DATA_SYNC_EVENT,
  syncAllDataFromServer,
} from "@/services/dataSyncService";

const POLL_MS = 4_000;

/**
 * Loads catalog, promotions, rewards, and staff expenses from Supabase.
 * Replaces in-memory Zustand slices on every successful pull so deletes on
 * one admin account disappear on others within a few seconds.
 */
export function DataSyncProvider() {
  useEffect(() => {
    clearLegacyDataStorage();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (cancelled || isCatalogSyncPaused()) return;
      await syncAllDataFromServer();
    };

    void sync();
    const intervalId = window.setInterval(() => void sync(), POLL_MS);

    const onFocus = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onSyncRequest = () => void sync();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(DATA_SYNC_EVENT, onSyncRequest);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(DATA_SYNC_EVENT, onSyncRequest);
    };
  }, []);

  return null;
}

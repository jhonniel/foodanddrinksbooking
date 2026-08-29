"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppSettings } from "@/lib/settings/types";
import {
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_INFO,
} from "@/lib/settings/storeConfig";
import {
  DEFAULT_STORE_HOURS,
  getStoreClosedMessage,
  isStoreOpen,
} from "@/lib/storeHours";

export function useStoreSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { settings?: AppSettings }) => {
        if (!cancelled) {
          setSettings(json.settings ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const storeHours = settings?.store_hours ?? DEFAULT_STORE_HOURS;
  const store = settings?.store ?? DEFAULT_STORE_INFO;
  const delivery = settings?.delivery ?? DEFAULT_DELIVERY_SETTINGS;

  const storeOpen = useMemo(
    () => isStoreOpen(storeHours, now),
    [storeHours, now]
  );

  const storeClosedMessage = useMemo(
    () => getStoreClosedMessage(storeHours, now),
    [storeHours, now]
  );

  return {
    settings,
    loading,
    purchaseSoon: Boolean(settings?.purchase_soon_mode),
    storeHours,
    store,
    delivery,
    storeOpen,
    storeClosedMessage,
  };
}

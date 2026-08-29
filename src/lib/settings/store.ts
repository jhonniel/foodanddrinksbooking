import "server-only";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_STORE_HOURS, isStoreOpen, parseStoreHours } from "@/lib/storeHours";
import {
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_INFO,
  parseDeliverySettings,
  parseStoreInfo,
} from "./storeConfig";
import type { AppSettings, DeliverySettings, StoreHoursSettings, StoreInfoSettings } from "./types";

export type {
  AppSettings,
  DeliverySettings,
  StoreHoursSettings,
  StoreInfoSettings,
} from "./types";

const MAINTENANCE_KEY = "maintenance_mode";
const PURCHASE_SOON_KEY = "purchase_soon_mode";
const STORE_HOURS_KEY = "store_hours";
const STORE_KEY = "store";
const DELIVERY_KEY = "delivery";

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  purchase_soon_mode: false,
  store_hours: DEFAULT_STORE_HOURS,
  store: DEFAULT_STORE_INFO,
  delivery: DEFAULT_DELIVERY_SETTINGS,
  updated_at: null,
};

function createServiceSupabase() {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to read or write app settings."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseBooleanSetting(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean((value as { enabled: unknown }).enabled);
  }
  return false;
}

async function getSupabaseSettings(): Promise<AppSettings> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, updated_at")
    .in("key", [
      MAINTENANCE_KEY,
      PURCHASE_SOON_KEY,
      STORE_HOURS_KEY,
      STORE_KEY,
      DELIVERY_KEY,
    ]);

  if (error) {
    console.error("[settings] supabase read failed", error.message);
    return { ...DEFAULT_SETTINGS };
  }

  const rows = data ?? [];
  const maintenanceRow = rows.find((row) => row.key === MAINTENANCE_KEY);
  const purchaseSoonRow = rows.find((row) => row.key === PURCHASE_SOON_KEY);
  const storeHoursRow = rows.find((row) => row.key === STORE_HOURS_KEY);
  const storeRow = rows.find((row) => row.key === STORE_KEY);
  const deliveryRow = rows.find((row) => row.key === DELIVERY_KEY);
  const updated_at =
    rows
      .map((row) => row.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    maintenance_mode: parseBooleanSetting(maintenanceRow?.value),
    purchase_soon_mode: parseBooleanSetting(purchaseSoonRow?.value),
    store_hours: parseStoreHours(storeHoursRow?.value),
    store: parseStoreInfo(storeRow?.value),
    delivery: parseDeliverySettings(deliveryRow?.value),
    updated_at,
  };
}

async function upsertSupabaseSetting(
  key: string,
  value: unknown
): Promise<string> {
  const supabase = createServiceSupabase();
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key,
      value,
      updated_at,
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(error.message);
  }

  return updated_at;
}

export async function getAppSettings(): Promise<AppSettings> {
  if (isSupabaseConfigured()) {
    return getSupabaseSettings();
  }
  const { readLocalSettings } = await import("./localFileStore");
  return readLocalSettings();
}

export async function isMaintenanceMode(): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.maintenance_mode;
}

export async function isPurchaseSoonMode(): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.purchase_soon_mode;
}

export async function isStoreCurrentlyOpen(): Promise<boolean> {
  const settings = await getAppSettings();
  return isStoreOpen(settings.store_hours);
}

export async function updateAppSettings(
  patch: Partial<
    Pick<
      AppSettings,
      | "maintenance_mode"
      | "purchase_soon_mode"
      | "store_hours"
      | "store"
      | "delivery"
    >
  >
): Promise<AppSettings> {
  if (isSupabaseConfigured()) {
    let latestUpdatedAt: string | null = null;
    if (patch.maintenance_mode !== undefined) {
      latestUpdatedAt = await upsertSupabaseSetting(
        MAINTENANCE_KEY,
        patch.maintenance_mode
      );
    }
    if (patch.purchase_soon_mode !== undefined) {
      latestUpdatedAt = await upsertSupabaseSetting(
        PURCHASE_SOON_KEY,
        patch.purchase_soon_mode
      );
    }
    if (patch.store_hours !== undefined) {
      latestUpdatedAt = await upsertSupabaseSetting(
        STORE_HOURS_KEY,
        patch.store_hours
      );
    }
    if (patch.store !== undefined) {
      latestUpdatedAt = await upsertSupabaseSetting(STORE_KEY, patch.store);
    }
    if (patch.delivery !== undefined) {
      latestUpdatedAt = await upsertSupabaseSetting(
        DELIVERY_KEY,
        patch.delivery
      );
    }
    const settings = await getSupabaseSettings();
    return latestUpdatedAt
      ? { ...settings, updated_at: latestUpdatedAt }
      : settings;
  }

  const current = await readLocalSettingsMerged();
  const settings: AppSettings = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { writeLocalSettings } = await import("./localFileStore");
  await writeLocalSettings(settings);
  return settings;
}

async function readLocalSettingsMerged(): Promise<AppSettings> {
  const { readLocalSettings } = await import("./localFileStore");
  return readLocalSettings();
}

/** @deprecated Use updateAppSettings({ maintenance_mode }) */
export async function setMaintenanceMode(
  enabled: boolean
): Promise<AppSettings> {
  return updateAppSettings({ maintenance_mode: enabled });
}

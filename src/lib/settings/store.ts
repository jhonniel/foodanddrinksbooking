import "server-only";

import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createClient } from "@supabase/supabase-js";
import type { AppSettings } from "./types";

export type { AppSettings } from "./types";

const SETTINGS_KEY = "maintenance_mode";

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  updated_at: null,
};

function createServiceSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey() || getSupabaseAnonKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseMaintenanceValue(value: unknown): boolean {
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
    .select("value, updated_at")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    console.error("[settings] supabase read failed", error.message);
    return { ...DEFAULT_SETTINGS };
  }

  return {
    maintenance_mode: parseMaintenanceValue(data?.value),
    updated_at: data?.updated_at ?? null,
  };
}

async function setSupabaseMaintenance(enabled: boolean): Promise<AppSettings> {
  const supabase = createServiceSupabase();
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: SETTINGS_KEY,
      value: enabled,
      updated_at,
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(error.message);
  }

  return { maintenance_mode: enabled, updated_at };
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

export async function setMaintenanceMode(
  enabled: boolean
): Promise<AppSettings> {
  if (isSupabaseConfigured()) {
    return setSupabaseMaintenance(enabled);
  }
  const settings: AppSettings = {
    maintenance_mode: enabled,
    updated_at: new Date().toISOString(),
  };
  const { writeLocalSettings } = await import("./localFileStore");
  await writeLocalSettings(settings);
  return settings;
}

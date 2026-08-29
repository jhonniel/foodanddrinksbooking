import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_STORE_HOURS, parseStoreHours } from "@/lib/storeHours";
import {
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_INFO,
  parseDeliverySettings,
  parseStoreInfo,
} from "./storeConfig";
import type { AppSettings } from "./types";

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  purchase_soon_mode: false,
  store_hours: DEFAULT_STORE_HOURS,
  store: DEFAULT_STORE_INFO,
  delivery: DEFAULT_DELIVERY_SETTINGS,
  updated_at: null,
};

function paths() {
  const dataDir = path.join(process.cwd(), ".data");
  return {
    dataDir,
    settingsFile: path.join(dataDir, "settings.json"),
  };
}

export async function readLocalSettings(): Promise<AppSettings> {
  const { dataDir, settingsFile } = paths();
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(settingsFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      maintenance_mode: Boolean(parsed.maintenance_mode),
      purchase_soon_mode: Boolean(parsed.purchase_soon_mode),
      store_hours: parseStoreHours(parsed.store_hours),
      store: parseStoreInfo(parsed.store),
      delivery: parseDeliverySettings(parsed.delivery),
      updated_at: parsed.updated_at ?? null,
    };
  } catch {
    await fs.writeFile(
      settingsFile,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf8"
    );
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeLocalSettings(
  settings: AppSettings
): Promise<void> {
  const { dataDir, settingsFile } = paths();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), "utf8");
}

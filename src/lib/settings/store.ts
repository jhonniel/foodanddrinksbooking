import { promises as fs } from "fs";
import path from "path";

export interface AppSettings {
  maintenance_mode: boolean;
  updated_at: string | null;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  updated_at: null,
};

async function ensureStore(): Promise<AppSettings> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      maintenance_mode: Boolean(parsed.maintenance_mode),
      updated_at: parsed.updated_at ?? null,
    };
  } catch {
    await fs.writeFile(
      SETTINGS_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf8"
    );
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveStore(settings: AppSettings): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(settings, null, 2),
    "utf8"
  );
}

export async function getAppSettings(): Promise<AppSettings> {
  return ensureStore();
}

export async function isMaintenanceMode(): Promise<boolean> {
  const settings = await ensureStore();
  return settings.maintenance_mode;
}

export async function setMaintenanceMode(
  enabled: boolean
): Promise<AppSettings> {
  const settings: AppSettings = {
    maintenance_mode: enabled,
    updated_at: new Date().toISOString(),
  };
  await saveStore(settings);
  return settings;
}

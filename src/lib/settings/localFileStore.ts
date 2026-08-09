import "server-only";

import { promises as fs } from "fs";
import path from "path";
import type { AppSettings } from "./types";

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
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

#!/usr/bin/env node
/**
 * Prints the env keys that must be set on Vercel for Auth + DB + S3 uploads.
 * Does not print secret values. Open:
 *   https://vercel.com → Project → Settings → Environment Variables
 *
 * After adding keys, Redeploy.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const REQUIRED = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_SESSION_SECRET",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

const OPTIONAL = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_MAP_PROVIDER",
  "NEXT_PUBLIC_PAYMENT_PROVIDER",
];

function parseEnv(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function mask(v) {
  if (!v) return "(missing in .env.local)";
  if (v.length <= 8) return "********";
  return `${v.slice(0, 4)}…${v.slice(-4)} (${v.length} chars)`;
}

async function main() {
  let env = {};
  try {
    env = parseEnv(await fs.readFile(path.join(ROOT, ".env.local"), "utf8"));
  } catch {
    console.warn("No .env.local found — showing key names only.\n");
  }

  console.log("Add these in Vercel → Project → Settings → Environment Variables");
  console.log("Environments: Production + Preview (+ Development if used)\n");
  console.log("Required:");
  for (const key of REQUIRED) {
    console.log(`  ${key.padEnd(36)} ${mask(env[key])}`);
  }
  console.log("\nOptional:");
  for (const key of OPTIONAL) {
    console.log(`  ${key.padEnd(36)} ${mask(env[key])}`);
  }
  console.log("\nThen Redeploy the project so uploads and login work on Vercel.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

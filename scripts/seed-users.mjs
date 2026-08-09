/**
 * Seed local auth accounts into `.data/accounts.json`.
 * Usage: npm run seed:users
 */
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID, scryptSync } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

const KEY_LEN = 64;
const DEFAULT_PASSWORD = "IslandCoolers1!";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

/** @type {Array<{
 *  email: string;
 *  full_name: string;
 *  phone: string | null;
 *  role: string;
 *  points_balance?: number;
 *  lifetime_points?: number;
 * }>} */
const SEED_USERS = [
  {
    email: "admin@islandcoolers.com",
    full_name: "Admin User",
    phone: "+63 917 555 0001",
    role: "SUPER_ADMIN",
  },
  {
    email: "ops@islandcoolers.com",
    full_name: "Ops Admin",
    phone: "+63 917 555 0002",
    role: "ADMIN",
  },
  {
    email: "manager@islandcoolers.com",
    full_name: "Store Manager",
    phone: "+63 917 555 0003",
    role: "MANAGER",
  },
  {
    email: "staff@islandcoolers.com",
    full_name: "Counter Staff",
    phone: "+63 917 555 0004",
    role: "STAFF",
  },
  {
    email: "juan@islandcoolers.com",
    full_name: "Juan Dela Cruz",
    phone: "+63 917 555 0202",
    role: "DRIVER",
  },
  {
    email: "maria@islandcoolers.com",
    full_name: "Maria Santos",
    phone: "+63 917 555 0101",
    role: "CUSTOMER",
    points_balance: 250,
    lifetime_points: 1250,
  },
  {
    email: "carlo@islandcoolers.com",
    full_name: "Carlo Reyes",
    phone: "+63 917 555 0102",
    role: "CUSTOMER",
    points_balance: 80,
    lifetime_points: 320,
  },
];

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  let db = { accounts: [] };
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.accounts)) db = parsed;
  } catch {
    // fresh store
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(DEFAULT_PASSWORD);
  const results = [];

  for (const seed of SEED_USERS) {
    const email = seed.email.toLowerCase();
    const idx = db.accounts.findIndex((a) => a.email.toLowerCase() === email);
    const base = {
      email,
      full_name: seed.full_name,
      phone: seed.phone,
      avatar_url: null,
      role: seed.role,
      is_active: true,
      points_balance: seed.points_balance ?? 0,
      lifetime_points: seed.lifetime_points ?? 0,
      password_hash: passwordHash,
      auth_provider: "password",
      google_id: null,
      updated_at: now,
    };

    if (idx >= 0) {
      db.accounts[idx] = {
        ...db.accounts[idx],
        ...base,
        id: db.accounts[idx].id,
        created_at: db.accounts[idx].created_at,
      };
      results.push({ email, role: seed.role, action: "updated" });
    } else {
      db.accounts.push({
        id: randomUUID(),
        ...base,
        created_at: now,
      });
      results.push({ email, role: seed.role, action: "created" });
    }
  }

  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(db, null, 2), "utf8");

  console.log(`Seeded ${results.length} users → ${ACCOUNTS_FILE}`);
  console.log(`Shared password: ${DEFAULT_PASSWORD}\n`);
  for (const r of results) {
    console.log(`  ${r.action.padEnd(8)} ${r.role.padEnd(12)} ${r.email}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

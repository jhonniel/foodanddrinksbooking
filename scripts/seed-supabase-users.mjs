/**
 * Seed Auth users + profiles into the linked Supabase project.
 * Reads keys from .env.local
 *
 * Usage: npm run seed:supabase
 */
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_PASSWORD = "IslandCoolers1!";

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

function parseEnv(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
  return parseEnv(raw);
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 20) return null;
  }
}

async function tableExists(admin, table) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("could not find") || msg.includes("does not exist")) {
    return false;
  }
  // Other errors (RLS etc.) still mean the table is there
  return true;
}

async function upsertProfile(admin, userId, seed) {
  const now = new Date().toISOString();
  const row = {
    id: userId,
    email: seed.email.toLowerCase(),
    full_name: seed.full_name,
    phone: seed.phone,
    role: seed.role,
    is_active: true,
    points_balance: seed.points_balance ?? 0,
    lifetime_points: seed.lifetime_points ?? 0,
    updated_at: now,
  };

  const { error } = await admin.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`profiles upsert failed for ${seed.email}: ${error.message}`);
}

async function upsertDriver(admin, profileId) {
  const { data: existing, error: findError } = await admin
    .from("drivers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (findError) throw new Error(`drivers lookup: ${findError.message}`);

  if (existing) {
    await admin
      .from("drivers")
      .update({ is_active: true, vehicle_type: "Motorcycle", status: "OFFLINE" })
      .eq("id", existing.id);
    return;
  }

  const { error } = await admin.from("drivers").insert({
    profile_id: profileId,
    vehicle_type: "Motorcycle",
    vehicle_number: "IC-001",
    status: "OFFLINE",
    is_active: true,
  });
  if (error) throw new Error(`drivers insert: ${error.message}`);
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const hasProfiles = await tableExists(admin, "profiles");
  const hasDrivers = hasProfiles && (await tableExists(admin, "drivers"));

  if (!hasProfiles) {
    console.warn(
      "\n⚠  public.profiles is missing. Run migrations 001–004 in the SQL Editor first.\n" +
        "   Auth users will still be created; re-run this script after migrations to sync roles.\n"
    );
  }

  console.log(`Seeding ${SEED_USERS.length} users into ${url}`);
  console.log(`Password for all: ${DEFAULT_PASSWORD}\n`);

  for (const seed of SEED_USERS) {
    const email = seed.email.toLowerCase();
    let user = await findUserByEmail(admin, email);
    let action = "updated";

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: seed.full_name,
          phone: seed.phone,
        },
        app_metadata: { role: seed.role },
      });
      if (error) {
        console.error(`  FAIL     ${seed.role.padEnd(12)} ${email} — ${error.message}`);
        continue;
      }
      user = data.user;
      action = "created";
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: seed.full_name,
          phone: seed.phone,
        },
        app_metadata: { role: seed.role },
      });
      if (error) {
        console.error(`  FAIL     ${seed.role.padEnd(12)} ${email} — ${error.message}`);
        continue;
      }
    }

    if (hasProfiles) {
      try {
        await upsertProfile(admin, user.id, seed);
        if (seed.role === "DRIVER" && hasDrivers) {
          await upsertDriver(admin, user.id);
        }
      } catch (err) {
        console.error(
          `  PARTIAL  ${seed.role.padEnd(12)} ${email} — auth ok, profile: ${err.message}`
        );
        continue;
      }
    }

    console.log(`  ${action.padEnd(8)} ${seed.role.padEnd(12)} ${email}`);
  }

  console.log("\nDone. Try logging in at /login");
  if (!hasProfiles) {
    console.log(
      "Then open https://supabase.com/dashboard/project/aizcucncmsrmxbbqebpb/sql/new and run supabase/migrations/001–004, then: npm run seed:supabase"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

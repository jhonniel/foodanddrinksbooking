import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Profile, UserRole } from "@/types";
import { hashPassword, verifyPassword } from "./password";
import { toPublicProfile } from "./config";

export interface StoredAccount {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  points_balance: number;
  lifetime_points: number;
  /** null for Google-only accounts */
  password_hash: string | null;
  auth_provider: "password" | "google" | "both";
  google_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AccountDb {
  accounts: StoredAccount[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

async function ensureStore(): Promise<AccountDb> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as AccountDb;
    if (!Array.isArray(parsed.accounts)) {
      return { accounts: [] };
    }
    return parsed;
  } catch {
    const empty: AccountDb = { accounts: [] };
    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function saveStore(db: AccountDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function listAccounts(): Promise<StoredAccount[]> {
  const db = await ensureStore();
  return db.accounts;
}

export async function findAccountByEmail(
  email: string
): Promise<StoredAccount | null> {
  const db = await ensureStore();
  const normalized = email.trim().toLowerCase();
  return (
    db.accounts.find((a) => a.email.toLowerCase() === normalized) ?? null
  );
}

export async function findAccountById(
  id: string
): Promise<StoredAccount | null> {
  const db = await ensureStore();
  return db.accounts.find((a) => a.id === id) ?? null;
}

export interface RegisterAccountInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  /** Only used for admin-created staff/drivers */
  role?: UserRole;
  /** Force role even if accounts already exist (admin invite) */
  forceRole?: boolean;
}

export async function registerAccount(
  input: RegisterAccountInput
): Promise<{ account: StoredAccount; profile: Profile } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || !input.fullName.trim()) {
    return { error: "Name, email, and password are required." };
  }
  if (input.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await findAccountByEmail(email);
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const db = await ensureStore();
  const now = new Date().toISOString();

  // First account becomes SUPER_ADMIN so production can bootstrap securely.
  // Public signup after that is always CUSTOMER unless admin forces a role.
  let role: UserRole = "CUSTOMER";
  if (db.accounts.length === 0) {
    role = "SUPER_ADMIN";
  } else if (input.forceRole && input.role) {
    role = input.role;
  }

  const account: StoredAccount = {
    id: randomUUID(),
    email,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    avatar_url: null,
    role,
    is_active: true,
    points_balance: 0,
    lifetime_points: 0,
    password_hash: hashPassword(input.password),
    auth_provider: "password",
    google_id: null,
    created_at: now,
    updated_at: now,
  };

  db.accounts.push(account);
  await saveStore(db);

  return { account, profile: toPublicProfile(account) };
}

export async function authenticateAccount(
  email: string,
  password: string
): Promise<{ account: StoredAccount; profile: Profile } | { error: string }> {
  const account = await findAccountByEmail(email);
  if (!account) {
    return { error: "Invalid email or password." };
  }
  if (!account.is_active) {
    return { error: "This account has been deactivated." };
  }
  if (!account.password_hash) {
    return {
      error: "This account has no password. Reset it from your admin or create a new email account.",
    };
  }
  if (!verifyPassword(password, account.password_hash)) {
    return { error: "Invalid email or password." };
  }
  return { account, profile: toPublicProfile(account) };
}

export async function findOrCreateGoogleAccount(input: {
  googleId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
}): Promise<{ account: StoredAccount; profile: Profile; created: boolean }> {
  const db = await ensureStore();
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();

  const byGoogle = db.accounts.find((a) => a.google_id === input.googleId);
  if (byGoogle) {
    const idx = db.accounts.findIndex((a) => a.id === byGoogle.id);
    db.accounts[idx] = {
      ...db.accounts[idx],
      full_name: input.fullName || db.accounts[idx].full_name,
      avatar_url: input.avatarUrl ?? db.accounts[idx].avatar_url,
      updated_at: now,
    };
    await saveStore(db);
    return {
      account: db.accounts[idx],
      profile: toPublicProfile(db.accounts[idx]),
      created: false,
    };
  }

  const byEmail = db.accounts.find((a) => a.email.toLowerCase() === email);
  if (byEmail) {
    const idx = db.accounts.findIndex((a) => a.id === byEmail.id);
    db.accounts[idx] = {
      ...db.accounts[idx],
      google_id: input.googleId,
      auth_provider:
        db.accounts[idx].password_hash != null ? "both" : "google",
      avatar_url: input.avatarUrl ?? db.accounts[idx].avatar_url,
      full_name: db.accounts[idx].full_name || input.fullName,
      updated_at: now,
    };
    await saveStore(db);
    return {
      account: db.accounts[idx],
      profile: toPublicProfile(db.accounts[idx]),
      created: false,
    };
  }

  let role: UserRole = "CUSTOMER";
  if (db.accounts.length === 0) {
    role = "SUPER_ADMIN";
  }

  const account: StoredAccount = {
    id: randomUUID(),
    email,
    full_name: input.fullName.trim() || email.split("@")[0],
    phone: null,
    avatar_url: input.avatarUrl ?? null,
    role,
    is_active: true,
    points_balance: 0,
    lifetime_points: 0,
    password_hash: null,
    auth_provider: "google",
    google_id: input.googleId,
    created_at: now,
    updated_at: now,
  };

  db.accounts.push(account);
  await saveStore(db);
  return { account, profile: toPublicProfile(account), created: true };
}

export async function updateAccountRole(
  accountId: string,
  role: UserRole,
  actorId: string
): Promise<{ profile: Profile } | { error: string }> {
  const db = await ensureStore();
  const actor = db.accounts.find((a) => a.id === actorId);
  if (!actor || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    return { error: "Only admins can change account roles." };
  }

  const idx = db.accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) return { error: "Account not found." };

  if (accountId === actorId && role !== actor.role) {
    const otherAdmins = db.accounts.filter(
      (a) =>
        a.id !== actorId &&
        a.is_active &&
        (a.role === "ADMIN" || a.role === "SUPER_ADMIN")
    );
    if (
      (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN") &&
      !["ADMIN", "SUPER_ADMIN"].includes(role) &&
      otherAdmins.length === 0
    ) {
      return { error: "Cannot demote the only admin account." };
    }
  }

  db.accounts[idx] = {
    ...db.accounts[idx],
    role,
    updated_at: new Date().toISOString(),
  };
  await saveStore(db);
  return { profile: toPublicProfile(db.accounts[idx]) };
}

export async function updateAccountProfile(
  accountId: string,
  updates: Partial<
    Pick<
      StoredAccount,
      | "full_name"
      | "phone"
      | "avatar_url"
      | "points_balance"
      | "lifetime_points"
    >
  >
): Promise<Profile | null> {
  const db = await ensureStore();
  const idx = db.accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) return null;
  db.accounts[idx] = {
    ...db.accounts[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await saveStore(db);
  return toPublicProfile(db.accounts[idx]);
}

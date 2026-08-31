import "server-only";

import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import type { Driver, DriverStatus, Profile, UserRole } from "@/types";

const DRIVER_COLUMNS = `
  id, profile_id, vehicle_type, vehicle_number, license_number,
  status, rating, total_deliveries, is_active, created_at, updated_at
`;

const DRIVER_SELECT = `
  ${DRIVER_COLUMNS},
  profile:profiles!profile_id (
    id, email, full_name, phone, avatar_url, role, is_active,
    points_balance, lifetime_points, created_at, updated_at
  )
`;

function mapProfile(row: Record<string, unknown> | null | undefined): Profile | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    full_name: String(row.full_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: (row.role as UserRole) || "DRIVER",
    is_active: Boolean(row.is_active ?? true),
    points_balance: Number(row.points_balance ?? 0),
    lifetime_points: Number(row.lifetime_points ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export function mapDriverRow(row: Record<string, unknown>): Driver {
  const profileRaw = row.profile;
  const profile = Array.isArray(profileRaw)
    ? mapProfile(profileRaw[0] as Record<string, unknown>)
    : mapProfile(profileRaw as Record<string, unknown> | null);

  return {
    id: String(row.id),
    profile_id: String(row.profile_id),
    vehicle_type: String(row.vehicle_type ?? "Motorcycle"),
    vehicle_number: (row.vehicle_number as string | null) ?? null,
    license_number: (row.license_number as string | null) ?? null,
    status: (row.status as DriverStatus) || "OFFLINE",
    rating: Number(row.rating ?? 5),
    total_deliveries: Number(row.total_deliveries ?? 0),
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    profile,
  };
}

async function getAdminClient() {
  if (!isSupabaseConfigured()) return null;
  // Writes to drivers require the service role (RLS blocks anon/authenticated).
  if (!getSupabaseServiceRoleKey()) {
    console.error(
      "[drivers] SUPABASE_SERVICE_ROLE_KEY is missing — cannot read/create driver rows."
    );
    return null;
  }
  return createServerClient();
}

async function attachProfile(
  driver: Driver,
  fallback?: Profile
): Promise<Driver> {
  if (driver.profile) return driver;
  if (fallback && fallback.id === driver.profile_id) {
    return { ...driver, profile: fallback };
  }

  const client = await getAdminClient();
  if (!client) return driver;

  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("id", driver.profile_id)
    .maybeSingle();

  if (!data) return driver;
  return {
    ...driver,
    profile: mapProfile(data as unknown as Record<string, unknown>),
  };
}

export async function fetchDriverByProfileId(
  profileId: string
): Promise<Driver | null> {
  const client = await getAdminClient();
  if (!client) return null;

  const withJoin = await client
    .from("drivers")
    .select(DRIVER_SELECT)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!withJoin.error && withJoin.data) {
    return mapDriverRow(withJoin.data as unknown as Record<string, unknown>);
  }

  // Fallback without embed — join errors must not look like "unlinked".
  const plain = await client
    .from("drivers")
    .select(DRIVER_COLUMNS)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (plain.error) {
    console.error("[drivers] fetch failed:", plain.error.message);
    return null;
  }
  if (!plain.data) return null;

  return attachProfile(
    mapDriverRow(plain.data as unknown as Record<string, unknown>)
  );
}

/**
 * Ensure a drivers row exists for a DRIVER-role profile.
 * Creates one if missing (required before Go Online).
 */
export async function ensureDriverForProfile(
  profile: Profile
): Promise<{ driver?: Driver; error?: string }> {
  if (!canBeDriverRole(profile.role)) {
    return {
      error: `Account role is ${profile.role}. Switch to a DRIVER account to go online.`,
    };
  }

  const existing = await fetchDriverByProfileId(profile.id);
  if (existing) return { driver: await attachProfile(existing, profile) };

  const client = await getAdminClient();
  if (!client) {
    return {
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in .env.local / Vercel, then redeploy.",
    };
  }

  // Ensure profiles row exists (FK on drivers.profile_id).
  const { data: profileRow } = await client
    .from("profiles")
    .select("id")
    .eq("id", profile.id)
    .maybeSingle();

  if (!profileRow) {
    const now = new Date().toISOString();
    const { error: profileError } = await client.from("profiles").upsert({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      role: profile.role,
      is_active: profile.is_active ?? true,
      points_balance: profile.points_balance ?? 0,
      lifetime_points: profile.lifetime_points ?? 0,
      created_at: profile.created_at || now,
      updated_at: now,
    });
    if (profileError) {
      console.error("[drivers] profile upsert failed:", profileError.message);
      return {
        error: `Could not prepare profile for driver: ${profileError.message}`,
      };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("drivers")
    .insert({
      profile_id: profile.id,
      vehicle_type: "Motorcycle",
      status: "OFFLINE",
      rating: 5,
      total_deliveries: 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select(DRIVER_COLUMNS)
    .single();

  if (error || !data) {
    // Race: another request created it
    const again = await fetchDriverByProfileId(profile.id);
    if (again) return { driver: await attachProfile(again, profile) };
    console.error("[drivers] ensure insert failed:", error?.message);
    return { error: error?.message || "Could not create driver profile." };
  }

  return {
    driver: await attachProfile(
      mapDriverRow(data as unknown as Record<string, unknown>),
      profile
    ),
  };
}

function canBeDriverRole(role: string): boolean {
  return role === "DRIVER";
}

export function isDriverRoleAccount(driver: Driver): boolean {
  return driver.profile?.role === "DRIVER";
}

export async function updateDriverStatusInSupabase(
  profile: Profile,
  status: DriverStatus,
  location?: { lat: number; lng: number } | null
): Promise<{ driver?: Driver; error?: string }> {
  const client = await getAdminClient();
  if (!client) {
    return { error: "Supabase service role is required." };
  }

  const ensured = await ensureDriverForProfile(profile);
  if (!ensured.driver) {
    return {
      error:
        ensured.error ||
        "Could not create a drivers record for this account. Check SUPABASE_SERVICE_ROLE_KEY and try again.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("drivers")
    .update({ status, updated_at: now })
    .eq("id", ensured.driver.id);

  if (error) return { error: error.message };

  if (location) {
    const { error: locError } = await client.from("driver_locations").insert({
      driver_id: ensured.driver.id,
      latitude: location.lat,
      longitude: location.lng,
      recorded_at: now,
    });
    if (locError) {
      console.warn("[drivers] location insert failed:", locError.message);
    }
  }

  const refreshed = await fetchDriverByProfileId(profile.id);
  return {
    driver: refreshed
      ? await attachProfile(refreshed, profile)
      : { ...ensured.driver, status, updated_at: now },
  };
}

export async function listDriversFromSupabase(): Promise<Driver[] | null> {
  const client = await getAdminClient();
  if (!client) return null;

  const withJoin = await client
    .from("drivers")
    .select(DRIVER_SELECT)
    .order("created_at", { ascending: false });

  if (!withJoin.error && withJoin.data) {
    return (withJoin.data ?? [])
      .map((row) => mapDriverRow(row as unknown as Record<string, unknown>))
      .filter(isDriverRoleAccount);
  }

  console.warn(
    "[drivers] list join failed, falling back:",
    withJoin.error?.message
  );

  const plain = await client
    .from("drivers")
    .select(DRIVER_COLUMNS)
    .order("created_at", { ascending: false });

  if (plain.error) {
    console.error("[drivers] list failed:", plain.error.message);
    return null;
  }

  const rows = await Promise.all(
    (plain.data ?? []).map((row) =>
      attachProfile(mapDriverRow(row as unknown as Record<string, unknown>))
    )
  );
  return rows.filter(isDriverRoleAccount);
}

export async function setDriverActiveInSupabase(
  driverId: string,
  active: boolean
): Promise<{ driver?: Driver; error?: string }> {
  const client = await getAdminClient();
  if (!client) {
    return {
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in .env.local / Vercel.",
    };
  }

  const existing = await client
    .from("drivers")
    .select(DRIVER_COLUMNS)
    .eq("id", driverId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { error: existing.error?.message || "Driver not found." };
  }

  const profileId = String(existing.data.profile_id);
  const now = new Date().toISOString();

  const { error: driverError } = await client
    .from("drivers")
    .update({
      is_active: active,
      status: active ? "OFFLINE" : "SUSPENDED",
      updated_at: now,
    })
    .eq("id", driverId);

  if (driverError) return { error: driverError.message };

  const { error: profileError } = await client
    .from("profiles")
    .update({ is_active: active, updated_at: now })
    .eq("id", profileId);

  if (profileError) {
    console.warn("[drivers] profile is_active update:", profileError.message);
  }

  // Ban / unban Auth user so deactivated drivers cannot sign in
  try {
    if (active) {
      await client.auth.admin.updateUserById(profileId, { ban_duration: "none" });
    } else {
      await client.auth.admin.updateUserById(profileId, {
        ban_duration: "876000h",
      });
    }
  } catch (err) {
    console.warn("[drivers] auth ban update failed", err);
  }

  const refreshed = await fetchDriverByProfileId(profileId);
  if (!refreshed) {
    return {
      driver: {
        ...mapDriverRow(existing.data as unknown as Record<string, unknown>),
        is_active: active,
        status: active ? "OFFLINE" : "SUSPENDED",
        updated_at: now,
      },
    };
  }
  return { driver: refreshed };
}

export type UpdateDriverInput = {
  fullName?: string;
  phone?: string | null;
  vehicleType?: string;
  vehicleNumber?: string | null;
  licenseNumber?: string | null;
};

export async function updateDriverInSupabase(
  driverId: string,
  input: UpdateDriverInput
): Promise<{ driver?: Driver; error?: string }> {
  const client = await getAdminClient();
  if (!client) {
    return {
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in .env.local / Vercel.",
    };
  }

  const existing = await client
    .from("drivers")
    .select(DRIVER_COLUMNS)
    .eq("id", driverId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { error: existing.error?.message || "Driver not found." };
  }

  const profileId = String(existing.data.profile_id);
  const now = new Date().toISOString();

  const driverPatch: Record<string, unknown> = { updated_at: now };
  if (input.vehicleType !== undefined) {
    driverPatch.vehicle_type = input.vehicleType;
  }
  if (input.vehicleNumber !== undefined) {
    driverPatch.vehicle_number = input.vehicleNumber || null;
  }
  if (input.licenseNumber !== undefined) {
    driverPatch.license_number = input.licenseNumber || null;
  }

  if (Object.keys(driverPatch).length > 1) {
    const { error: driverError } = await client
      .from("drivers")
      .update(driverPatch)
      .eq("id", driverId);
    if (driverError) return { error: driverError.message };
  }

  const profilePatch: Record<string, unknown> = { updated_at: now };
  if (input.fullName !== undefined) {
    profilePatch.full_name = input.fullName;
  }
  if (input.phone !== undefined) {
    profilePatch.phone = input.phone || null;
  }

  if (Object.keys(profilePatch).length > 1) {
    const { error: profileError } = await client
      .from("profiles")
      .update(profilePatch)
      .eq("id", profileId);
    if (profileError) return { error: profileError.message };
  }

  const refreshed = await fetchDriverByProfileId(profileId);
  if (!refreshed) {
    return { error: "Driver updated but could not reload." };
  }
  return { driver: refreshed };
}

export async function deleteDriverInSupabase(
  driverId: string
): Promise<{ ok: boolean; error?: string }> {
  const client = await getAdminClient();
  if (!client) {
    return {
      ok: false,
      error:
        "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in .env.local / Vercel.",
    };
  }

  const existing = await client
    .from("drivers")
    .select("id, profile_id")
    .eq("id", driverId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { ok: false, error: existing.error?.message || "Driver not found." };
  }

  const profileId = String(existing.data.profile_id);

  const { data: activeDeliveries, error: activeError } = await client
    .from("delivery_orders")
    .select("id")
    .eq("driver_id", driverId)
    .not("status", "in", "(DELIVERED,CANCELLED)")
    .limit(1);

  if (activeError) {
    return { ok: false, error: activeError.message };
  }
  if (activeDeliveries && activeDeliveries.length > 0) {
    return {
      ok: false,
      error:
        "This driver has active deliveries. Reassign or complete them before deleting.",
    };
  }

  const { error: deliveryClearError } = await client
    .from("delivery_orders")
    .update({ driver_id: null, updated_at: new Date().toISOString() })
    .eq("driver_id", driverId);
  if (deliveryClearError) {
    return { ok: false, error: deliveryClearError.message };
  }

  const { error: orderClearError } = await client
    .from("orders")
    .update({ driver_id: null, updated_at: new Date().toISOString() })
    .eq("driver_id", profileId);
  if (orderClearError) {
    return { ok: false, error: orderClearError.message };
  }

  const { error: deleteAuthError } = await client.auth.admin.deleteUser(profileId);
  if (deleteAuthError) {
    return { ok: false, error: deleteAuthError.message };
  }

  return { ok: true };
}

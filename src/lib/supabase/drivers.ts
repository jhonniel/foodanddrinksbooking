import "server-only";

import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import type { Driver, DriverStatus, Profile, UserRole } from "@/types";

const DRIVER_SELECT = `
  id, profile_id, vehicle_type, vehicle_number, license_number,
  status, rating, total_deliveries, is_active, created_at, updated_at,
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
  if (!isSupabaseConfigured() || !getSupabaseServiceRoleKey()) return null;
  return createServerClient();
}

export async function fetchDriverByProfileId(
  profileId: string
): Promise<Driver | null> {
  const client = await getAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from("drivers")
    .select(DRIVER_SELECT)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDriverRow(data as unknown as Record<string, unknown>);
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
  if (existing) return { driver: existing };

  const client = await getAdminClient();
  if (!client) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required to create a driver profile.",
    };
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
    .select(DRIVER_SELECT)
    .single();

  if (error || !data) {
    // Race: another request created it
    const again = await fetchDriverByProfileId(profile.id);
    if (again) return { driver: again };
    console.error("[drivers] ensure insert failed:", error?.message);
    return { error: error?.message || "Could not create driver profile." };
  }

  return { driver: mapDriverRow(data as unknown as Record<string, unknown>) };
}

function canBeDriverRole(role: string): boolean {
  return role === "DRIVER" || role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function updateDriverStatusInSupabase(
  profileId: string,
  status: DriverStatus,
  location?: { lat: number; lng: number } | null
): Promise<{ driver?: Driver; error?: string }> {
  const client = await getAdminClient();
  if (!client) {
    return { error: "Supabase service role is required." };
  }

  const ensured = await fetchDriverByProfileId(profileId);
  if (!ensured) {
    return { error: "No driver profile linked to this account." };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("drivers")
    .update({ status, updated_at: now })
    .eq("id", ensured.id);

  if (error) return { error: error.message };

  if (location) {
    await client.from("driver_locations").insert({
      driver_id: ensured.id,
      latitude: location.lat,
      longitude: location.lng,
      recorded_at: now,
    });
  }

  const refreshed = await fetchDriverByProfileId(profileId);
  return { driver: refreshed ?? { ...ensured, status } };
}

export async function listDriversFromSupabase(): Promise<Driver[] | null> {
  const client = await getAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from("drivers")
    .select(DRIVER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[drivers] list failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) =>
    mapDriverRow(row as unknown as Record<string, unknown>)
  );
}

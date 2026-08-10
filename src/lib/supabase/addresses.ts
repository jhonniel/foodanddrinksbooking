import "server-only";

import type { Address } from "@/types";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth/config";

export const MAX_CUSTOMER_ADDRESSES = 3;

export function mapAddress(row: Record<string, unknown>): Address {
  return {
    id: String(row.id),
    customer_id: String(row.customer_id),
    label: String(row.label ?? "Home"),
    full_address: String(row.full_address ?? ""),
    barangay: (row.barangay as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    postal_code: (row.postal_code as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    delivery_instructions:
      (row.delivery_instructions as string | null) ?? null,
    is_default: Boolean(row.is_default),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listAddressesForCustomer(
  customerId: string
): Promise<Address[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[addresses] list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapAddress(row as Record<string, unknown>));
}

export async function countAddressesForCustomer(
  customerId: string
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const client = await createServerClient();
  if (!client) return 0;

  const { count, error } = await client
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);

  if (error) return 0;
  return count ?? 0;
}

export type AddressWriteInput = {
  label: string;
  fullAddress: string;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  deliveryInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

async function clearDefaultFlags(
  customerId: string,
  exceptId?: string
): Promise<void> {
  const client = await createServerClient();
  if (!client) return;
  let q = client
    .from("addresses")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

export async function createAddressForCustomer(
  customerId: string,
  input: AddressWriteInput
): Promise<{ address: Address } | { error: string; status?: number }> {
  if (!isSupabaseConfigured()) {
    return { error: "Address storage requires Supabase.", status: 503 };
  }
  const client = await createServerClient();
  if (!client) return { error: "Database unavailable.", status: 500 };

  const count = await countAddressesForCustomer(customerId);
  if (count >= MAX_CUSTOMER_ADDRESSES) {
    return {
      error: `You can save up to ${MAX_CUSTOMER_ADDRESSES} addresses.`,
      status: 400,
    };
  }

  const makeDefault = Boolean(input.isDefault) || count === 0;
  if (makeDefault) {
    await clearDefaultFlags(customerId);
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("addresses")
    .insert({
      customer_id: customerId,
      label: input.label.trim() || "Home",
      full_address: input.fullAddress.trim(),
      barangay: input.barangay?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      delivery_instructions: input.deliveryInstructions?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_default: makeDefault,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message || "Could not save address.", status: 500 };
  }

  return { address: mapAddress(data as Record<string, unknown>) };
}

export async function updateAddressForCustomer(
  customerId: string,
  addressId: string,
  input: Partial<AddressWriteInput>
): Promise<{ address: Address } | { error: string; status?: number }> {
  if (!isSupabaseConfigured()) {
    return { error: "Address storage requires Supabase.", status: 503 };
  }
  const client = await createServerClient();
  if (!client) return { error: "Database unavailable.", status: 500 };

  const { data: existing } = await client
    .from("addresses")
    .select("id")
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!existing) {
    return { error: "Address not found.", status: 404 };
  }

  if (input.isDefault === true) {
    await clearDefaultFlags(customerId, addressId);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.label != null) patch.label = input.label.trim() || "Home";
  if (input.fullAddress != null) patch.full_address = input.fullAddress.trim();
  if (input.barangay !== undefined) {
    patch.barangay = input.barangay?.trim() || null;
  }
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.province !== undefined) {
    patch.province = input.province?.trim() || null;
  }
  if (input.postalCode !== undefined) {
    patch.postal_code = input.postalCode?.trim() || null;
  }
  if (input.deliveryInstructions !== undefined) {
    patch.delivery_instructions =
      input.deliveryInstructions?.trim() || null;
  }
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.isDefault !== undefined) patch.is_default = input.isDefault;

  const { data, error } = await client
    .from("addresses")
    .update(patch)
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message || "Could not update address.", status: 500 };
  }

  return { address: mapAddress(data as Record<string, unknown>) };
}

export async function deleteAddressForCustomer(
  customerId: string,
  addressId: string
): Promise<{ ok: true } | { error: string; status?: number }> {
  if (!isSupabaseConfigured()) {
    return { error: "Address storage requires Supabase.", status: 503 };
  }
  const client = await createServerClient();
  if (!client) return { error: "Database unavailable.", status: 500 };

  const { data: existing } = await client
    .from("addresses")
    .select("id, is_default")
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!existing) {
    return { error: "Address not found.", status: 404 };
  }

  const { error } = await client
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("customer_id", customerId);

  if (error) {
    return { error: error.message, status: 500 };
  }

  if (existing.is_default) {
    const remaining = await listAddressesForCustomer(customerId);
    if (remaining[0]) {
      await updateAddressForCustomer(customerId, remaining[0].id, {
        isDefault: true,
      });
    }
  }

  return { ok: true };
}

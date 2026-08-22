import "server-only";

import type { Reward, RewardType } from "@/types";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";

type DbReward = {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  points_required: number;
  discount_value: number | string | null;
  free_product_id: string | null;
  image_url: string | null;
  is_active: boolean;
  max_redemptions: number | null;
  current_redemptions: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapReward(row: DbReward): Reward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    points_required: Number(row.points_required),
    discount_value:
      row.discount_value != null ? Number(row.discount_value) : null,
    free_product_id: row.free_product_id,
    image_url: row.image_url,
    is_active: row.is_active,
    max_redemptions: row.max_redemptions,
    current_redemptions: Number(row.current_redemptions ?? 0),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listRewardsFromSupabase(): Promise<Reward[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("rewards")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return (data as DbReward[]).map(mapReward);
}

export async function saveRewardInSupabase(input: {
  id?: string;
  name: string;
  description?: string | null;
  type?: RewardType;
  pointsRequired: number;
  discountValue?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<{ reward?: Reward; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const now = new Date().toISOString();
  const row = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    type: input.type ?? "POINTS_DISCOUNT",
    points_required: input.pointsRequired,
    discount_value: input.discountValue ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
    updated_at: now,
  };

  const query = input.id
    ? client.from("rewards").upsert(row).select("*").single()
    : client.from("rewards").insert(row).select("*").single();

  const { data, error } = await query;
  if (error || !data) {
    return { error: error?.message || "Could not save reward." };
  }

  return { reward: mapReward(data as DbReward) };
}

export async function deleteRewardInSupabase(
  rewardId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client.from("rewards").delete().eq("id", rewardId);
  if (error) return { error: error.message };
  return {};
}

export async function setRewardActiveInSupabase(
  rewardId: string,
  isActive: boolean
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client
    .from("rewards")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", rewardId);

  if (error) return { error: error.message };
  return {};
}

import { useDataStore } from "@/stores/data";
import type { LoyaltySettings, Reward } from "@/types";
import { LOYALTY_SETTINGS } from "@/data/demo";

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  return LOYALTY_SETTINGS;
}

export async function getRewards(): Promise<Reward[]> {
  return useDataStore
    .getState()
    .rewards.filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Amount that can earn loyalty points / count toward promo & free-delivery
 * minimums: product subtotal after discounts. Delivery fee is never included.
 */
export function getPointsEarnBase(
  subtotal: number,
  discount = 0,
  pointsDiscount = 0
): number {
  return Math.max(0, subtotal - discount - pointsDiscount);
}

export function calculatePointsEarned(
  amount: number,
  settings = LOYALTY_SETTINGS
): number {
  if (!settings.is_active) return 0;
  return Math.floor(Math.max(0, amount) * settings.points_per_peso);
}

/** Points from an order’s item total (excludes delivery fee). */
export function calculateOrderPointsEarned(
  input: {
    subtotal: number;
    discount?: number;
    pointsDiscount?: number;
  },
  settings = LOYALTY_SETTINGS
): number {
  return calculatePointsEarned(
    getPointsEarnBase(
      input.subtotal,
      input.discount ?? 0,
      input.pointsDiscount ?? 0
    ),
    settings
  );
}

export function calculatePointsDiscount(
  points: number,
  settings = LOYALTY_SETTINGS
): number {
  return points * settings.peso_per_point;
}

export function canRedeem(
  pointsBalance: number,
  reward: Reward
): { ok: boolean; reason?: string } {
  if (!reward.is_active) return { ok: false, reason: "Reward is not available." };
  if (pointsBalance < reward.points_required) {
    return {
      ok: false,
      reason: `You need ${reward.points_required - pointsBalance} more points.`,
    };
  }
  if (
    reward.max_redemptions !== null &&
    reward.current_redemptions >= reward.max_redemptions
  ) {
    return { ok: false, reason: "This reward is fully redeemed." };
  }
  return { ok: true };
}

export function getNextRewardProgress(
  points: number,
  rewards?: Reward[]
): { current: number; next: number; reward: Reward | null; percent: number } {
  const list =
    rewards ||
    useDataStore
      .getState()
      .rewards.filter((r) => r.is_active)
      .sort((a, b) => a.points_required - b.points_required);

  const sorted = [...list].sort((a, b) => a.points_required - b.points_required);
  const next =
    sorted.find((r) => r.points_required > points) ||
    sorted[sorted.length - 1];
  if (!next) return { current: points, next: 0, reward: null, percent: 100 };
  const prev =
    sorted.filter((r) => r.points_required <= points).pop()?.points_required ||
    0;
  const range = next.points_required - prev || 1;
  const progress = points - prev;
  const percent = Math.min(100, Math.round((progress / range) * 100));
  return { current: points, next: next.points_required, reward: next, percent };
}

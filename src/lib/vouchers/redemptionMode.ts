import type { Promotion, VoucherRedemptionMode } from "@/types";

export function normalizeRedemptionMode(value: unknown): VoucherRedemptionMode {
  return value === "MANUAL" ? "MANUAL" : "CLAIM";
}

export function isClaimRedemption(promo: Pick<Promotion, "redemption_mode">): boolean {
  return normalizeRedemptionMode(promo.redemption_mode) === "CLAIM";
}

export function isManualRedemption(
  promo: Pick<Promotion, "redemption_mode">
): boolean {
  return normalizeRedemptionMode(promo.redemption_mode) === "MANUAL";
}

export function redemptionModeLabel(mode: VoucherRedemptionMode): string {
  return mode === "MANUAL" ? "Manual code in Cart" : "Claim on Rewards";
}

export function requiresVoucherWallet(
  promo: Pick<Promotion, "redemption_mode">
): boolean {
  return isClaimRedemption(promo) || isManualRedemption(promo);
}

export function redemptionModeHint(mode: VoucherRedemptionMode): string {
  return mode === "MANUAL"
    ? "Customers enter the code on Rewards → Redeem a code."
    : "Customers tap Claim on Rewards.";
}

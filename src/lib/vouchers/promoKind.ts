import type { PromoKind, Promotion } from "@/types";

export function normalizePromoKind(value: unknown): PromoKind {
  return value === "PROMOTION" ? "PROMOTION" : "VOUCHER";
}

export function isVoucherKind(
  promo: Pick<Promotion, "kind">
): boolean {
  return normalizePromoKind(promo.kind) === "VOUCHER";
}

export function isPromotionKind(
  promo: Pick<Promotion, "kind">
): boolean {
  return normalizePromoKind(promo.kind) === "PROMOTION";
}

export function promoKindLabel(kind: PromoKind): string {
  return kind === "PROMOTION" ? "Promotion" : "Voucher";
}

export function promoKindHint(kind: PromoKind): string {
  return kind === "PROMOTION"
    ? "Shows on the home page for customers to browse deals."
    : "Customers redeem on Rewards and use at checkout.";
}

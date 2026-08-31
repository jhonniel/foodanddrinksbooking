import type { Promotion } from "@/types";
import { isPromotionKind, isVoucherKind } from "@/lib/vouchers/promoKind";

export function isPromotionCurrentlyValid(
  promo: Promotion,
  now = new Date()
): { ok: true } | { ok: false; error: string } {
  if (!promo.is_active) {
    return { ok: false, error: "This voucher is no longer active." };
  }
  if (isVoucherKind(promo) && !promo.promo_code) {
    return { ok: false, error: "Invalid voucher code." };
  }
  const start = new Date(promo.starts_at);
  if (Number.isFinite(start.getTime()) && now < start) {
    return { ok: false, error: "This voucher is not available yet." };
  }
  if (promo.ends_at) {
    const end = new Date(promo.ends_at);
    if (Number.isFinite(end.getTime()) && now > end) {
      return { ok: false, error: "This voucher has expired." };
    }
  }
  if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) {
    return { ok: false, error: "This voucher has reached its redeem limit." };
  }
  return { ok: true };
}

/** Active, in-date, and not sold out — safe to show customers. */
export function isPromotionVisibleToCustomers(
  promo: Promotion,
  now = new Date()
): boolean {
  return isPromotionCurrentlyValid(promo, now).ok;
}

/** Home-page promotion cards (kind = PROMOTION). */
export function isHomePromotionVisible(
  promo: Promotion,
  now = new Date()
): boolean {
  if (!isPromotionKind(promo)) return false;
  return isPromotionCurrentlyValid(promo, now).ok;
}

import { createServerClient } from "@/lib/supabase/server";
import { normalizeUsageLimit } from "@/lib/vouchers/usageLimit";
import type { Promotion, PromotionType, VoucherClaim } from "@/types";

export function mapPromotion(row: Record<string, unknown>): Promotion {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    promo_code: (row.promo_code as string | null) ?? null,
    type: (row.type as PromotionType) || "FIXED",
    discount_value: Number(row.discount_value ?? 0),
    min_order_amount: Number(row.min_order_amount ?? 0),
    max_discount:
      row.max_discount != null ? Number(row.max_discount) : null,
    usage_limit: row.usage_limit != null ? Number(row.usage_limit) : null,
    usage_count: Number(row.usage_count ?? 0),
    per_customer_limit:
      row.per_customer_limit != null ? Number(row.per_customer_limit) : 1,
    starts_at: String(row.starts_at ?? new Date().toISOString()),
    ends_at: row.ends_at != null ? String(row.ends_at) : null,
    is_active: Boolean(row.is_active ?? true),
    image_url: (row.image_url as string | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export function isPromotionCurrentlyValid(
  promo: Promotion,
  now = new Date()
): { ok: true } | { ok: false; error: string } {
  if (!promo.is_active) {
    return { ok: false, error: "This voucher is no longer active." };
  }
  if (!promo.promo_code) {
    return { ok: false, error: "Invalid voucher code." };
  }
  const start = new Date(promo.starts_at);
  if (Number.isFinite(start.getTime()) && now < start) {
    return { ok: false, error: "This voucher is not available yet." };
  }
  // null ends_at = never expires
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

export function computePromoDiscount(
  promo: Promotion,
  subtotal: number
): number {
  if (subtotal < promo.min_order_amount) return 0;
  let discount = 0;
  if (promo.type === "PERCENTAGE") {
    discount = (subtotal * promo.discount_value) / 100;
    if (promo.max_discount != null) {
      discount = Math.min(discount, promo.max_discount);
    }
  } else {
    discount = promo.discount_value;
  }
  return Math.max(0, Math.min(discount, subtotal));
}

export async function listPromotionsFromSupabase(): Promise<Promotion[]> {
  const client = await createServerClient();
  if (!client) return [];
  const { data, error } = await client
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => mapPromotion(row as Record<string, unknown>));
}

export async function findPromotionByCode(
  code: string
): Promise<Promotion | null> {
  const client = await createServerClient();
  if (!client) return null;
  const normalized = code.trim().toUpperCase();
  const { data, error } = await client
    .from("promotions")
    .select("*")
    .eq("promo_code", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return mapPromotion(data as Record<string, unknown>);
}

export type CreateVoucherInput = {
  name: string;
  description?: string | null;
  promoCode: string;
  type: PromotionType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  /** Omit or null = never expires */
  endsAt?: string | null;
  startsAt?: string;
  perCustomerLimit?: number;
};

export async function createVoucherInSupabase(
  input: CreateVoucherInput
): Promise<{ promotion: Promotion } | { error: string; status?: number }> {
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured.", status: 503 };

  const code = input.promoCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return {
      error: "Code must be 3–32 characters (letters, numbers, _ or -).",
      status: 400,
    };
  }
  const usageLimit = normalizeUsageLimit(input.usageLimit);

  let endsAtIso: string | null = null;
  if (input.endsAt) {
    const endsAt = new Date(input.endsAt);
    if (!Number.isFinite(endsAt.getTime()) || endsAt <= new Date()) {
      return { error: "Expiration must be a future date.", status: 400 };
    }
    endsAtIso = endsAt.toISOString();
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();

  const { data, error } = await client
    .from("promotions")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      promo_code: code,
      type: input.type,
      discount_value: input.discountValue,
      min_order_amount: input.minOrderAmount ?? 0,
      max_discount: input.maxDiscount ?? null,
      usage_limit: usageLimit,
      usage_count: 0,
      per_customer_limit: input.perCustomerLimit ?? 1,
      starts_at: startsAt.toISOString(),
      ends_at: endsAtIso,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (/duplicate|unique/i.test(error?.message ?? "")) {
      return { error: "That voucher code already exists.", status: 409 };
    }
    return {
      error: error?.message ?? "Could not create voucher.",
      status: 400,
    };
  }

  return { promotion: mapPromotion(data as Record<string, unknown>) };
}

export async function setVoucherActiveInSupabase(
  id: string,
  isActive: boolean
): Promise<{ promotion: Promotion } | { error: string; status?: number }> {
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured.", status: 503 };

  const { data, error } = await client
    .from("promotions")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message ?? "Voucher not found.", status: 404 };
  }
  return { promotion: mapPromotion(data as Record<string, unknown>) };
}

export type UpdateVoucherInput = {
  name?: string;
  description?: string | null;
  promoCode?: string;
  type?: PromotionType;
  discountValue?: number;
  minOrderAmount?: number;
  usageLimit?: number | null;
  /** null clears expiration (never expires) */
  endsAt?: string | null;
  isActive?: boolean;
};

export async function updateVoucherInSupabase(
  id: string,
  input: UpdateVoucherInput
): Promise<{ promotion: Promotion } | { error: string; status?: number }> {
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured.", status: 503 };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name != null) patch.name = input.name.trim();
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.promoCode != null) {
    const code = input.promoCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return {
        error: "Code must be 3–32 characters (letters, numbers, _ or -).",
        status: 400,
      };
    }
    patch.promo_code = code;
  }
  if (input.type != null) patch.type = input.type;
  if (input.discountValue != null) patch.discount_value = input.discountValue;
  if (input.minOrderAmount != null) {
    patch.min_order_amount = input.minOrderAmount;
  }
  if (input.usageLimit !== undefined) {
    patch.usage_limit = normalizeUsageLimit(input.usageLimit);
  }
  if (input.endsAt !== undefined) {
    if (input.endsAt == null || input.endsAt === "") {
      patch.ends_at = null;
    } else {
      const endsAt = new Date(input.endsAt);
      if (!Number.isFinite(endsAt.getTime())) {
        return { error: "Invalid expiration date.", status: 400 };
      }
      patch.ends_at = endsAt.toISOString();
    }
  }
  if (input.isActive != null) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("promotions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (/duplicate|unique/i.test(error?.message ?? "")) {
      return { error: "That voucher code already exists.", status: 409 };
    }
    return { error: error?.message ?? "Voucher not found.", status: 404 };
  }
  return { promotion: mapPromotion(data as Record<string, unknown>) };
}

export async function deleteVoucherInSupabase(
  id: string
): Promise<{ ok: true } | { error: string; status?: number }> {
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured.", status: 503 };

  // Clear claims first (FK may not cascade on all installs)
  await client.from("voucher_claims").delete().eq("promotion_id", id);

  const { error } = await client.from("promotions").delete().eq("id", id);
  if (error) {
    return { error: error.message || "Could not delete voucher.", status: 400 };
  }
  return { ok: true };
}

export async function countClaimsForPromotion(
  promotionId: string
): Promise<number> {
  const client = await createServerClient();
  if (!client) return 0;
  const { count } = await client
    .from("voucher_claims")
    .select("id", { count: "exact", head: true })
    .eq("promotion_id", promotionId);
  return count ?? 0;
}

export async function listClaimableVouchersForCustomer(
  customerId: string
): Promise<{
  available: Promotion[];
  claimed: VoucherClaim[];
}> {
  const client = await createServerClient();
  if (!client) return { available: [], claimed: [] };

  const nowIso = new Date().toISOString();
  const { data: promos } = await client
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .not("promo_code", "is", null)
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("created_at", { ascending: false });

  const { data: claims } = await client
    .from("voucher_claims")
    .select("*, promotions(*)")
    .eq("customer_id", customerId)
    .order("claimed_at", { ascending: false });

  const claimedIds = new Set(
    (claims ?? []).map((c) =>
      String((c as { promotion_id: string }).promotion_id)
    )
  );

  const claimed: VoucherClaim[] = (claims ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const promoRow = r.promotions as Record<string, unknown> | null;
    return {
      id: String(r.id),
      promotion_id: String(r.promotion_id),
      customer_id: String(r.customer_id),
      claimed_at: String(r.claimed_at),
      promotion: promoRow ? mapPromotion(promoRow) : undefined,
    };
  });

  const available = (promos ?? [])
    .map((row) => mapPromotion(row as Record<string, unknown>))
    .filter((p) => {
      if (claimedIds.has(p.id)) return false;
      if (p.usage_limit != null && p.usage_count >= p.usage_limit) return false;
      return true;
    });

  return { available, claimed };
}

export async function claimVoucherForCustomer(
  customerId: string,
  promotionId: string
): Promise<
  | { claim: VoucherClaim; promotion: Promotion }
  | { error: string; status?: number }
> {
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured.", status: 503 };

  const { data: promoRow, error: promoError } = await client
    .from("promotions")
    .select("*")
    .eq("id", promotionId)
    .maybeSingle();

  if (promoError || !promoRow) {
    return { error: "Voucher not found.", status: 404 };
  }

  const promo = mapPromotion(promoRow as Record<string, unknown>);
  const validity = isPromotionCurrentlyValid(promo);
  if (!validity.ok) return { error: validity.error, status: 400 };

  const claimCount = await countClaimsForPromotion(promotionId);
  if (promo.usage_limit != null && claimCount >= promo.usage_limit) {
    return { error: "This voucher has reached its redeem limit.", status: 409 };
  }

  const { data: existing } = await client
    .from("voucher_claims")
    .select("id")
    .eq("promotion_id", promotionId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing) {
    return { error: "You already claimed this voucher.", status: 409 };
  }

  const { data: claimRow, error: claimError } = await client
    .from("voucher_claims")
    .insert({
      promotion_id: promotionId,
      customer_id: customerId,
    })
    .select("*")
    .single();

  if (claimError || !claimRow) {
    if (/duplicate|unique/i.test(claimError?.message ?? "")) {
      return { error: "You already claimed this voucher.", status: 409 };
    }
    if (
      /relation.*does not exist|voucher_claims/i.test(claimError?.message ?? "")
    ) {
      return {
        error:
          "Voucher claims table missing. Run supabase/migrations/007_voucher_claims.sql in the SQL Editor.",
        status: 500,
      };
    }
    return {
      error: claimError?.message ?? "Could not claim voucher.",
      status: 400,
    };
  }

  await client
    .from("promotions")
    .update({
      usage_count: claimCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", promotionId);

  const r = claimRow as Record<string, unknown>;
  return {
    promotion: promo,
    claim: {
      id: String(r.id),
      promotion_id: String(r.promotion_id),
      customer_id: String(r.customer_id),
      claimed_at: String(r.claimed_at),
      promotion: promo,
    },
  };
}

export async function validatePromoAgainstSupabase(
  code: string,
  subtotal: number,
  _customerId?: string | null
): Promise<{
  valid: boolean;
  discount: number;
  promotion?: Promotion;
  error?: string;
}> {
  const promo = await findPromotionByCode(code);
  if (!promo) {
    return { valid: false, discount: 0, error: "Invalid voucher code." };
  }

  const validity = isPromotionCurrentlyValid(promo);
  if (!validity.ok) {
    return { valid: false, discount: 0, error: validity.error };
  }

  if (subtotal < promo.min_order_amount) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order of ₱${promo.min_order_amount} required (items only; delivery fee does not count).`,
    };
  }

  const discount = computePromoDiscount(promo, subtotal);
  return { valid: true, discount, promotion: promo };
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import { promoCodeSchema } from "@/schemas";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSessionProfileFromRequest } from "@/lib/auth/server";
import { PROMOTIONS } from "@/data/demo";
import {
  computePromoDiscount,
  isPromotionCurrentlyValid,
  validatePromoAgainstSupabase,
} from "@/lib/supabase/vouchers";

const bodySchema = promoCodeSchema.and(
  z.object({
    subtotal: z.number().nonnegative(),
  })
);

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = rateLimit(`promo:${ip}`, 20, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid promo request.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { code, subtotal } = parsed.data;
  const session = await getSessionProfileFromRequest(request);

  if (isSupabaseConfigured()) {
    const result = await validatePromoAgainstSupabase(
      code,
      subtotal,
      session?.id
    );
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      discount: result.discount,
      promotion: result.promotion,
    });
  }

  const promo = PROMOTIONS.find(
    (p) => p.promo_code?.toUpperCase() === code.toUpperCase() && p.is_active
  );
  if (!promo) {
    return NextResponse.json({ error: "Invalid voucher code." }, { status: 400 });
  }
  const validity = isPromotionCurrentlyValid(promo);
  if (!validity.ok) {
    return NextResponse.json({ error: validity.error }, { status: 400 });
  }
  if (subtotal < promo.min_order_amount) {
    return NextResponse.json(
      {
        error: `Minimum order of ₱${promo.min_order_amount} required (items only; delivery fee does not count).`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    discount: computePromoDiscount(promo, subtotal),
    promotion: promo,
  });
}

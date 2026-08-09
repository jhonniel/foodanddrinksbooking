import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import { promoCodeSchema } from "@/schemas";
import { validatePromoCode } from "@/services/productService";

const bodySchema = promoCodeSchema.and(
  z.object({
    subtotal: z.number().nonnegative(),
  })
);

export async function POST(request: Request) {
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

  const result = await validatePromoCode(parsed.data.code, parsed.data.subtotal);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    discount: result.discount,
    promotion: result.promotion,
  });
}

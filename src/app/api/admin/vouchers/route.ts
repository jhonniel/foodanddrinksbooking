import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  createVoucherInSupabase,
  listPromotionsFromSupabase,
} from "@/lib/supabase/vouchers";
import { optionalUsageLimitSchema } from "@/lib/vouchers/usageLimit";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().nullable(),
  promoCode: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const trimmed = (v ?? "").trim().toUpperCase();
      return trimmed || null;
    }),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().nonnegative().optional().default(0),
  maxDiscount: z.coerce.number().positive().optional().nullable(),
  usageLimit: optionalUsageLimitSchema,
  endsAt: z.string().min(8).optional().nullable(),
  perCustomerLimit: z.coerce.number().int().min(1).max(10).optional().default(1),
  redemptionMode: z.enum(["CLAIM", "MANUAL"]).optional().default("CLAIM"),
  kind: z.enum(["VOUCHER", "PROMOTION"]).optional().default("VOUCHER"),
}).superRefine((data, ctx) => {
  if (data.kind === "VOUCHER" && !data.promoCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vouchers require a promo code.",
      path: ["promoCode"],
    });
  }
  if (data.promoCode && !/^[A-Z0-9_-]{3,32}$/.test(data.promoCode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Code must be 3–32 characters (letters, numbers, _ or -).",
      path: ["promoCode"],
    });
  }
});

export async function GET(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required for vouchers.", vouchers: [] },
      { status: 503 }
    );
  }

  const vouchers = await listPromotionsFromSupabase();
  return NextResponse.json({ vouchers });
}

export async function POST(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required for vouchers." },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.type === "PERCENTAGE" && data.discountValue > 100) {
    return NextResponse.json(
      { error: "Percentage discount cannot exceed 100%." },
      { status: 400 }
    );
  }

  const result = await createVoucherInSupabase({
    name: data.name,
    description: data.description,
    promoCode: data.promoCode,
    type: data.type,
    discountValue: data.discountValue,
    minOrderAmount: data.minOrderAmount,
    maxDiscount: data.maxDiscount ?? null,
    usageLimit: data.usageLimit ?? null,
    endsAt: data.endsAt ?? null,
    perCustomerLimit: data.perCustomerLimit,
    redemptionMode: data.redemptionMode,
    kind: data.kind,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ voucher: result.promotion }, { status: 201 });
}

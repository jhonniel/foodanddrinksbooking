import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  deleteVoucherInSupabase,
  setVoucherActiveInSupabase,
  updateVoucherInSupabase,
} from "@/lib/supabase/vouchers";
import { optionalUsageLimitSchema } from "@/lib/vouchers/usageLimit";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(300).optional().nullable(),
  promoCode: z
    .string()
    .min(3)
    .max(32)
    .transform((v) => v.trim().toUpperCase())
    .optional(),
  type: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().positive().optional(),
  minOrderAmount: z.coerce.number().nonnegative().optional(),
  usageLimit: optionalUsageLimitSchema,
  endsAt: z.string().min(8).optional().nullable(),
  redemptionMode: z.enum(["CLAIM", "MANUAL"]).optional(),
  kind: z.enum(["VOUCHER", "PROMOTION"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Simple enable/disable only
  if (
    data.isActive != null &&
    data.name == null &&
    data.promoCode == null &&
    data.discountValue == null &&
    data.usageLimit == null &&
    data.endsAt == null &&
    data.type == null &&
    data.minOrderAmount == null &&
    data.redemptionMode == null &&
    data.kind == null &&
    data.description === undefined
  ) {
    const result = await setVoucherActiveInSupabase(id, data.isActive);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 }
      );
    }
    return NextResponse.json({ voucher: result.promotion });
  }

  if (data.type === "PERCENTAGE" && data.discountValue != null && data.discountValue > 100) {
    return NextResponse.json(
      { error: "Percentage discount cannot exceed 100%." },
      { status: 400 }
    );
  }

  const result = await updateVoucherInSupabase(id, {
    name: data.name,
    description: data.description,
    promoCode: data.promoCode,
    type: data.type,
    discountValue: data.discountValue,
    minOrderAmount: data.minOrderAmount,
    usageLimit: data.usageLimit,
    endsAt: data.endsAt,
    isActive: data.isActive,
    redemptionMode: data.redemptionMode,
    kind: data.kind,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ voucher: result.promotion });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;
  const result = await deleteVoucherInSupabase(id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import { adjustCustomerPoints } from "@/lib/supabase/loyalty";
import { generateIdempotencyKey } from "@/lib/utils/format";

const bodySchema = z.object({
  amount: z.coerce.number().int().refine((n) => n !== 0, "Amount cannot be zero."),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required for points adjustments." },
      { status: 503 }
    );
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required to grant or adjust customer points.",
      },
      { status: 503 }
    );
  }

  const { id: customerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const client = await createServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase client unavailable." },
      { status: 503 }
    );
  }

  const result = await adjustCustomerPoints(client, {
    customerId,
    amount: parsed.data.amount,
    note: parsed.data.note,
    adminName: profile.full_name,
    idempotencyKey: `adjust:${customerId}:${generateIdempotencyKey()}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    transaction: result.transaction,
    pointsBalance: result.pointsBalance,
    lifetimePoints: result.lifetimePoints,
  });
}

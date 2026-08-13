import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileFromRequest } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  claimVoucherForCustomer,
  listClaimableVouchersForCustomer,
} from "@/lib/supabase/vouchers";

export async function GET(request: NextRequest) {
  const session = await getSessionProfileFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      available: [],
      claimed: [],
      configured: false,
    });
  }

  const data = await listClaimableVouchersForCustomer(session.id);
  return NextResponse.json({ ...data, configured: true });
}

const claimSchema = z.object({
  promotionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getSessionProfileFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required to claim vouchers." },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = claimSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid voucher." }, { status: 400 });
  }

  const result = await claimVoucherForCustomer(
    session.id,
    parsed.data.promotionId
  );

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({
    claim: result.claim,
    voucher: result.promotion,
  });
}

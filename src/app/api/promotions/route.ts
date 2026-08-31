import { NextRequest, NextResponse } from "next/server";
import { assertRole, getSessionProfileFromRequest } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  listCustomerPromotionsFromSupabase,
  listPromotionsFromSupabase,
} from "@/lib/supabase/vouchers";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, promotions: [] });
  }

  const session = await getSessionProfileFromRequest(request);
  const promotions = assertRole(session, "staff")
    ? await listPromotionsFromSupabase()
    : await listCustomerPromotionsFromSupabase();

  return NextResponse.json({ configured: true, promotions });
}

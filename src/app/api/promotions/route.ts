import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { listPromotionsFromSupabase } from "@/lib/supabase/vouchers";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, promotions: [] });
  }

  const promotions = await listPromotionsFromSupabase();
  return NextResponse.json({ configured: true, promotions });
}

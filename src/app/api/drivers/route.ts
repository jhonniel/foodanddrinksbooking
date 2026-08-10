import { NextRequest, NextResponse } from "next/server";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { canAccessAdmin, isSupabaseConfigured } from "@/lib/auth/config";
import { listDriversFromSupabase } from "@/lib/supabase/drivers";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required.", drivers: [] },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff") || !canAccessAdmin(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const drivers = await listDriversFromSupabase();
  if (!drivers) {
    return NextResponse.json(
      { error: "Could not load drivers from Supabase.", drivers: [] },
      { status: 502 }
    );
  }

  return NextResponse.json({ drivers });
}

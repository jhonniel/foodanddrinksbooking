import { NextRequest, NextResponse } from "next/server";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { deleteRewardInSupabase } from "@/lib/supabase/rewards";

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
      { error: "Supabase is required for rewards." },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  const result = await deleteRewardInSupabase(id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

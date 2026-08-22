import { NextRequest, NextResponse } from "next/server";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { markNotificationReadInSupabase } from "@/lib/supabase/notifications";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const { id } = await context.params;
  const result = await markNotificationReadInSupabase(id, profile.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

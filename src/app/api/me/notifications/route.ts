import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  createNotificationInSupabase,
  listNotificationsForUser,
  markAllNotificationsReadInSupabase,
} from "@/lib/supabase/notifications";
import { canAccessAdmin } from "@/lib/auth/config";

export async function GET(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, notifications: [] });
  }

  const notifications = await listNotificationsForUser(profile.id, {
    isStaff: canAccessAdmin(profile.role),
  });

  return NextResponse.json({ configured: true, notifications });
}

const createSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum([
    "ORDER",
    "DELIVERY",
    "POINTS",
    "REWARD",
    "PROMOTION",
    "SYSTEM",
    "INVENTORY",
  ]),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed." }, { status: 422 });
  }

  if (
    parsed.data.userId !== profile.id &&
    !canAccessAdmin(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notification = await createNotificationInSupabase(parsed.data);
  if (!notification) {
    return NextResponse.json(
      { error: "Could not create notification." },
      { status: 400 }
    );
  }

  return NextResponse.json({ notification });
}

export async function PATCH(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const result = await markAllNotificationsReadInSupabase(profile.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

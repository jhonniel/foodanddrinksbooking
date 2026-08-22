import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  deleteRewardInSupabase,
  listRewardsFromSupabase,
  saveRewardInSupabase,
  setRewardActiveInSupabase,
} from "@/lib/supabase/rewards";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  type: z
    .enum([
      "POINTS_DISCOUNT",
      "PERCENTAGE_DISCOUNT",
      "FIXED_DISCOUNT",
      "FREE_PRODUCT",
      "PROMOTIONAL",
    ])
    .optional(),
  pointsRequired: z.coerce.number().int().positive(),
  discountValue: z.coerce.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, rewards: [] });
  }

  const rewards = await listRewardsFromSupabase();
  return NextResponse.json({ configured: true, rewards });
}

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed." }, { status: 422 });
  }

  const result = await saveRewardInSupabase(parsed.data);
  if (result.error || !result.reward) {
    return NextResponse.json(
      { error: result.error || "Could not save reward." },
      { status: 400 }
    );
  }

  return NextResponse.json({ reward: result.reward });
}

export async function PATCH(request: NextRequest) {
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

  const json = (await request.json().catch(() => null)) as {
    id?: string;
    isActive?: boolean;
  } | null;

  if (!json?.id) {
    return NextResponse.json({ error: "Reward id is required." }, { status: 400 });
  }

  if (typeof json.isActive === "boolean") {
    const result = await setRewardActiveInSupabase(json.id, json.isActive);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed." }, { status: 422 });
  }

  const result = await saveRewardInSupabase({ ...parsed.data, id: json.id });
  if (result.error || !result.reward) {
    return NextResponse.json(
      { error: result.error || "Could not update reward." },
      { status: 400 }
    );
  }

  return NextResponse.json({ reward: result.reward });
}

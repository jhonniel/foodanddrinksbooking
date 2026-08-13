import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromCookies,
} from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { upsertCategoryInSupabase } from "@/lib/supabase/catalog";
import type { Category } from "@/types";

const categorySchema = z.object({
  category: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().nullable(),
    image_url: z.string().nullable(),
    sort_order: z.number(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

export async function PUT(request: Request) {
  const profile = await getSessionProfileFromCookies();
  if (!assertRole(profile, "staff")) {
    return jsonError("Unauthorized.", 401);
  }
  if (!isSupabaseConfigured()) {
    return jsonOk({ ok: true, skipped: true });
  }

  const json = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid category payload.");
  }

  const result = await upsertCategoryInSupabase(
    parsed.data.category as Category
  );
  if ("error" in result) return jsonError(result.error, 502);
  return jsonOk({ ok: true });
}

import { z } from "zod";
import { randomUUID } from "crypto";
import {
  assertRole,
  getSessionProfileFromCookies,
} from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { upsertCategoryInSupabase, deleteCategoryInSupabase } from "@/lib/supabase/catalog";
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
    sinkers: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          product_id: z.string().uuid().nullable().optional(),
          category_id: z.string().uuid().nullable().optional(),
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          price: z.number().min(0),
          is_available: z.boolean(),
          is_global: z.boolean().optional(),
          sort_order: z.number().optional(),
        })
      )
      .optional(),
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
    const issue = parsed.error.issues[0];
    return jsonError(
      issue?.message
        ? `Invalid category: ${issue.message}`
        : "Invalid category payload."
    );
  }

  const result = await upsertCategoryInSupabase({
    ...(parsed.data.category as Category),
    sinkers: parsed.data.category.sinkers?.map((a, index) => ({
      id: a.id ?? randomUUID(),
      product_id: null,
      category_id: parsed.data.category.id,
      name: a.name,
      description: a.description ?? null,
      price: a.price,
      is_available: a.is_available,
      is_global: false,
      sort_order: a.sort_order ?? index,
    })),
  });
  if ("error" in result) return jsonError(result.error, 502);
  return jsonOk({ ok: true });
}

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(request: Request) {
  const profile = await getSessionProfileFromCookies();
  if (!assertRole(profile, "staff")) {
    return jsonError("Unauthorized.", 401);
  }
  if (!isSupabaseConfigured()) {
    return jsonOk({ ok: true, skipped: true });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid category id.");

  const result = await deleteCategoryInSupabase(parsed.data.id);
  if (result.error) return jsonError(result.error, 502);
  return jsonOk({ ok: true });
}

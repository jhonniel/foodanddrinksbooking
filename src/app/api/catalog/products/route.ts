import { z } from "zod";
import { randomUUID } from "crypto";
import {
  assertRole,
  getSessionProfileFromCookies,
} from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  deleteProductInSupabase,
  upsertProductInSupabase,
} from "@/lib/supabase/catalog";
import type { Product } from "@/types";

const productSchema = z.object({
  product: z.object({
    id: z.string().uuid(),
    category_id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().nullish().transform((v) => v ?? null),
    base_price: z.coerce.number(),
    image_url: z.string().nullish().transform((v) => v ?? null),
    sku: z.string().nullish().transform((v) => v ?? null),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    is_best_seller: z.boolean(),
    is_new: z.boolean(),
    preparation_time_minutes: z.number(),
    rating: z.number(),
    review_count: z.number(),
    sort_order: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    allows_mix_match: z.boolean().optional().default(false),
    mix_max_flavors: z.coerce.number().int().min(2).max(4).optional().default(2),
    mix_candidate_ids: z.array(z.string().uuid()).optional().default([]),
    recipes: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          product_id: z.string().uuid(),
          inventory_item_id: z.string().uuid(),
          quantity_required: z.number().positive(),
        })
      )
      .optional(),
    addons: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          product_id: z.string().uuid().nullable().optional(),
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

const deleteSchema = z.object({
  id: z.string().uuid(),
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
  const parsed = productSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "";
    return jsonError(
      issue?.message
        ? `Invalid product${path ? ` (${path})` : ""}: ${issue.message}`
        : "Invalid product payload."
    );
  }

  const result = await upsertProductInSupabase({
    ...(parsed.data.product as Product),
    recipes: parsed.data.product.recipes?.map((r) => ({
      id: r.id ?? randomUUID(),
      product_id: r.product_id,
      inventory_item_id: r.inventory_item_id,
      quantity_required: r.quantity_required,
    })),
    addons: parsed.data.product.addons?.map((a, index) => ({
      id: a.id ?? randomUUID(),
      product_id: parsed.data.product.id,
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
  if (!parsed.success) return jsonError("Invalid product id.");

  const result = await deleteProductInSupabase(parsed.data.id);
  if ("error" in result) return jsonError(result.error, 502);
  return jsonOk({ ok: true });
}

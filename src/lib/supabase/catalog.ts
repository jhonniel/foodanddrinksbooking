import "server-only";

import { randomUUID } from "crypto";
import type { Category, Product, ProductAddon, ProductRecipe } from "@/types";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import {
  groupAddonsByCategory,
  groupAddonsByProduct,
  groupCategoryMixCandidates,
  groupMixCandidates,
  groupRecipes,
  mapCategory,
  mapInventory,
  mapProduct,
  type DbAddon,
  type DbCategory,
  type DbCategoryMixCandidate,
  type DbInventory,
  type DbMixCandidate,
  type DbProduct,
  type DbRecipe,
} from "@/lib/supabase/catalogMap";

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

function addonCategoryIdMigrationError(message: string): string | null {
  if (
    message.includes("category_id") &&
    (message.includes("column") || message.includes("schema cache"))
  ) {
    return "Database missing category_id on product_addons. Run supabase/catch-up-007-011.sql section 017 in the Supabase SQL Editor.";
  }
  return null;
}

function mixMatchMigrationError(message: string): string | null {
  if (
    (message.includes("allows_mix_match") ||
      message.includes("mix_max_flavors") ||
      message.includes("product_mix_candidates") ||
      message.includes("category_mix_candidates")) &&
    (message.includes("column") ||
      message.includes("relation") ||
      message.includes("schema cache"))
  ) {
    return "Database missing mix & match tables. Run supabase/catch-up-007-011.sql sections 019–020 in the Supabase SQL Editor.";
  }
  return null;
}

/** Replace product recipes without wiping rows when the insert would fail. */
async function syncProductRecipesInSupabase(
  client: NonNullable<Awaited<ReturnType<typeof createServerClient>>>,
  productId: string,
  recipes: ProductRecipe[] | undefined
): Promise<{ error?: string }> {
  if (recipes === undefined) return {};

  const valid = recipes.filter((r) => isUuid(r.inventory_item_id));
  if (valid.length !== recipes.length) {
    return {
      error:
        "One or more ingredients are not linked to Supabase inventory. Re-select ingredients from the inventory list.",
    };
  }

  const rows = valid.map((recipe) => ({
    id: isUuid(recipe.id) ? recipe.id : randomUUID(),
    product_id: productId,
    inventory_item_id: recipe.inventory_item_id,
    quantity_required: recipe.quantity_required,
  }));
  const keepIds = new Set(rows.map((r) => r.id));

  const { data: existing, error: listError } = await client
    .from("product_recipes")
    .select("id, inventory_item_id")
    .eq("product_id", productId);

  if (listError) return { error: listError.message };

  const toDelete = (existing ?? []).filter(
    (row) => !keepIds.has(String(row.id))
  );

  if (toDelete.length > 0) {
    const { error } = await client
      .from("product_recipes")
      .delete()
      .in(
        "id",
        toDelete.map((r) => String(r.id))
      );
    if (error) return { error: error.message };
  }

  for (const row of rows) {
    const { error } = await client.from("product_recipes").upsert(row, {
      onConflict: "id",
    });

    if (error) {
      return { error: error.message };
    }
  }

  return {};
}

/** Replace per-product sinkers (product_addons where is_global = false). */
async function syncProductAddonsInSupabase(
  client: NonNullable<Awaited<ReturnType<typeof createServerClient>>>,
  productId: string,
  addons: ProductAddon[] | undefined
): Promise<{ error?: string }> {
  if (addons === undefined) return {};

  const sinkers = (addons ?? []).filter((a) => !a.is_global);
  const keepIds = new Set(
    sinkers.map((a) => a.id).filter((id) => isUuid(id))
  );

  let omitCategoryId = false;
  let existingRows: { id: string }[] | null = null;

  const listWithCategory = await client
    .from("product_addons")
    .select("id")
    .eq("product_id", productId)
    .is("category_id", null)
    .eq("is_global", false);

  if (listWithCategory.error) {
    const migration = addonCategoryIdMigrationError(listWithCategory.error.message);
    if (!migration) return { error: listWithCategory.error.message };

    omitCategoryId = true;
    const fallback = await client
      .from("product_addons")
      .select("id")
      .eq("product_id", productId)
      .eq("is_global", false);
    if (fallback.error) return { error: migration };
    existingRows = (fallback.data ?? []) as { id: string }[];
  } else {
    existingRows = (listWithCategory.data ?? []) as { id: string }[];
  }

  const toDelete = existingRows.filter((row) => !keepIds.has(String(row.id)));

  if (toDelete.length > 0) {
    const { error } = await client
      .from("product_addons")
      .delete()
      .in(
        "id",
        toDelete.map((r) => String(r.id))
      );
    if (error) return { error: error.message };
  }

  for (let i = 0; i < sinkers.length; i++) {
    const addon = sinkers[i];
    const row = {
      id: isUuid(addon.id) ? addon.id : randomUUID(),
      product_id: productId,
      ...(omitCategoryId ? {} : { category_id: null }),
      name: addon.name.trim(),
      description: addon.description?.trim() || null,
      price: addon.price,
      is_available: addon.is_available,
      is_global: false,
      sort_order: addon.sort_order ?? i,
    };

    const { error } = await client.from("product_addons").upsert(row, {
      onConflict: "id",
    });

    if (error) {
      return {
        error: addonCategoryIdMigrationError(error.message) ?? error.message,
      };
    }
  }

  return {};
}

/** Replace mix-and-match flavor candidates for a product. */
async function syncProductMixCandidatesInSupabase(
  client: NonNullable<Awaited<ReturnType<typeof createServerClient>>>,
  productId: string,
  candidateIds: string[] | undefined
): Promise<{ error?: string }> {
  if (candidateIds === undefined) return {};

  const valid = (candidateIds ?? []).filter(
    (id) => isUuid(id) && id !== productId
  );
  const keepIds = new Set(valid);

  const { data: existing, error: listError } = await client
    .from("product_mix_candidates")
    .select("id, candidate_product_id")
    .eq("product_id", productId);

  if (listError) {
    return { error: mixMatchMigrationError(listError.message) ?? listError.message };
  }

  const toDelete = (existing ?? []).filter(
    (row) => !keepIds.has(String(row.candidate_product_id))
  );

  if (toDelete.length > 0) {
    const { error } = await client
      .from("product_mix_candidates")
      .delete()
      .in(
        "id",
        toDelete.map((r) => String(r.id))
      );
    if (error) {
      return { error: mixMatchMigrationError(error.message) ?? error.message };
    }
  }

  for (let i = 0; i < valid.length; i++) {
    const candidateId = valid[i];
    const { error } = await client.from("product_mix_candidates").upsert(
      {
        product_id: productId,
        candidate_product_id: candidateId,
        sort_order: i,
      },
      { onConflict: "product_id,candidate_product_id" }
    );
    if (error) {
      return { error: mixMatchMigrationError(error.message) ?? error.message };
    }
  }

  return {};
}

/** Replace category-level mix flavor candidates. */
async function syncCategoryMixCandidatesInSupabase(
  client: NonNullable<Awaited<ReturnType<typeof createServerClient>>>,
  categoryId: string,
  candidateIds: string[] | undefined
): Promise<{ error?: string }> {
  if (candidateIds === undefined) return {};

  const valid = (candidateIds ?? []).filter((id) => isUuid(id));
  const keepIds = new Set(valid);

  const { data: existing, error: listError } = await client
    .from("category_mix_candidates")
    .select("id, candidate_product_id")
    .eq("category_id", categoryId);

  if (listError) {
    return { error: mixMatchMigrationError(listError.message) ?? listError.message };
  }

  const toDelete = (existing ?? []).filter(
    (row) => !keepIds.has(String(row.candidate_product_id))
  );

  if (toDelete.length > 0) {
    const { error } = await client
      .from("category_mix_candidates")
      .delete()
      .in(
        "id",
        toDelete.map((r) => String(r.id))
      );
    if (error) {
      return { error: mixMatchMigrationError(error.message) ?? error.message };
    }
  }

  for (let i = 0; i < valid.length; i++) {
    const candidateId = valid[i];
    const { error } = await client.from("category_mix_candidates").upsert(
      {
        category_id: categoryId,
        candidate_product_id: candidateId,
        sort_order: i,
      },
      { onConflict: "category_id,candidate_product_id" }
    );
    if (error) {
      return { error: mixMatchMigrationError(error.message) ?? error.message };
    }
  }

  return {};
}

/** Replace category default sinkers (product_addons linked to category_id). */
async function syncCategoryAddonsInSupabase(
  client: NonNullable<Awaited<ReturnType<typeof createServerClient>>>,
  categoryId: string,
  sinkers: ProductAddon[] | undefined
): Promise<{ error?: string }> {
  if (sinkers === undefined) return {};

  const rows = (sinkers ?? []).filter((a) => !a.is_global);
  const keepIds = new Set(rows.map((a) => a.id).filter((id) => isUuid(id)));

  const { data: existing, error: listError } = await client
    .from("product_addons")
    .select("id")
    .eq("category_id", categoryId)
    .is("product_id", null)
    .eq("is_global", false);

  if (listError) return { error: listError.message };

  const toDelete = (existing ?? []).filter(
    (row) => !keepIds.has(String(row.id))
  );

  if (toDelete.length > 0) {
    const { error } = await client
      .from("product_addons")
      .delete()
      .in(
        "id",
        toDelete.map((r) => String(r.id))
      );
    if (error) return { error: error.message };
  }

  for (let i = 0; i < rows.length; i++) {
    const addon = rows[i];
    const row = {
      id: isUuid(addon.id) ? addon.id : randomUUID(),
      product_id: null,
      category_id: categoryId,
      name: addon.name.trim(),
      description: addon.description?.trim() || null,
      price: addon.price,
      is_available: addon.is_available,
      is_global: false,
      sort_order: addon.sort_order ?? i,
    };

    const { error } = await client.from("product_addons").upsert(row, {
      onConflict: "id",
    });

    if (error) {
      return {
        error: addonCategoryIdMigrationError(error.message) ?? error.message,
      };
    }
  }

  return {};
}

export async function fetchCatalogFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const client = await createServerClient();
  if (!client) return null;

  const [catsRes, prodsRes, invRes, recipesRes, addonsRes, mixRes, categoryMixRes] =
    await Promise.all([
    client.from("categories").select("*").order("sort_order"),
    client.from("products").select("*").order("sort_order"),
    client.from("inventory_items").select("*").order("name"),
    client.from("product_recipes").select("*"),
    client.from("product_addons").select("*").order("sort_order"),
    client.from("product_mix_candidates").select("*").order("sort_order"),
    client.from("category_mix_candidates").select("*").order("sort_order"),
  ]);

  if (catsRes.error || prodsRes.error) {
    console.error(
      "[catalog] fetch failed",
      catsRes.error?.message,
      prodsRes.error?.message
    );
    return null;
  }

  const recipesByProduct = groupRecipes(
    (recipesRes.data ?? []) as DbRecipe[]
  );
  const addonsByProduct = groupAddonsByProduct(
    (addonsRes.data ?? []) as DbAddon[]
  );
  const addonsByCategory = groupAddonsByCategory(
    (addonsRes.data ?? []) as DbAddon[]
  );
  const mixByProduct = mixRes.error
    ? new Map<string, string[]>()
    : groupMixCandidates((mixRes.data ?? []) as DbMixCandidate[]);
  if (mixRes.error) {
    console.warn("[catalog] mix candidates fetch skipped:", mixRes.error.message);
  }
  const mixByCategory = categoryMixRes.error
    ? new Map<string, string[]>()
    : groupCategoryMixCandidates(
        (categoryMixRes.data ?? []) as DbCategoryMixCandidate[]
      );
  if (categoryMixRes.error) {
    console.warn(
      "[catalog] category mix candidates fetch skipped:",
      categoryMixRes.error.message
    );
  }
  const categories = ((catsRes.data ?? []) as DbCategory[]).map((c) =>
    mapCategory(
      c,
      addonsByCategory.get(c.id) ?? [],
      mixByCategory.get(c.id) ?? []
    )
  );
  const products = ((prodsRes.data ?? []) as DbProduct[]).map((p) =>
    mapProduct(
      p,
      recipesByProduct.get(p.id) ?? [],
      addonsByProduct.get(p.id) ?? [],
      mixByProduct.get(p.id) ?? []
    )
  );
  const inventory = ((invRes.data ?? []) as DbInventory[]).map(mapInventory);

  return { categories, products, inventory };
}

export async function upsertCategoryInSupabase(
  category: Category
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client.from("categories").upsert({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image_url: category.image_url,
    sort_order: category.sort_order,
    is_active: category.is_active,
    allows_mix_match: category.allows_mix_match ?? false,
    mix_max_flavors: category.mix_max_flavors ?? 2,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { error: mixMatchMigrationError(error.message) ?? error.message };
  }

  const addonResult = await syncCategoryAddonsInSupabase(
    client,
    category.id,
    category.sinkers
  );
  if (addonResult.error) return { error: addonResult.error };

  const mixResult = await syncCategoryMixCandidatesInSupabase(
    client,
    category.id,
    category.allows_mix_match ? category.mix_candidate_ids : []
  );
  if (mixResult.error) return { error: mixResult.error };

  return { ok: true };
}

export async function updateCategoryImageInSupabase(
  categoryId: string,
  imageUrl: string
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client
    .from("categories")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteCategoryInSupabase(
  categoryId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client.from("categories").delete().eq("id", categoryId);
  if (error) return { error: error.message };
  return {};
}

export async function upsertProductInSupabase(
  product: Product
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client.from("products").upsert({
    id: product.id,
    category_id: product.category_id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    base_price: product.base_price,
    image_url: product.image_url,
    sku: product.sku,
    is_available: product.is_available,
    is_featured: product.is_featured,
    is_best_seller: product.is_best_seller,
    is_new: product.is_new,
    preparation_time_minutes: product.preparation_time_minutes,
    rating: product.rating,
    review_count: product.review_count,
    sort_order: product.sort_order,
    allows_mix_match: product.allows_mix_match ?? false,
    mix_max_flavors: product.mix_max_flavors ?? 2,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { error: mixMatchMigrationError(error.message) ?? error.message };
  }

  const recipeResult = await syncProductRecipesInSupabase(
    client,
    product.id,
    product.recipes
  );
  if (recipeResult.error) return { error: recipeResult.error };

  const addonResult = await syncProductAddonsInSupabase(
    client,
    product.id,
    product.addons
  );
  if (addonResult.error) return { error: addonResult.error };

  const mixResult = await syncProductMixCandidatesInSupabase(
    client,
    product.id,
    product.allows_mix_match ? product.mix_candidate_ids : []
  );
  if (mixResult.error) return { error: mixResult.error };

  return { ok: true };
}

export async function deleteProductInSupabase(
  productId: string
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client.from("products").delete().eq("id", productId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function saveInventoryItemInSupabase(input: {
  id?: string;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumStock: number;
  costPerUnit?: number;
  supplier?: string | null;
  sku?: string | null;
}): Promise<{ item?: ReturnType<typeof mapInventory>; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const now = new Date().toISOString();
  const row = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    unit: input.unit,
    current_quantity: input.currentQuantity,
    minimum_stock: input.minimumStock,
    cost_per_unit: input.costPerUnit ?? 0,
    supplier: input.supplier?.trim() || null,
    last_restocked_at: now,
    updated_at: now,
  };

  const query = input.id
    ? client.from("inventory_items").upsert(row).select("*").single()
    : client.from("inventory_items").insert(row).select("*").single();

  const { data, error } = await query;
  if (error || !data) {
    return { error: error?.message || "Could not save inventory item." };
  }

  return { item: mapInventory(data as DbInventory) };
}

export async function deleteInventoryItemInSupabase(
  inventoryItemId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  await client
    .from("product_recipes")
    .delete()
    .eq("inventory_item_id", inventoryItemId);
  await client
    .from("inventory_transactions")
    .delete()
    .eq("inventory_item_id", inventoryItemId);

  const { error } = await client
    .from("inventory_items")
    .delete()
    .eq("id", inventoryItemId);

  if (error) return { error: error.message };
  return {};
}

export async function updateProductImageInSupabase(
  productId: string,
  imageUrl: string
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client
    .from("products")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) return { error: error.message };
  return { ok: true };
}

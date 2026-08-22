import "server-only";

import { randomUUID } from "crypto";
import type { Category, Product, ProductRecipe } from "@/types";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import {
  groupRecipes,
  mapCategory,
  mapInventory,
  mapProduct,
  type DbCategory,
  type DbInventory,
  type DbProduct,
  type DbRecipe,
} from "@/lib/supabase/catalogMap";

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
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

  const keepInventoryIds = new Set(valid.map((r) => r.inventory_item_id));

  const { data: existing, error: listError } = await client
    .from("product_recipes")
    .select("id, inventory_item_id")
    .eq("product_id", productId);

  if (listError) return { error: listError.message };

  const toDelete = (existing ?? []).filter(
    (row) => !keepInventoryIds.has(String(row.inventory_item_id))
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

  for (const recipe of valid) {
    const row = {
      id: isUuid(recipe.id) ? recipe.id : randomUUID(),
      product_id: productId,
      inventory_item_id: recipe.inventory_item_id,
      quantity_required: recipe.quantity_required,
    };

    const { error } = await client.from("product_recipes").upsert(row, {
      onConflict: "id",
    });

    if (error) {
      return { error: error.message };
    }
  }

  return {};
}

export async function fetchCatalogFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const client = await createServerClient();
  if (!client) return null;

  const [catsRes, prodsRes, invRes, recipesRes] = await Promise.all([
    client.from("categories").select("*").order("sort_order"),
    client.from("products").select("*").order("sort_order"),
    client.from("inventory_items").select("*").order("name"),
    client.from("product_recipes").select("*"),
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
  const categories = ((catsRes.data ?? []) as DbCategory[]).map(mapCategory);
  const products = ((prodsRes.data ?? []) as DbProduct[]).map((p) =>
    mapProduct(p, recipesByProduct.get(p.id) ?? [])
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
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
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
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  const recipeResult = await syncProductRecipesInSupabase(
    client,
    product.id,
    product.recipes
  );
  if (recipeResult.error) return { error: recipeResult.error };

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

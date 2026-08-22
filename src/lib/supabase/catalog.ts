import "server-only";

import type { Category, Product } from "@/types";
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

  if (product.recipes) {
    await client.from("product_recipes").delete().eq("product_id", product.id);
    if (product.recipes.length > 0) {
      const { error: recipeError } = await client
        .from("product_recipes")
        .insert(
          product.recipes.map((r) => ({
            id: r.id,
            product_id: product.id,
            inventory_item_id: r.inventory_item_id,
            quantity_required: r.quantity_required,
          }))
        );
      if (recipeError) return { error: recipeError.message };
    }
  }

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

import "server-only";

import type { Product } from "@/types";
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

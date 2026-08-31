import type {
  Category,
  InventoryItem,
  Product,
  ProductAddon,
  ProductRecipe,
} from "@/types";

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbProduct = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number | string;
  image_url: string | null;
  sku: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new: boolean;
  preparation_time_minutes: number | null;
  rating: number | string | null;
  review_count: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type DbInventory = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  current_quantity: number | string;
  minimum_stock: number | string;
  cost_per_unit: number | string;
  supplier: string | null;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbRecipe = {
  id: string;
  product_id: string;
  inventory_item_id: string;
  quantity_required: number | string;
};

type DbAddon = {
  id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  price: number | string;
  is_available: boolean;
  is_global: boolean;
  sort_order: number;
};

export function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image_url: row.image_url,
    sort_order: row.sort_order,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapProduct(
  row: DbProduct,
  recipes: ProductRecipe[] = [],
  addons: ProductAddon[] = []
): Product {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    base_price: Number(row.base_price),
    image_url: row.image_url,
    sku: row.sku,
    is_available: row.is_available,
    is_featured: row.is_featured,
    is_best_seller: row.is_best_seller,
    is_new: row.is_new,
    preparation_time_minutes: row.preparation_time_minutes ?? 10,
    rating: Number(row.rating ?? 4.5),
    review_count: row.review_count ?? 0,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    recipes,
    addons,
  };
}

export function mapInventory(row: DbInventory): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    current_quantity: Number(row.current_quantity),
    minimum_stock: Number(row.minimum_stock),
    cost_per_unit: Number(row.cost_per_unit),
    supplier: row.supplier,
    last_restocked_at: row.last_restocked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function groupRecipes(
  rows: DbRecipe[]
): Map<string, ProductRecipe[]> {
  const recipesByProduct = new Map<string, ProductRecipe[]>();
  for (const row of rows) {
    const list = recipesByProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      product_id: row.product_id,
      inventory_item_id: row.inventory_item_id,
      quantity_required: Number(row.quantity_required),
    });
    recipesByProduct.set(row.product_id, list);
  }
  return recipesByProduct;
}

export function mapAddon(row: DbAddon): ProductAddon {
  return {
    id: row.id,
    product_id: row.product_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    is_available: row.is_available,
    is_global: row.is_global,
    sort_order: row.sort_order,
  };
}

/** Per-product sinkers only (excludes global addon pool). */
export function groupAddonsByProduct(
  rows: DbAddon[]
): Map<string, ProductAddon[]> {
  const byProduct = new Map<string, ProductAddon[]>();
  for (const row of rows) {
    if (!row.product_id || row.is_global) continue;
    const list = byProduct.get(row.product_id) ?? [];
    list.push(mapAddon(row));
    byProduct.set(row.product_id, list);
  }
  for (const [productId, list] of byProduct) {
    list.sort((a, b) => a.sort_order - b.sort_order);
    byProduct.set(productId, list);
  }
  return byProduct;
}

export type { DbCategory, DbProduct, DbInventory, DbRecipe, DbAddon };

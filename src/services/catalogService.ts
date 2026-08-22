import type { Category, InventoryItem, Product } from "@/types";

export type CatalogPayload = {
  configured: boolean;
  categories: Category[];
  products: Product[];
  inventory: InventoryItem[];
};

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

export async function loadCatalog(): Promise<CatalogPayload> {
  const res = await fetch("/api/catalog", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    return { configured: false, categories: [], products: [], inventory: [] };
  }
  return (await res.json()) as CatalogPayload;
}

export async function syncCategory(category: Category): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isUuid(category.id)) {
    return { ok: true };
  }

  const res = await fetch("/api/catalog/categories", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: {
        ...category,
        description: category.description ?? null,
        image_url: category.image_url ?? null,
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
  };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Could not sync category." };
  }
  return { ok: true };
}

export async function syncProduct(product: Product): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isUuid(product.id) || !isUuid(product.category_id)) {
    return { ok: true };
  }

  const recipes = (product.recipes ?? []).filter(
    (r) => isUuid(r.id) && isUuid(r.inventory_item_id)
  );

  const res = await fetch("/api/catalog/products", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product: {
        ...product,
        description: product.description ?? null,
        image_url: product.image_url ?? null,
        sku: product.sku ?? null,
        recipes,
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
  };
  if (!res.ok) return { ok: false, error: json.error ?? "Could not sync product." };
  return { ok: true };
}

export async function removeProductRemote(productId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await fetch("/api/catalog/products", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: productId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: json.error ?? "Could not delete." };
  return { ok: true };
}

export async function saveInventoryRemote(input: {
  id?: string;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumStock: number;
  costPerUnit?: number;
  supplier?: string | null;
  sku?: string | null;
}): Promise<{ item?: InventoryItem; error?: string; skipped?: boolean }> {
  const res = await fetch("/api/catalog/inventory", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    item?: InventoryItem;
    skipped?: boolean;
  };
  if (!res.ok) {
    return { error: json.error ?? "Could not save inventory item." };
  }
  return { item: json.item, skipped: json.skipped };
}

export async function removeInventoryRemote(
  inventoryItemId: string
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isUuid(inventoryItemId)) {
    return {
      ok: false,
      skipped: true,
      error: "This item is not saved in Supabase yet.",
    };
  }

  const res = await fetch("/api/catalog/inventory", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inventoryItemId }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    skipped?: boolean;
  };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Could not delete inventory item." };
  }
  return { ok: true, skipped: json.skipped };
}

export async function removeCategoryRemote(categoryId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isUuid(categoryId)) {
    return { ok: true };
  }

  const res = await fetch("/api/catalog/categories", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: categoryId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Could not delete category." };
  }
  return { ok: true };
}

export async function uploadProductImage(
  file: File,
  folder: string
): Promise<{ publicUrl: string; path: string } | { error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", "islandcoolersimg");
  form.append("folder", folder);
  form.append("productId", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    publicUrl?: string;
    path?: string;
  };
  if (!res.ok || !json.publicUrl || !json.path) {
    return { error: json.error ?? "Upload failed." };
  }
  return { publicUrl: json.publicUrl, path: json.path };
}

export async function uploadCategoryImage(
  file: File,
  categoryId: string
): Promise<{ publicUrl: string; path: string } | { error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", "islandcoolersimg");
  form.append("folder", categoryId);
  form.append("categoryId", categoryId);

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    publicUrl?: string;
    path?: string;
  };
  if (!res.ok || !json.publicUrl || !json.path) {
    return { error: json.error ?? "Upload failed." };
  }
  return { publicUrl: json.publicUrl, path: json.path };
}

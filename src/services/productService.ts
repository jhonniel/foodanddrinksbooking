import { useDataStore } from "@/stores/data";
import { isProductOrderable } from "@/lib/inventory/availability";
import type { Category, Product, ProductAddon, Promotion } from "@/types";
import { isHomePromotionVisible } from "@/lib/vouchers/promotionValidity";

function getState() {
  return useDataStore.getState();
}

export function selectCategories(): Category[] {
  return getState()
    .categories.filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function productSinkers(product: Product): ProductAddon[] {
  return (product.addons ?? []).filter(
    (a) => !a.is_global && a.is_available
  );
}

export function selectProducts(filters?: {
  categoryId?: string;
  categorySlug?: string;
  search?: string;
  featured?: boolean;
  bestSeller?: boolean;
  availableOnly?: boolean;
  sort?: "price_asc" | "price_desc" | "rating" | "popular" | "newest";
}): Product[] {
  const { products, categories, inventory } = getState();
  let list = [...products];

  if (filters?.availableOnly !== false) {
    list = list.filter((p) => isProductOrderable(p, inventory));
  }
  if (filters?.categoryId) {
    list = list.filter((p) => p.category_id === filters.categoryId);
  }
  if (filters?.categorySlug) {
    const cat = categories.find((c) => c.slug === filters.categorySlug);
    if (cat) list = list.filter((p) => p.category_id === cat.id);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }
  if (filters?.featured) list = list.filter((p) => p.is_featured);
  if (filters?.bestSeller) list = list.filter((p) => p.is_best_seller);

  switch (filters?.sort) {
    case "price_asc":
      list.sort((a, b) => a.base_price - b.base_price);
      break;
    case "price_desc":
      list.sort((a, b) => b.base_price - a.base_price);
      break;
    case "rating":
      list.sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
      list = list.filter((p) => p.is_new).concat(list.filter((p) => !p.is_new));
      break;
    case "popular":
    default:
      list.sort((a, b) => b.review_count - a.review_count);
  }

  return list.map((p) => ({
    ...p,
    category: categories.find((c) => c.id === p.category_id),
    addons: productSinkers(p),
    options: p.options,
  }));
}

export async function getCategories(): Promise<Category[]> {
  return selectCategories();
}

export async function getAllCategories(): Promise<Category[]> {
  return [...getState().categories].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getProducts(filters?: {
  categoryId?: string;
  categorySlug?: string;
  search?: string;
  featured?: boolean;
  bestSeller?: boolean;
  availableOnly?: boolean;
  sort?: "price_asc" | "price_desc" | "rating" | "popular" | "newest";
}): Promise<Product[]> {
  return selectProducts(filters);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products, categories } = getState();
  const product = products.find((p) => p.slug === slug);
  if (!product) return null;
  return {
    ...product,
    category: categories.find((c) => c.id === product.category_id),
    addons: productSinkers(product),
  };
}

export async function getProductById(id: string): Promise<Product | null> {
  const { products, categories } = getState();
  const product = products.find((p) => p.id === id);
  if (!product) return null;
  return {
    ...product,
    category: categories.find((c) => c.id === product.category_id),
    addons: productSinkers(product),
  };
}

export async function getAddons(): Promise<ProductAddon[]> {
  return getState().addons.filter((a) => a.is_available);
}

export async function getPromotions(): Promise<Promotion[]> {
  return getState().promotions.filter((p) => isHomePromotionVisible(p));
}

export async function validatePromoCode(
  code: string,
  subtotal: number
): Promise<{
  valid: boolean;
  discount: number;
  promotion?: Promotion;
  error?: string;
}> {
  try {
    const res = await fetch("/api/promotions/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.discount != null) {
      return {
        valid: true,
        discount: Number(data.discount),
        promotion: data.promotion as Promotion | undefined,
      };
    }
    return {
      valid: false,
      discount: 0,
      error: String(data?.error ?? "Invalid voucher code."),
    };
  } catch {
    return {
      valid: false,
      discount: 0,
      error: "Could not validate voucher. Try again.",
    };
  }
}

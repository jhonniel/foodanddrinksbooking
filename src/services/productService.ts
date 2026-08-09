import { useDataStore } from "@/stores/data";
import type { Category, Product, ProductAddon, Promotion } from "@/types";

function getState() {
  return useDataStore.getState();
}

export async function getCategories(): Promise<Category[]> {
  return getState()
    .categories.filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
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
  const { products, categories, addons } = getState();
  let list = [...products];

  if (filters?.availableOnly !== false) {
    list = list.filter((p) => p.is_available);
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
    addons: p.addons?.length ? p.addons : addons,
    options: p.options,
  }));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products, categories, addons } = getState();
  const product = products.find((p) => p.slug === slug);
  if (!product) return null;
  return {
    ...product,
    category: categories.find((c) => c.id === product.category_id),
    addons: product.addons?.length ? product.addons : addons,
  };
}

export async function getProductById(id: string): Promise<Product | null> {
  const { products, categories, addons } = getState();
  const product = products.find((p) => p.id === id);
  if (!product) return null;
  return {
    ...product,
    category: categories.find((c) => c.id === product.category_id),
    addons: product.addons?.length ? product.addons : addons,
  };
}

export async function getAddons(): Promise<ProductAddon[]> {
  return getState().addons.filter((a) => a.is_available);
}

export async function getPromotions(): Promise<Promotion[]> {
  return getState().promotions.filter((p) => p.is_active);
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
  const promo = getState().promotions.find(
    (p) => p.promo_code?.toUpperCase() === code.toUpperCase() && p.is_active
  );
  if (!promo) return { valid: false, discount: 0, error: "Invalid promo code." };
  if (subtotal < promo.min_order_amount) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order of ₱${promo.min_order_amount} required.`,
    };
  }
  let discount = 0;
  if (promo.type === "PERCENTAGE") {
    discount = (subtotal * promo.discount_value) / 100;
    if (promo.max_discount) discount = Math.min(discount, promo.max_discount);
  } else if (promo.type === "FIXED") {
    discount = promo.discount_value;
  }
  return { valid: true, discount, promotion: promo };
}

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/shared/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectCategories, selectProducts, validatePromoCode } from "@/services/productService";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import { buildDefaultCartItem } from "@/lib/cartHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Category, Product } from "@/types";
import { UtensilsCrossed } from "lucide-react";
import { DeliveryLocationGate } from "@/components/customer/DeliveryLocationGate";

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);
  const promoCode = useCartStore((s) => s.promoCode);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const cartSubtotal = useCartStore((s) => s.subtotal());
  const setPromo = useCartStore((s) => s.setPromo);
  const storeProducts = useDataStore((s) => s.products);
  const storeCategories = useDataStore((s) => s.categories);
  const inventory = useDataStore((s) => s.inventory);
  const catalogHydrated = useDataStore((s) => s.hydrated);

  const categoryParam = searchParams.get("category") ?? "";
  const sortParam = (searchParams.get("sort") as
    | "price_asc"
    | "price_desc"
    | "rating"
    | "popular"
    | "newest"
    | null) ?? "popular";

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const categories = useMemo(
    () => selectCategories(),
    [storeCategories]
  );

  const products = useMemo(
    () =>
      selectProducts({
        categorySlug: categoryParam || undefined,
        search: search || undefined,
        sort: sortParam,
      }),
    [categoryParam, search, sortParam, storeProducts, storeCategories, inventory]
  );

  const loading = !catalogHydrated;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      router.replace(`/menu?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!promoCode || cartSubtotal <= 0 || promoDiscount > 0) return;

    let cancelled = false;
    void validatePromoCode(promoCode, cartSubtotal).then((result) => {
      if (cancelled) return;
      if (result.valid) {
        setPromo(promoCode, result.discount);
        toast.success(`${promoCode} applied to your order!`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [promoCode, cartSubtotal, promoDiscount, setPromo]);

  const handleAdd = (product: Product) => {
    if (product.options?.length) {
      router.push(`/menu/${product.slug}`);
      return;
    }
    if (!addItem(buildDefaultCartItem(product), product)) return;
    toast.success(`${product.name} added to cart`);
  };

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categoryParam),
    [categories, categoryParam]
  );

  const productsByCategory = useMemo(() => {
    if (categoryParam) return null;

    const sortedCategories = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const groups: { category: Category; products: Product[] }[] = [];

    for (const category of sortedCategories) {
      const categoryProducts = products.filter(
        (product) => product.category_id === category.id
      );
      if (categoryProducts.length > 0) {
        groups.push({ category, products: categoryProducts });
      }
    }

    const groupedIds = new Set(
      groups.flatMap((group) => group.products.map((product) => product.id))
    );
    const uncategorized = products.filter(
      (product) => !groupedIds.has(product.id)
    );
    if (uncategorized.length > 0) {
      groups.push({
        category: {
          id: "uncategorized",
          name: "Other",
          slug: "other",
          description: null,
          image_url: null,
          sort_order: 999,
          is_active: true,
          created_at: "",
          updated_at: "",
        },
        products: uncategorized,
      });
    }

    return groups;
  }, [categoryParam, categories, products]);

  const productGrid = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={handleAdd} />
      ))}
    </div>
  );

  return (
    <div className="space-y-5 pb-4">
      <DeliveryLocationGate />
      <div>
        <h1 className="text-2xl font-bold text-navy">Menu</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search drinks..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            updateParams({ q: e.target.value || null });
          }}
          className="h-11 rounded-xl border-border bg-white pl-10"
        />
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 hide-scrollbar sm:-mx-4 sm:px-4">
        <button
          type="button"
          onClick={() => updateParams({ category: null })}
          className={cn(
            "min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            !categoryParam
              ? "bg-green text-white"
              : "bg-white text-navy shadow-card hover:bg-muted"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => updateParams({ category: cat.slug })}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              categoryParam === cat.slug
                ? "bg-green text-white"
                : "bg-white text-navy shadow-card hover:bg-muted"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${products.length} items`}
          {activeCategory ? ` in ${activeCategory.name}` : ""}
        </p>
        <Select
          value={sortParam}
          onValueChange={(v) => v && updateParams({ sort: v })}
        >
          <SelectTrigger className="h-9 w-auto gap-2 rounded-xl border-border bg-white text-sm">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="rating">Top Rated</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No drinks found"
          description="Try a different search or category"
          actionLabel="Clear filters"
          onAction={() => {
            setSearch("");
            router.replace("/menu");
          }}
        />
      ) : productsByCategory ? (
        <div className="space-y-8">
          {productsByCategory.map(({ category, products: categoryProducts }) => (
            <section key={category.id}>
              <h2 className="mb-3 text-lg font-bold text-navy">{category.name}</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {categoryProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleAdd}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        productGrid
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-xl bg-muted" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}

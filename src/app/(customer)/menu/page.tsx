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
import { getCategories, getProducts } from "@/services/productService";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import { buildDefaultCartItem } from "@/lib/cartHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Category, Product } from "@/types";
import { UtensilsCrossed } from "lucide-react";

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);
  const storeProducts = useDataStore((s) => s.products);
  const storeCategories = useDataStore((s) => s.categories);

  const categoryParam = searchParams.get("category") ?? "";
  const sortParam = (searchParams.get("sort") as
    | "price_asc"
    | "price_desc"
    | "rating"
    | "popular"
    | "newest"
    | null) ?? "popular";

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(true);

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
    getCategories().then(setCategories);
  }, [storeCategories]);

  useEffect(() => {
    setLoading(true);
    getProducts({
      categorySlug: categoryParam || undefined,
      search: search || undefined,
      sort: sortParam,
    }).then((items) => {
      setProducts(items);
      setLoading(false);
    });
  }, [categoryParam, search, sortParam, storeProducts]);

  const handleAdd = (product: Product) => {
    if (product.options?.length) {
      router.push(`/menu/${product.slug}`);
      return;
    }
    addItem(buildDefaultCartItem(product));
    toast.success(`${product.name} added to cart`);
  };

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categoryParam),
    [categories, categoryParam]
  );

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Menu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Soda, coffee, matcha &amp; more
        </p>
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
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={handleAdd} />
          ))}
        </div>
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

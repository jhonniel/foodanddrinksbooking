"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Gift, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";
import { CategoryCard } from "@/components/shared/CategoryCard";
import { ProductCard } from "@/components/shared/ProductCard";
import { PageTransition, Stagger, StaggerItem, Reveal } from "@/components/motion";
import { getCategories, getProducts, getPromotions } from "@/services/productService";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import { buildDefaultCartItem } from "@/lib/cartHelpers";
import { formatCurrency, greeting } from "@/lib/utils/format";
import type { Category, Product, Promotion } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const storeProducts = useDataStore((s) => s.products);
  const storeCategories = useDataStore((s) => s.categories);
  const storePromotions = useDataStore((s) => s.promotions);

  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCategories(),
      getProducts({ bestSeller: true }),
      getProducts({ featured: true }),
      getPromotions(),
    ]).then(([cats, sellers, feat, promos]) => {
      setCategories(cats.slice(0, 3));
      setBestSellers(sellers);
      setFeatured(feat);
      setPromotions(promos);
      setLoading(false);
    });
  }, [storeProducts, storeCategories, storePromotions]);

  const handleQuickAdd = (product: Product) => {
    addItem(buildDefaultCartItem(product));
    toast.success(`${product.name} added to cart`);
  };

  const handleAdd = (product: Product) => {
    if (product.options?.length) {
      router.push(`/menu/${product.slug}`);
      return;
    }
    handleQuickAdd(product);
  };

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <PageTransition className="space-y-8 pb-4">
      <section>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm text-muted-foreground">
            {user ? `${greeting()}, ${firstName}!` : "Welcome to Island Coolers"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy lg:text-3xl">
            What are you craving today?
          </h1>
          {!user && (
            <p className="mt-2 text-sm text-muted-foreground">
              <Link href="/login" className="font-semibold text-green hover:underline">
                Sign in
              </Link>{" "}
              or{" "}
              <Link
                href="/register"
                className="font-semibold text-green hover:underline"
              >
                create an account
              </Link>{" "}
              to start ordering.
            </p>
          )}
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-4 overflow-hidden rounded-2xl bg-navy p-5 text-white shadow-card"
        >
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky/20 blur-2xl"
              animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.15, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-sky">
                Fresh &amp; chilled
              </p>
              <p className="mt-1 text-xl font-bold sm:text-2xl">
                Soda, coffee &amp; matcha — delivered cold
              </p>
              <p className="mt-0.5 text-sm text-white/70">
                Browse the menu and place your order
              </p>
            </div>
            <motion.div whileHover={reduce ? undefined : { scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/menu"
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-green px-5 text-sm font-semibold text-white shadow-lg shadow-green/20 hover:bg-green/90"
              >
                ORDER NOW
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <Reveal>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Categories</h2>
          <Link href="/menu" className="flex items-center gap-1 text-sm font-medium text-green">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <Stagger className="grid grid-cols-3 gap-3" fast>
            {categories.map((cat) => (
              <StaggerItem key={cat.id}>
                <CategoryCard category={cat} compact />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Reveal>

      <Reveal>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Best Sellers</h2>
          <Link href="/menu?sort=popular" className="text-sm font-medium text-green">
            See all
          </Link>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar">
          {loading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="h-56 w-40 shrink-0 animate-pulse rounded-2xl bg-muted" />
              ))
            : bestSellers.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={reduce ? false : { opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                  className="w-40 shrink-0"
                >
                  <ProductCard product={product} onAdd={handleAdd} />
                </motion.div>
              ))}
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sky" />
          <h2 className="text-lg font-bold text-navy">Featured Drinks</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} onAdd={handleAdd} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Reveal>

      {promotions.length > 0 && (
        <Reveal>
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-5 w-5 text-green" />
            <h2 className="text-lg font-bold text-navy">Promotions</h2>
          </div>
          <Stagger className="space-y-3">
            {promotions.map((promo) => (
              <StaggerItem key={promo.id}>
                <motion.div
                  whileHover={reduce ? undefined : { x: 2 }}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-card"
                >
                  <div>
                    <p className="font-semibold text-navy">{promo.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {promo.description}
                    </p>
                    {promo.promo_code && (
                      <span className="mt-2 inline-block rounded-lg bg-light-blue px-2.5 py-1 text-xs font-bold text-sky">
                        {promo.promo_code}
                      </span>
                    )}
                  </div>
                  <Link
                    href="/menu"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-green px-4 py-2 text-sm font-medium text-green hover:bg-green/5"
                  >
                    Shop
                  </Link>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>
      )}

      <Reveal>
        <motion.div
          whileHover={reduce ? undefined : { scale: 1.01 }}
          className="rounded-2xl bg-light-blue p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-navy">Rewards Club</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Redeem points for discounts and free drinks. Check your balance
                on Profile.
              </p>
            </div>
            <motion.div
              animate={reduce ? undefined : { rotate: [0, -8, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Gift className="h-10 w-10 text-sky/60" />
            </motion.div>
          </div>
          <Link
            href="/rewards"
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-navy py-2.5 text-sm font-medium text-white hover:bg-navy/90"
          >
            View Rewards <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </motion.div>
      </Reveal>
    </PageTransition>
  );
}

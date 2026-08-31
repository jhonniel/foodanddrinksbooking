"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { isProductOrderable } from "@/lib/inventory/availability";
import { CategoryLabel } from "@/components/shared/CategoryLabel";
import {
  getRemainingPurchasable,
} from "@/lib/cart/stockLimits";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";

interface ProductCardProps {
  product: Product;
  onAdd?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  isFavorite?: boolean;
  className?: string;
  href?: string;
}

export function ProductCard({
  product,
  onAdd,
  onFavorite,
  isFavorite,
  className,
  href,
}: ProductCardProps) {
  const link = href || `/menu/${product.slug}`;
  const reduce = useReducedMotion();
  const inventory = useDataStore((s) => s.inventory);
  const cartItems = useCartStore((s) => s.items);
  const categoryName = useDataStore(
    (s) => s.categories.find((c) => c.id === product.category_id)?.name
  );
  const orderable = isProductOrderable(product, inventory);
  const remaining = getRemainingPurchasable(product, inventory, cartItems);

  return (
    <motion.div
      layout
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-white shadow-card",
        className
      )}
    >
      <Link href={link} className="block">
        <div className="relative aspect-square overflow-hidden bg-light-blue">
          {product.image_url ? (
            <motion.div
              className="absolute inset-0"
              whileHover={reduce ? undefined : { scale: 1.06 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center text-sky">
              No image
            </div>
          )}
          {product.is_new && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute left-2 top-2 rounded-full bg-sky px-2 py-0.5 text-[10px] font-semibold text-white"
            >
              NEW
            </motion.span>
          )}
          {!orderable && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy/50">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-navy">
                Unavailable
              </span>
            </div>
          )}
        </div>
      </Link>

      {onFavorite && (
        <motion.button
          type="button"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => onFavorite(product)}
          whileTap={{ scale: 0.85 }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite ? "fill-red-500 text-red-500" : "text-navy/60"
            )}
          />
        </motion.button>
      )}

      <div className="p-3">
        <Link href={link}>
          {categoryName ? (
            <CategoryLabel name={categoryName} className="mb-1.5" />
          ) : null}
          <h3 className="line-clamp-1 text-sm font-semibold text-navy">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {product.description}
            </p>
          )}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-navy">
              {formatCurrency(product.base_price)}
            </p>
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{(product.rating ?? 0).toFixed(1)}</span>
            </div>
          </div>
          {onAdd && orderable && remaining > 0 && (
            <motion.div whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }}>
              <Button
                size="icon"
                aria-label={`Add ${product.name} to cart`}
                onClick={() => onAdd(product)}
                className="h-8 w-8 shrink-0 rounded-full bg-green hover:bg-green/90"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

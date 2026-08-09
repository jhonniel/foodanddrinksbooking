"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

interface CategoryCardProps {
  category: Category;
  href?: string;
  className?: string;
  compact?: boolean;
}

export function CategoryCard({
  category,
  href,
  className,
  compact,
}: CategoryCardProps) {
  const link = href || `/menu?category=${category.slug}`;
  const reduce = useReducedMotion();

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -3, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
    >
      <Link
        href={link}
        className={cn(
          "group relative block overflow-hidden rounded-2xl bg-white shadow-card",
          compact ? "aspect-square" : "aspect-[4/3]",
          className
        )}
      >
        {category.image_url && (
          <motion.div
            className="absolute inset-0"
            whileHover={reduce ? undefined : { scale: 1.08 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={category.image_url}
              alt={category.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 40vw, 20vw"
            />
          </motion.div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-sm font-semibold text-white drop-shadow-sm">
            {category.name}
          </h3>
        </div>
      </Link>
    </motion.div>
  );
}

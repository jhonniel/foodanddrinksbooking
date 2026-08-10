"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { useCartTotals } from "@/hooks/useCartTotals";
import { formatCurrency } from "@/lib/utils/format";
import { AnimatePresence, motion } from "framer-motion";

const HIDDEN_ON = ["/cart", "/checkout", "/profile"];

/** Product detail already has a fixed Add to Cart bar — don't stack View Cart on it. */
function shouldHideStickyCart(pathname: string): boolean {
  if (HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  // /menu/[slug] — not the menu list root
  if (pathname.startsWith("/menu/") && pathname !== "/menu") {
    return true;
  }
  return false;
}

export function StickyCartButton() {
  const pathname = usePathname();
  const items = useCartStore((s) => s.items);
  const { itemCount, total } = useCartTotals();

  const hidden = shouldHideStickyCart(pathname);

  return (
    <AnimatePresence>
      {!hidden && items.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 bottom-[5.25rem] z-40 px-3 sm:px-4 lg:bottom-6"
        >
          <Link
            href="/cart"
            className="pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl bg-green px-4 py-3.5 text-white shadow-lg shadow-green/25 transition hover:bg-green/90 sm:px-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">View Cart</p>
                <p className="text-xs text-white/80">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <span className="text-base font-bold">{formatCurrency(total)}</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

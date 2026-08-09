"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  UtensilsCrossed,
  ClipboardList,
  Gift,
  User,
  ShoppingBag,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { useCartStore } from "@/stores/cart";
import { useCartItemCount } from "@/hooks/useCartTotals";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";

const links = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/profile", label: "Profile", icon: User },
];

export function CustomerHeader() {
  const pathname = usePathname();
  const itemCount = useCartItemCount();
  const notifications = useAppStore((s) => s.notifications);
  const user = useAuthStore((s) => s.user);
  const unread = notifications.filter(
    (n) => !n.is_read && n.user_id === user?.id
  ).length;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 lg:h-16 lg:px-6">
        <Logo size="sm" href="/home" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Desktop navigation">
          {links.map(({ href, label }) => {
            const active =
              pathname === href ||
              (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-green/10 text-green"
                    : "text-navy/70 hover:bg-muted hover:text-navy"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy/70 transition hover:bg-muted"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-green" />
            )}
          </Link>
          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy/70 transition hover:bg-muted"
            aria-label={`Cart${itemCount ? `, ${itemCount} items` : ""}`}
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            href={user ? "/profile" : "/login"}
            className={cn(
              "ml-1 hidden items-center justify-center lg:flex",
              user
                ? "h-9 w-9 rounded-full bg-navy text-xs font-bold text-white"
                : "h-9 rounded-full bg-green px-3 text-xs font-semibold text-white hover:bg-green/90"
            )}
            aria-label={user ? "Profile" : "Sign in"}
          >
            {user ? user.full_name.charAt(0) : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}

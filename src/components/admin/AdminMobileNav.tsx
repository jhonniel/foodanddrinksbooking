"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  MoreHorizontal,
  LogOut,
  Warehouse,
  Users,
  Bike,
  Truck,
  Gift,
  Megaphone,
  CreditCard,
  BarChart3,
  Settings,
  Tags,
  Wallet,
  History,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primary = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Queue", icon: ClipboardList },
  { href: "/admin/products", label: "Products", icon: Package },
];

const moreLinks = [
  { href: "/admin/order-history", label: "Order History", icon: History },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/drivers", label: "Drivers", icon: Bike },
  { href: "/admin/delivery", label: "Delivery", icon: Truck },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/expenses", label: "Expenses", icon: Wallet },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminMobileNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const moreActive = moreLinks.some((l) => pathname.startsWith(l.href));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Logged out");
      window.location.href = "/login";
    } catch {
      toast.error("Could not log out");
      setLoggingOut(false);
    }
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur-md safe-bottom lg:hidden"
      aria-label="Admin mobile navigation"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-center justify-around px-1">
        {primary.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium",
                  active ? "text-green" : "text-muted-foreground"
                )}
              >
                {active && !reduce && (
                  <motion.span
                    layoutId="admin-nav-pill"
                    className="absolute inset-0 -z-10 rounded-xl bg-green/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet>
            <SheetTrigger
              className={cn(
                "relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium",
                moreActive ? "text-green" : "text-muted-foreground"
              )}
            >
              {moreActive && !reduce && (
                <motion.span
                  layoutId="admin-nav-pill"
                  className="absolute inset-0 -z-10 rounded-xl bg-green/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[75vh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle className="text-navy">More</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-3 gap-3 pb-4">
                {moreLinks.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium transition",
                        active
                          ? "border-green/30 bg-green/5 text-green"
                          : "border-border bg-white text-navy hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

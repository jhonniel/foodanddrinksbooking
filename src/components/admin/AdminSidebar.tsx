"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Tags,
  Warehouse,
  Users,
  Bike,
  Truck,
  Gift,
  Megaphone,
  CreditCard,
  BarChart3,
  Wallet,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/lib/constants";
import { NotificationBell } from "@/components/shared/NotificationBell";
import type { UserRole } from "@/types";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "products" },
  { href: "/admin/categories", label: "Categories", icon: Tags, permission: "categories" },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse, permission: "inventory" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers" },
  { href: "/admin/team", label: "Team", icon: Users, permission: "settings" },
  { href: "/admin/drivers", label: "Drivers", icon: Bike, permission: "drivers" },
  { href: "/admin/delivery", label: "Delivery", icon: Truck, permission: "delivery" },
  { href: "/admin/rewards", label: "Rewards", icon: Gift, permission: "rewards" },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone, permission: "promotions" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "payments" },
  { href: "/admin/expenses", label: "Expenses", icon: Wallet, permission: "reports" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = (user?.role || "STAFF") as UserRole;
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const filtered = navItems.filter(
    (item) =>
      hasPermission(role, item.permission) ||
      hasPermission(role, "*") ||
      role === "SUPER_ADMIN"
  );

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

  const Nav = (
    <>
      <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <Logo variant="light" size="sm" href="/admin" showText />
        <NotificationBell
          href="/admin/notifications"
          className="text-white/80 hover:bg-white/10"
        />
      </div>
      <nav
        className="flex-1 space-y-0.5 overflow-y-auto p-3"
        aria-label="Admin navigation"
      >
        {filtered.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-white/70 hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-4">
        <div>
          <p className="text-xs text-white/50">{user?.full_name}</p>
          <p className="text-[11px] capitalize text-white/40">
            {user?.role?.replace("_", " ").toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-navy px-4 lg:hidden">
        <Logo variant="light" size="sm" href="/admin" />
        <div className="flex items-center gap-1">
          <NotificationBell
            href="/admin/notifications"
            className="text-white hover:bg-white/10"
          />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {Nav}
      </aside>
    </>
  );
}

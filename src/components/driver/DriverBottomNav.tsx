"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Wallet, User } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const links = [
  { href: "/driver", label: "Home", icon: Home },
  { href: "/driver/deliveries", label: "Deliveries", icon: Package },
  { href: "/driver/earnings", label: "Earnings", icon: Wallet },
  { href: "/driver/profile", label: "Profile", icon: User },
];

export function DriverBottomNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur-md safe-bottom"
      aria-label="Driver navigation"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/driver"
              ? pathname === "/driver"
              : pathname.startsWith(href);
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                className={cn(
                  "relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-green" : "text-muted-foreground hover:text-navy"
                )}
              >
                {active && !reduce && (
                  <motion.span
                    layoutId="driver-nav-pill"
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
      </ul>
    </nav>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useAuthStore,
  canAccessAdmin,
  canAccessDriver,
  isStaffRole,
} from "@/stores/auth";
import type { UserRole } from "@/types";
import { PageSkeleton } from "@/components/shared/LoadingSkeleton";

interface RoleGuardProps {
  children: React.ReactNode;
  allow: UserRole[] | "staff" | "driver" | "customer" | "authenticated";
  fallbackHref?: string;
}

export function RoleGuard({
  children,
  allow,
  fallbackHref = "/login",
}: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (initializing) return;

    if (!isAuthenticated || !user) {
      router.replace(`${fallbackHref}?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const role = user.role;
    let ok = false;

    if (allow === "authenticated") ok = true;
    else if (allow === "staff") ok = canAccessAdmin(role);
    else if (allow === "driver") ok = canAccessDriver(role);
    else if (allow === "customer") ok = role === "CUSTOMER" || isStaffRole(role);
    else ok = allow.includes(role);

    if (!ok) {
      if (canAccessAdmin(role)) router.replace("/admin");
      else if (role === "DRIVER") router.replace("/driver");
      else router.replace("/home");
    }
  }, [
    allow,
    fallbackHref,
    initializing,
    isAuthenticated,
    pathname,
    router,
    user,
  ]);

  if (initializing || !isAuthenticated || !user) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}

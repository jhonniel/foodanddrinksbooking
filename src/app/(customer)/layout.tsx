"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerBottomNav } from "@/components/customer/CustomerBottomNav";
import { StickyCartButton } from "@/components/customer/StickyCartButton";
import { PurchaseSoonBanner } from "@/components/customer/PurchaseSoonBanner";
import { StoreClosedBanner } from "@/components/customer/StoreClosedBanner";

function CustomerNotificationBridge() {
  const user = useAuthStore((s) => s.user);
  useRealtimeNotifications(user?.id, {
    audience: "customer",
  });
  return null;
}

function CustomerStoreNotices() {
  const pathname = usePathname();
  if (pathname === "/menu") return null;
  return <StoreClosedBanner />;
}

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-green focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <CustomerNotificationBridge />
      <CustomerHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl px-3 pb-28 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pb-8 lg:pt-6"
      >
        <CustomerStoreNotices />
        <PurchaseSoonBanner />
        {children}
      </main>
      <CustomerBottomNav />
      <StickyCartButton />
    </div>
  );
}

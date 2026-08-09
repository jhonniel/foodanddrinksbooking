"use client";

import { useAuthStore } from "@/stores/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { EnableAlertsBanner } from "@/components/shared/NotificationAlerts";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Logo } from "@/components/shared/Logo";
import { DriverBottomNav } from "@/components/driver/DriverBottomNav";
import { RoleGuard } from "@/components/shared/RoleGuard";

function DriverNotificationBridge() {
  const user = useAuthStore((s) => s.user);
  useRealtimeNotifications(user?.id, {
    audience: "driver",
    sound: "urgent",
  });
  return <EnableAlertsBanner audience="driver" />;
}

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allow="driver">
      <div className="min-h-screen overflow-x-hidden bg-surface pb-24">
        <DriverNotificationBridge />
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-white/95 px-3 py-3 backdrop-blur-md safe-top sm:px-4">
          <Logo size="sm" href="/driver" />
          <NotificationBell href="/driver/notifications" className="text-navy/70" />
        </header>
        <main className="w-full min-w-0">{children}</main>
        <DriverBottomNav />
      </div>
    </RoleGuard>
  );
}

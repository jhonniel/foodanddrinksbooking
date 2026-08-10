"use client";

import { useAuthStore } from "@/stores/auth";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { AutoEnableStaffAlerts } from "@/components/shared/NotificationAlerts";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { AdminDriversSync } from "@/components/admin/AdminDriversSync";
import { RouteTransition } from "@/components/motion";

function AdminNotificationBridge() {
  const user = useAuthStore((s) => s.user);
  useRealtimeNotifications(user?.id, {
    audience: "admin",
    alsoMatchIds: ["staff"],
    sound: "urgent",
  });
  return <AutoEnableStaffAlerts />;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allow="staff">
      <div className="min-h-screen overflow-x-hidden bg-surface admin-shell">
        <AdminNotificationBridge />
        <AdminDriversSync />
        <AdminSidebar />
        <main className="min-h-screen min-w-0 pt-14 pb-20 lg:pb-0 lg:pl-64 lg:pt-0">
          <AdminTopBar />
          <div className="mx-auto w-full max-w-[1600px]">
            <RouteTransition>{children}</RouteTransition>
          </div>
        </main>
        <AdminMobileNav />
      </div>
    </RoleGuard>
  );
}

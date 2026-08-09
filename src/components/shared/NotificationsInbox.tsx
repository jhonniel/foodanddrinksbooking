"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { CustomerSoundToggle } from "@/components/shared/NotificationAlerts";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { relativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

function NotificationIcon({ type }: { type: Notification["type"] }) {
  const colors: Record<string, string> = {
    ORDER: "bg-green/10 text-green",
    DELIVERY: "bg-sky/10 text-sky",
    POINTS: "bg-amber-50 text-amber-600",
    REWARD: "bg-fresh/10 text-fresh",
    PROMOTION: "bg-light-blue text-sky",
    SYSTEM: "bg-muted text-navy",
    INVENTORY: "bg-muted text-navy",
  };

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        colors[type] ?? colors.SYSTEM
      )}
    >
      <Bell className="h-4 w-4" />
    </div>
  );
}

export function NotificationsInbox({
  orderHref,
  showSoundToggle = false,
  includeStaffBroadcast = false,
}: {
  orderHref: (orderId: string) => string;
  showSoundToggle?: boolean;
  includeStaffBroadcast?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);

  const userNotifications = notifications
    .filter(
      (n) =>
        n.user_id === user?.id ||
        (includeStaffBroadcast && n.user_id === "staff")
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const unreadCount = userNotifications.filter((n) => !n.is_read).length;

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) {
      markRead(notification.id);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 pb-8 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showSoundToggle && <CustomerSoundToggle />}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead(user?.id)}
              className="shrink-0 rounded-xl"
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {userNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Updates about orders and delivery will appear here"
        />
      ) : (
        <div className="space-y-2">
          {userNotifications.map((notification) => {
            const orderId = notification.data?.orderId as string | undefined;
            const content = (
              <div
                className={cn(
                  "flex gap-3 rounded-2xl p-4 transition-colors",
                  notification.is_read
                    ? "bg-white shadow-card"
                    : "bg-light-blue shadow-card"
                )}
              >
                <NotificationIcon type={notification.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-navy">
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {relativeTime(notification.created_at)}
                  </p>
                </div>
              </div>
            );

            if (orderId) {
              return (
                <Link
                  key={notification.id}
                  href={orderHref(orderId)}
                  onClick={() => handleClick(notification)}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClick(notification)}
                className="block w-full text-left"
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

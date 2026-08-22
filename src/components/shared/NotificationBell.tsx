"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { cn } from "@/lib/utils";

export function NotificationBell({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const notifications = useAppStore((s) => s.notifications);

  const unread = notifications.filter(
    (n) => !n.is_read && n.user_id === user?.id
  ).length;

  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-current transition hover:bg-black/5",
        className
      )}
      aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

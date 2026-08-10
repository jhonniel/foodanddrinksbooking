"use client";

import { NotificationBell } from "@/components/shared/NotificationBell";

/** Desktop-only top bar — notifications live top-right, not in the sidebar. */
export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center justify-end border-b border-border/60 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:flex lg:px-8">
      <NotificationBell
        href="/admin/notifications"
        className="text-navy hover:bg-surface"
      />
    </header>
  );
}

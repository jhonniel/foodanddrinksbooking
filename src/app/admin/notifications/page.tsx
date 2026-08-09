"use client";

import { NotificationsInbox } from "@/components/shared/NotificationsInbox";

export default function AdminNotificationsPage() {
  return (
    <NotificationsInbox
      orderHref={() => `/admin/orders`}
      includeStaffBroadcast
    />
  );
}

"use client";

import { NotificationsInbox } from "@/components/shared/NotificationsInbox";

export default function DriverNotificationsPage() {
  return (
    <NotificationsInbox orderHref={() => `/driver/deliveries`} />
  );
}

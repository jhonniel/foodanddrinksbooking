"use client";

import { NotificationsInbox } from "@/components/shared/NotificationsInbox";

export default function CustomerNotificationsPage() {
  return (
    <NotificationsInbox
      orderHref={(id) => `/orders/${id}`}
      showSoundToggle
    />
  );
}

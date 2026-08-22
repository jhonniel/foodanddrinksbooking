"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { fetchNotifications } from "@/services/notificationSyncService";

const POLL_MS = 5000;

/** Load notifications from Supabase for customers, drivers, and staff. */
export function NotificationsSync() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const setNotifications = useAppStore((s) => s.setNotifications);

  useEffect(() => {
    if (initializing || !user) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { notifications, error } = await fetchNotifications();
      if (cancelled || error) return;
      setNotifications(notifications);
    };

    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.id, initializing, setNotifications]);

  return null;
}

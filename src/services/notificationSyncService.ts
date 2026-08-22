import type { Notification } from "@/types";

export async function fetchNotifications(): Promise<{
  configured: boolean;
  notifications: Notification[];
  error?: string;
}> {
  const res = await fetch("/api/me/notifications", {
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => null)) as {
    configured?: boolean;
    notifications?: Notification[];
    error?: string;
  } | null;

  if (!res.ok) {
    if (res.status === 401) {
      return { configured: false, notifications: [] };
    }
    return {
      configured: payload?.configured ?? false,
      notifications: [],
      error: payload?.error || "Could not load notifications.",
    };
  }

  return {
    configured: payload?.configured ?? true,
    notifications: Array.isArray(payload?.notifications)
      ? payload!.notifications!
      : [],
  };
}

export async function markNotificationReadRemote(
  notificationId: string
): Promise<{ error?: string }> {
  const res = await fetch(`/api/me/notifications/${notificationId}`, {
    method: "PATCH",
    credentials: "include",
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not mark notification read." };
  }

  return {};
}

export async function markAllNotificationsReadRemote(): Promise<{
  error?: string;
}> {
  const res = await fetch("/api/me/notifications", {
    method: "PATCH",
    credentials: "include",
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not mark all read." };
  }

  return {};
}

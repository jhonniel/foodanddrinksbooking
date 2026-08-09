"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import type { Notification } from "@/types";
import {
  getCustomerSoundPref,
  playAlertSound,
  showBrowserNotification,
  type AlertSoundKind,
} from "@/lib/notifications/alert";

export type NotificationAudience = "admin" | "driver" | "customer";

export interface RealtimeNotificationOptions {
  audience: NotificationAudience;
  /** Extra user ids to match (e.g. broadcast "staff") */
  alsoMatchIds?: string[];
  sound?: AlertSoundKind;
  hrefFor?: (n: Notification) => string | undefined;
}

function resolveSound(
  audience: NotificationAudience,
  override?: AlertSoundKind
): AlertSoundKind {
  if (override) return override;
  if (audience === "admin" || audience === "driver") return "urgent";
  return getCustomerSoundPref();
}

function defaultHref(
  audience: NotificationAudience,
  n: Notification
): string | undefined {
  const orderId = n.data?.orderId as string | undefined;
  if (audience === "admin") {
    return orderId ? "/admin/orders" : "/admin/orders";
  }
  if (audience === "driver") {
    return "/driver/deliveries";
  }
  if (orderId) return `/orders/${orderId}`;
  return "/notifications";
}

/**
 * Watches the notification store and alerts the signed-in user:
 * - Admin / rider: loud alert + browser notification
 * - Customer: soft bell (or silent) + toast
 */
export function useRealtimeNotifications(
  userId: string | null | undefined,
  options: RealtimeNotificationOptions
) {
  const notifications = useAppStore((s) => s.notifications);
  const seen = useRef<Set<string>>(new Set());
  const ready = useRef(false);
  const matchKey = (options.alsoMatchIds ?? []).slice().sort().join("|");

  useEffect(() => {
    ready.current = false;
    seen.current = new Set();
  }, [userId, options.audience]);

  useEffect(() => {
    if (!userId) return;

    if (!ready.current) {
      notifications.forEach((n) => seen.current.add(n.id));
      ready.current = true;
      return;
    }

    const matchIds = matchKey ? matchKey.split("|") : [];
    const sound = resolveSound(options.audience, options.sound);
    const playedKeys = new Set<string>();

    for (const n of notifications) {
      if (seen.current.has(n.id)) continue;
      const matches =
        n.user_id === userId || matchIds.includes(n.user_id);
      if (!matches) continue;
      seen.current.add(n.id);
      if (n.is_read) continue;

      const href =
        options.hrefFor?.(n) ?? defaultHref(options.audience, n);

      const playKey = `${String(n.data?.orderId ?? "")}:${n.title}:${n.type}`;
      const isFirstOfBatch = !playedKeys.has(playKey);
      if (isFirstOfBatch) {
        playedKeys.add(playKey);
        void playAlertSound(sound);
        if (options.audience === "admin" || options.audience === "driver") {
          showBrowserNotification({
            title: n.title,
            body: n.body,
            tag: playKey || n.id,
            href,
          });
        } else if (document.visibilityState === "hidden") {
          showBrowserNotification({
            title: n.title,
            body: n.body,
            tag: n.id,
            href,
          });
        }

        if (options.audience === "admin" || options.audience === "driver") {
          toast(n.title, {
            description: n.body,
            duration: 8000,
            action: href
              ? {
                  label: "Open",
                  onClick: () => {
                    window.location.href = href;
                  },
                }
              : undefined,
          });
        } else {
          toast(n.title, {
            description: n.body,
            duration: 4500,
          });
        }
      }
    }
  }, [notifications, userId, options.audience, options.sound, matchKey]);
}

import "server-only";

import type { Notification, NotificationType } from "@/types";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";

type DbNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

function mapNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown>) ?? {},
    is_read: row.is_read,
    created_at: row.created_at,
  };
}

export async function listNotificationsForUser(
  userId: string,
  opts?: { includeStaffBroadcast?: boolean; isStaff?: boolean }
): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return (data as DbNotification[]).map(mapNotification);
}

export async function createNotificationInSupabase(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<Notification | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await createServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      is_read: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[notifications] insert failed:", error?.message);
    return null;
  }

  return mapNotification(data as DbNotification);
}

export async function notifyStaffInSupabase(input: {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = await createServerClient();
  if (!client) return;

  const { data: staff } = await client
    .from("profiles")
    .select("id")
    .in("role", ["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"])
    .eq("is_active", true);

  for (const row of staff ?? []) {
    await createNotificationInSupabase({
      userId: String(row.id),
      ...input,
    });
  }
}

export async function markNotificationReadInSupabase(
  notificationId: string,
  userId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return {};
}

export async function markAllNotificationsReadInSupabase(
  userId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) return { error: error.message };
  return {};
}

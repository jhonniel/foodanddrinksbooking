import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileFromCookies } from "@/lib/auth/server";
import { jsonError } from "@/lib/auth/http";
import { MAINTENANCE_COOKIE } from "@/lib/auth/config";
import { getAppSettings, updateAppSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const YEAR_SEC = 60 * 60 * 24 * 365;

function noStoreJson(
  body: Record<string, unknown>,
  init?: ResponseInit
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function withMaintenanceCookie(
  body: Record<string, unknown>,
  enabled: boolean,
  init?: ResponseInit
) {
  const res = noStoreJson(body, init);
  res.cookies.set(MAINTENANCE_COOKIE, enabled ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    maxAge: YEAR_SEC,
    httpOnly: false,
  });
  return res;
}

export async function GET() {
  try {
    const settings = await getAppSettings();
    return withMaintenanceCookie({ settings }, settings.maintenance_mode);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to load settings.",
      500
    );
  }
}

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/, "Open time must be HH:mm"),
  close: z.string().regex(/^\d{2}:\d{2}$/, "Close time must be HH:mm"),
});

const storeHoursSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().min(1),
  schedule: z.record(z.string(), dayScheduleSchema),
});

const storeInfoSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(300),
  phone: z.string().min(1).max(40),
  lat: z.number().finite(),
  lng: z.number().finite(),
  hours: z.string().max(120),
});

const deliverySettingsSchema = z.object({
  baseFee: z.number().nonnegative(),
  baseKm: z.number().positive(),
  perKmFee: z.number().nonnegative(),
  freeAbove: z.number().nonnegative(),
  radiusKm: z.number().positive(),
  baseMinutes: z.number().nonnegative(),
  minutesPerKm: z.number().nonnegative(),
  estimatedMinutes: z.number().positive(),
});

const patchSchema = z
  .object({
    maintenance_mode: z.boolean().optional(),
    purchase_soon_mode: z.boolean().optional(),
    store_hours: storeHoursSchema.optional(),
    store: storeInfoSchema.optional(),
    delivery: deliverySettingsSchema.optional(),
  })
  .refine(
    (data) =>
      data.maintenance_mode !== undefined ||
      data.purchase_soon_mode !== undefined ||
      data.store_hours !== undefined ||
      data.store !== undefined ||
      data.delivery !== undefined,
    { message: "No settings to update." }
  );

export async function PATCH(request: Request) {
  const actor = await getSessionProfileFromCookies();
  if (!actor || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    return jsonError("Forbidden.", 403);
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid input.");
  }

  try {
    const settings = await updateAppSettings(parsed.data);
    return withMaintenanceCookie({ settings }, settings.maintenance_mode);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to update settings.",
      500
    );
  }
}

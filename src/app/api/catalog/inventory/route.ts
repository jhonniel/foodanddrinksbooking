import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromCookies,
} from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  deleteInventoryItemInSupabase,
  saveInventoryItemInSupabase,
} from "@/lib/supabase/catalog";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  unit: z.enum(["g", "ml", "pcs", "kg", "L"]),
  currentQuantity: z.coerce.number().nonnegative(),
  minimumStock: z.coerce.number().nonnegative(),
  costPerUnit: z.coerce.number().nonnegative().optional(),
  supplier: z.string().max(120).optional().nullable(),
  sku: z.string().max(64).optional().nullable(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function PUT(request: Request) {
  const profile = await getSessionProfileFromCookies();
  if (!assertRole(profile, "staff")) {
    return jsonError("Unauthorized.", 401);
  }
  if (!isSupabaseConfigured()) {
    return jsonOk({ ok: true, skipped: true });
  }

  const json = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid inventory payload.");
  }

  const result = await saveInventoryItemInSupabase(parsed.data);
  if (result.error || !result.item) {
    return jsonError(result.error || "Could not save inventory item.", 502);
  }

  return jsonOk({ ok: true, item: result.item });
}

export async function DELETE(request: Request) {
  const profile = await getSessionProfileFromCookies();
  if (!assertRole(profile, "staff")) {
    return jsonError("Unauthorized.", 401);
  }
  if (!isSupabaseConfigured()) {
    return jsonOk({ ok: true, skipped: true });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid inventory item id.");

  const result = await deleteInventoryItemInSupabase(parsed.data.id);
  if (result.error) return jsonError(result.error, 502);
  return jsonOk({ ok: true });
}

import { z } from "zod";
import { getSessionProfileFromCookies } from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import {
  getAppSettings,
  setMaintenanceMode,
} from "@/lib/settings/store";

export async function GET() {
  const settings = await getAppSettings();
  return jsonOk({ settings });
}

const patchSchema = z.object({
  maintenance_mode: z.boolean(),
});

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

  const settings = await setMaintenanceMode(parsed.data.maintenance_mode);
  return jsonOk({ settings });
}

import { z } from "zod";
import { updateAccountRole } from "@/lib/auth/accounts";
import { getSessionProfileFromCookies } from "@/lib/auth/server";
import { jsonError, jsonOk } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import { ensureDriverForProfile } from "@/lib/supabase/drivers";
import type { Profile } from "@/types";

const bodySchema = z.object({
  accountId: z.string().min(1),
  role: z.enum([
    "CUSTOMER",
    "STAFF",
    "MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
    "DRIVER",
  ]),
});

export async function POST(request: Request) {
  const actor = await getSessionProfileFromCookies();
  if (!actor || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    return jsonError("Forbidden.", 403);
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid input.");
  }

  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    if (!supabase) return jsonError("Auth is not configured.", 500);

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.accountId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return jsonError(error?.message ?? "Failed to update role.");
    }

    await supabase.auth.admin.updateUserById(parsed.data.accountId, {
      app_metadata: { role: parsed.data.role },
    });

    if (parsed.data.role === "DRIVER") {
      await ensureDriverForProfile(data as Profile);
    }

    return jsonOk({ profile: data });
  }

  const result = await updateAccountRole(
    parsed.data.accountId,
    parsed.data.role,
    actor.id
  );
  if ("error" in result) {
    return jsonError(result.error);
  }
  return jsonOk({ profile: result.profile });
}

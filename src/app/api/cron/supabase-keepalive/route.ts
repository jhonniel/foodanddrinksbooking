import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight ping so free-tier Supabase projects do not pause from inactivity.
 * Intended to run on a schedule (every 3 days) when the app has no real traffic.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron sends this automatically when CRON_SECRET is set.)
 */
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  // Optional query fallback for manual checks (same secret)
  const q = req.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const client = await createServerClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Could not create Supabase client." },
      { status: 503 }
    );
  }

  // Cheap read against a public/bootstrap table — wakes Auth + DB.
  const { error: dbError } = await client
    .from("categories")
    .select("id")
    .limit(1);

  // Touch Auth API as well (no user session required).
  const { error: authError } = await client.auth.getSession();

  const ok = !dbError;
  return NextResponse.json(
    {
      ok,
      at: new Date().toISOString(),
      database: !dbError,
      auth: !authError,
      error: dbError?.message ?? null,
    },
    { status: ok ? 200 : 502 }
  );
}

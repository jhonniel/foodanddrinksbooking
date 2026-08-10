import { NextResponse } from "next/server";

/**
 * Removed: client-built orders must never be written to a local file.
 * All orders go through POST /api/orders → Supabase.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Local order sync is disabled. Place orders via checkout (POST /api/orders) so they are stored in Supabase.",
    },
    { status: 410 }
  );
}

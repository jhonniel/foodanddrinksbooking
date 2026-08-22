import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  createExpenseInSupabase,
  listExpensesFromSupabase,
} from "@/lib/supabase/expenses";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.enum([
    "RENT",
    "UTILITIES",
    "PAYROLL",
    "SUPPLIES",
    "MARKETING",
    "DELIVERY",
    "MAINTENANCE",
    "OTHER",
  ]),
  amount: z.coerce.number().positive(),
  notes: z.string().max(500).optional(),
  incurredAt: z.string().min(8),
});

export async function GET(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { configured: false, expenses: [], error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const expenses = await listExpensesFromSupabase();
  return NextResponse.json({ configured: true, expenses });
}

export async function POST(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required for expenses." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const result = await createExpenseInSupabase({
    ...parsed.data,
    notes: parsed.data.notes ?? null,
    createdBy: profile.id,
  });

  if (result.error || !result.expense) {
    return NextResponse.json(
      { error: result.error || "Could not create expense." },
      { status: 400 }
    );
  }

  return NextResponse.json({ expense: result.expense });
}

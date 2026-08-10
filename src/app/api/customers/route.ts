import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertRole,
  getSessionProfileFromRequest,
} from "@/lib/auth/server";
import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    full_name: String(row.full_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: (row.role as UserRole) || "CUSTOMER",
    is_active: Boolean(row.is_active ?? true),
    points_balance: Number(row.points_balance ?? 0),
    lifetime_points: Number(row.lifetime_points ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: "Supabase is required to list customers.",
        customers: [],
      },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is required to list customers.",
        customers: [],
      },
      { status: 503 }
    );
  }

  const client = await createServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase client unavailable.", customers: [] },
      { status: 500 }
    );
  }

  const roleFilter = new URL(request.url).searchParams.get("role");

  let query = client
    .from("profiles")
    .select(
      "id, email, full_name, phone, avatar_url, role, is_active, points_balance, lifetime_points, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (roleFilter && roleFilter !== "ALL") {
    query = query.eq("role", roleFilter);
  } else if (!roleFilter) {
    // Default: customers page — all CUSTOMER accounts from the database.
    query = query.eq("role", "CUSTOMER");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[customers] list failed:", error.message);
    return NextResponse.json(
      { error: error.message, customers: [] },
      { status: 502 }
    );
  }

  const customers = (data ?? []).map((row) =>
    mapProfile(row as Record<string, unknown>)
  );
  const ids = customers.map((c) => c.id);

  const orderStats: Record<string, { orderCount: number; totalSpent: number }> =
    {};
  if (ids.length) {
    const { data: orders } = await client
      .from("orders")
      .select("customer_id, total, status")
      .in("customer_id", ids);

    for (const order of orders ?? []) {
      const cid = String(order.customer_id);
      if (!orderStats[cid]) {
        orderStats[cid] = { orderCount: 0, totalSpent: 0 };
      }
      orderStats[cid].orderCount += 1;
      if (order.status !== "CANCELLED") {
        orderStats[cid].totalSpent += Number(order.total ?? 0);
      }
    }
  }

  return NextResponse.json({
    customers: customers.map((c) => ({
      ...c,
      orderCount: orderStats[c.id]?.orderCount ?? 0,
      totalSpent: orderStats[c.id]?.totalSpent ?? 0,
    })),
  });
}

const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "Supabase service role is required to create customers." },
      { status: 503 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 422 }
    );
  }

  const client = await createServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase client unavailable." },
      { status: 500 }
    );
  }

  const { fullName, email, phone } = parsed.data;
  const password =
    parsed.data.password ||
    `Ic${Math.random().toString(36).slice(2, 10)}A1!`;

  const { data: created, error: createError } =
    await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone ?? null,
      },
      app_metadata: { role: "CUSTOMER" },
    });

  if (createError || !created.user) {
    const msg = createError?.message ?? "Could not create customer.";
    if (/already|registered|exists/i.test(msg)) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = created.user.id;
  const now = new Date().toISOString();
  const { data: row, error: profileError } = await client
    .from("profiles")
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      phone: phone ?? null,
      role: "CUSTOMER",
      is_active: true,
      points_balance: 0,
      lifetime_points: 0,
      updated_at: now,
    })
    .select(
      "id, email, full_name, phone, avatar_url, role, is_active, points_balance, lifetime_points, created_at, updated_at"
    )
    .single();

  if (profileError || !row) {
    return NextResponse.json(
      { error: profileError?.message || "User created but profile failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      customer: {
        ...mapProfile(row as Record<string, unknown>),
        orderCount: 0,
        totalSpent: 0,
      },
      temporaryPassword: parsed.data.password ? undefined : password,
    },
    { status: 201 }
  );
}

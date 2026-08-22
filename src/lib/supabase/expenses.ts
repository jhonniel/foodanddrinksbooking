import "server-only";

import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServerClient } from "@/lib/supabase/server";
import type { Expense, ExpenseCategory } from "@/types";

type DbExpense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number | string;
  notes: string | null;
  incurred_at: string;
  created_at: string;
  updated_at: string;
};

function mapExpense(row: DbExpense): Expense {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    notes: row.notes,
    incurred_at: row.incurred_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listExpensesFromSupabase(): Promise<Expense[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("store_expenses")
    .select("*")
    .order("incurred_at", { ascending: false });

  if (error) {
    console.error("[expenses] list failed:", error.message);
    return [];
  }

  return ((data ?? []) as DbExpense[]).map(mapExpense);
}

export async function createExpenseInSupabase(input: {
  title: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string | null;
  incurredAt: string;
  createdBy?: string;
}): Promise<{ expense?: Expense; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("store_expenses")
    .insert({
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      notes: input.notes?.trim() || null,
      incurred_at: input.incurredAt,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message || "Could not create expense." };
  }

  return { expense: mapExpense(data as DbExpense) };
}

export async function deleteExpenseInSupabase(
  expenseId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }
  const client = await createServerClient();
  if (!client) return { error: "Supabase is not configured." };

  const { error } = await client
    .from("store_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) return { error: error.message };
  return {};
}

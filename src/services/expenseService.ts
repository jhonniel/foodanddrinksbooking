import type { Expense, ExpenseCategory } from "@/types";

export async function fetchExpenses(): Promise<{
  expenses: Expense[];
  configured: boolean;
  error?: string;
}> {
  const res = await fetch("/api/admin/expenses", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => null)) as {
    expenses?: Expense[];
    configured?: boolean;
    error?: string;
  } | null;

  if (!res.ok) {
    return {
      expenses: [],
      configured: payload?.configured ?? false,
      error: payload?.error || "Could not load expenses.",
    };
  }

  return {
    expenses: Array.isArray(payload?.expenses) ? payload!.expenses! : [],
    configured: payload?.configured ?? true,
  };
}

export async function createExpenseRemote(input: {
  title: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  incurredAt: string;
}): Promise<{ expense?: Expense; error?: string }> {
  const res = await fetch("/api/admin/expenses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => null)) as {
    expense?: Expense;
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not save expense." };
  }

  return { expense: payload?.expense };
}

export async function deleteExpenseRemote(
  expenseId: string
): Promise<{ error?: string }> {
  const res = await fetch(`/api/admin/expenses/${expenseId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    return { error: payload?.error || "Could not delete expense." };
  }

  return {};
}

"use client";

import { useEffect } from "react";
import { useDataStore } from "@/stores/data";
import { fetchExpenses } from "@/services/expenseService";

/** Load shared expenses from Supabase and keep them in sync across admin sessions. */
export function useExpensesSync(pollMs = 12_000) {
  const setExpenses = useDataStore((s) => s.setExpenses);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { expenses, error } = await fetchExpenses();
      if (cancelled) return;
      if (!error) {
        setExpenses(expenses);
      }
    };

    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setExpenses, pollMs]);
}

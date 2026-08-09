"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import {
  EXPENSE_CATEGORY_LABELS,
  computeFinance,
} from "@/services/financeService";
import { useAppStore } from "@/stores/app";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ExpenseCategory } from "@/types";

const EXPENSE_CATEGORIES = Object.keys(
  EXPENSE_CATEGORY_LABELS
) as ExpenseCategory[];

export default function AdminExpensesPage() {
  const orders = useAppStore((s) => s.orders);
  const expenses = useDataStore((s) => s.expenses);
  const addExpense = useDataStore((s) => s.addExpense);
  const deleteExpense = useDataStore((s) => s.deleteExpense);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("SUPPLIES");
  const [notes, setNotes] = useState("");
  const [incurredAt, setIncurredAt] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const finance = useMemo(
    () => computeFinance(orders, expenses),
    [orders, expenses]
  );

  const recentExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) =>
          new Date(b.incurred_at).getTime() - new Date(a.incurred_at).getTime()
      ),
    [expenses]
  );

  const resetForm = () => {
    setTitle("");
    setAmount("");
    setNotes("");
    setCategory("SUPPLIES");
    setIncurredAt(new Date().toISOString().slice(0, 10));
  };

  const handleSave = () => {
    const parsed = parseFloat(amount);
    if (!title.trim()) {
      toast.error("Expense title is required.");
      return;
    }
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }

    const day = incurredAt
      ? new Date(`${incurredAt}T12:00:00`)
      : new Date();

    addExpense({
      title: title.trim(),
      category,
      amount: parsed,
      notes: notes.trim() || undefined,
      incurredAt: day.toISOString(),
    });

    toast.success("Expense recorded.");
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Record store costs like rent, utilities, supplies, and payroll
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-green px-4 text-sm font-medium text-white hover:bg-green/90">
            <Plus className="h-4 w-4" />
            Record expense
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="exp-title">Title *</Label>
                <Input
                  id="exp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Store rent"
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={category}
                  onValueChange={(v) => v && setCategory(v as ExpenseCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {EXPENSE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="exp-amount">Amount (₱) *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div>
                <Label htmlFor="exp-date">Date *</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={incurredAt}
                  onChange={(e) => setIncurredAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="exp-notes">Notes</Label>
                <Textarea
                  id="exp-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details"
                />
              </div>
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={handleSave}
              >
                Save expense
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Manual expenses</p>
          <p className="mt-1 text-xl font-bold text-navy">
            {formatCurrency(finance.manualExpenses)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs text-muted-foreground">
            Estimated ingredient COGS
          </p>
          <p className="mt-1 text-xl font-bold text-navy">
            {formatCurrency(finance.cogs)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total expenses</p>
          <p className="mt-1 text-xl font-bold text-navy">
            {formatCurrency(finance.expenses)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-4 font-semibold text-navy">Expense log</h2>
        {recentExpenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No expenses yet"
            description="Tap Record expense to add rent, utilities, supplies, and more."
          />
        ) : (
          <ul className="divide-y divide-border">
            {recentExpenses.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium text-navy">{expense.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {EXPENSE_CATEGORY_LABELS[expense.category]} ·{" "}
                    {formatDateTime(expense.incurred_at)}
                    {expense.notes ? ` · ${expense.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy">
                    {formatCurrency(expense.amount)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => {
                      deleteExpense(expense.id);
                      toast.success("Expense removed.");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

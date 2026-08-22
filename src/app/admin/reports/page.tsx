"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";
import {
  createExpenseRemote,
  deleteExpenseRemote,
} from "@/services/expenseService";
import { StatsCard } from "@/components/shared/StatsCard";
import {
  computeAnalytics,
  salesOverTime,
  topProducts,
  revenueByCategory,
} from "@/services/analyticsService";
import {
  computeFinance,
  salesVsExpensesOverTime,
  EXPENSE_CATEGORY_LABELS,
} from "@/services/financeService";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign,
  ShoppingBag,
  RotateCcw,
  Truck,
  Gift,
  Users,
  Wallet,
  TrendingUp,
  Plus,
  Trash2,
} from "lucide-react";
import type { Expense, ExpenseCategory } from "@/types";

const PIE_COLORS = ["#1FA7E1", "#176B3A", "#0B2A4A", "#2E8B57", "#94a3b8"];

const EXPENSE_CATEGORIES = Object.keys(
  EXPENSE_CATEGORY_LABELS
) as ExpenseCategory[];

export default function AdminReportsPage() {
  const orders = useAppStore((s) => s.orders);
  const expenses = useDataStore((s) => s.expenses);
  const prependExpense = useDataStore((s) => s.prependExpense);
  const deleteExpense = useDataStore((s) => s.deleteExpense);
  const [range, setRange] = useState("7d");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("SUPPLIES");
  const [notes, setNotes] = useState("");

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const summary = useMemo(() => computeAnalytics(orders), [orders]);
  const finance = useMemo(
    () => computeFinance(orders, expenses),
    [orders, expenses]
  );
  const sales = useMemo(
    () => salesOverTime(orders, Math.min(days, 14)),
    [orders, days]
  );
  const salesExpenses = useMemo(
    () => salesVsExpensesOverTime(orders, expenses, Math.min(days, 14)),
    [orders, expenses, days]
  );
  const products = useMemo(() => topProducts(orders, 6), [orders]);
  const categories = useMemo(() => revenueByCategory(orders), [orders]);

  const recentExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) =>
          new Date(b.incurred_at).getTime() - new Date(a.incurred_at).getTime()
      ),
    [expenses]
  );

  const handleAddExpense = async () => {
    const parsed = parseFloat(amount);
    if (!title.trim()) {
      toast.error("Expense title is required.");
      return;
    }
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      const result = await createExpenseRemote({
        title: title.trim(),
        category,
        amount: parsed,
        notes: notes.trim() || undefined,
        incurredAt: new Date().toISOString(),
      });

      if (result.error || !result.expense) {
        toast.error(result.error || "Could not save expense.");
        return;
      }

      prependExpense(result.expense);
      toast.success("Expense recorded.");
      setDialogOpen(false);
      setTitle("");
      setAmount("");
      setNotes("");
      setCategory("SUPPLIES");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const result = await deleteExpenseRemote(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      deleteExpense(deleteTarget.id);
      toast.success("Expense removed.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently remove{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.title}
                  </span>{" "}
                  ({formatCurrency(deleteTarget.amount)}) for all admins. This
                  action cannot be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Sales, expenses, products, loyalty, and delivery performance
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v ?? "7d")}>
          <SelectTrigger className="w-36 bg-white">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard
          title="Total Sales"
          value={formatCurrency(finance.sales)}
          icon={DollarSign}
        />
        <StatsCard
          title="Total Expenses"
          value={formatCurrency(finance.expenses)}
          icon={Wallet}
        />
        <StatsCard
          title="Net Profit"
          value={formatCurrency(finance.profit)}
          icon={TrendingUp}
        />
        <StatsCard
          title="Orders"
          value={String(summary.totalOrders)}
          icon={ShoppingBag}
        />
        <StatsCard
          title="Avg Order Value"
          value={formatCurrency(summary.averageOrderValue)}
          icon={DollarSign}
        />
        <StatsCard
          title="Repeat Customers"
          value={String(summary.repeatCustomers)}
          icon={Users}
        />
        <StatsCard
          title="Points Issued"
          value={summary.pointsIssued.toLocaleString()}
          icon={Gift}
        />
        <StatsCard
          title="Delivery Rate"
          value={`${summary.deliveryCompletionRate}%`}
          icon={Truck}
        />
        <StatsCard
          title="Ingredient COGS"
          value={formatCurrency(finance.cogs)}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Sales vs Expenses</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesExpenses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="#1FA7E1"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Orders Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#176B3A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy">Expenses</h2>
            <p className="text-xs text-muted-foreground">
              Manual costs + estimated ingredient COGS from delivered orders
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90">
              <Plus className="mr-0 h-4 w-4" />
              Add expense
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add expense</DialogTitle>
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
                    onValueChange={(v) =>
                      v && setCategory(v as ExpenseCategory)
                    }
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
                  <Label htmlFor="exp-notes">Notes</Label>
                  <Textarea
                    id="exp-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-green hover:bg-green/90"
                  onClick={() => void handleAddExpense()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save expense"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface px-3 py-2">
            <p className="text-xs text-muted-foreground">Manual expenses</p>
            <p className="font-semibold text-navy">
              {formatCurrency(finance.manualExpenses)}
            </p>
          </div>
          <div className="rounded-xl bg-surface px-3 py-2">
            <p className="text-xs text-muted-foreground">Estimated COGS</p>
            <p className="font-semibold text-navy">
              {formatCurrency(finance.cogs)}
            </p>
          </div>
          <div className="rounded-xl bg-surface px-3 py-2">
            <p className="text-xs text-muted-foreground">Combined</p>
            <p className="font-semibold text-navy">
              {formatCurrency(finance.expenses)}
            </p>
          </div>
        </div>

        {recentExpenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No expenses recorded yet.
          </p>
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
                    aria-label={`Delete ${expense.title}`}
                    onClick={() => setDeleteTarget(expense)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Top Products</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={products} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="qty" fill="#1FA7E1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Revenue by Category</h2>
          <div className="flex h-64 items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {categories.map((c, i) => (
              <li
                key={c.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-navy">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {c.name}
                </span>
                <span className="font-medium text-muted-foreground">
                  {formatCurrency(c.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RotateCcw className="h-4 w-4" />
            Delivered
          </div>
          <p className="mt-2 text-2xl font-bold text-navy">
            {summary.deliveredOrders}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Cancelled
          </div>
          <p className="mt-2 text-2xl font-bold text-navy">
            {summary.cancelledOrders}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Points Redeemed
          </div>
          <p className="mt-2 text-2xl font-bold text-navy">
            {summary.pointsRedeemed.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

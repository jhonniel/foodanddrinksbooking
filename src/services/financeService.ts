import type { Expense, Order, OrderStatus } from "@/types";
import { useDataStore } from "@/stores/data";

export const EXPENSE_CATEGORY_LABELS: Record<Expense["category"], string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  PAYROLL: "Payroll",
  SUPPLIES: "Supplies",
  MARKETING: "Marketing",
  DELIVERY: "Delivery",
  MAINTENANCE: "Maintenance",
  OTHER: "Other",
};

function isCountedSale(status: OrderStatus) {
  return status !== "CANCELLED";
}

function isDelivered(status: OrderStatus) {
  return status === "DELIVERED";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(iso: string, day: Date) {
  return startOfDay(new Date(iso)).getTime() === startOfDay(day).getTime();
}

/** Estimated ingredient cost from recipes × inventory cost_per_unit. */
export function estimateOrderCogs(order: Order): number {
  const { products, inventory } = useDataStore.getState();
  let total = 0;
  for (const item of order.items ?? []) {
    const product = products.find((p) => p.id === item.product_id);
    for (const recipe of product?.recipes ?? []) {
      const inv = inventory.find((i) => i.id === recipe.inventory_item_id);
      const unitCost = inv?.cost_per_unit ?? 0;
      total += recipe.quantity_required * item.quantity * unitCost;
    }
  }
  return Math.round(total * 100) / 100;
}

export function sumSales(orders: Order[], opts?: { todayOnly?: boolean }) {
  const today = new Date();
  return orders
    .filter((o) => isCountedSale(o.status))
    .filter((o) => (opts?.todayOnly ? isSameDay(o.created_at, today) : true))
    .reduce((sum, o) => sum + o.total, 0);
}

export function sumManualExpenses(
  expenses: Expense[],
  opts?: { todayOnly?: boolean }
) {
  const today = new Date();
  return expenses
    .filter((e) =>
      opts?.todayOnly ? isSameDay(e.incurred_at, today) : true
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

export function sumEstimatedCogs(
  orders: Order[],
  opts?: { todayOnly?: boolean; deliveredOnly?: boolean }
) {
  const today = new Date();
  return orders
    .filter((o) =>
      opts?.deliveredOnly ? isDelivered(o.status) : isCountedSale(o.status)
    )
    .filter((o) => (opts?.todayOnly ? isSameDay(o.created_at, today) : true))
    .reduce((sum, o) => sum + estimateOrderCogs(o), 0);
}

export interface FinanceSnapshot {
  sales: number;
  manualExpenses: number;
  cogs: number;
  expenses: number;
  profit: number;
}

export function computeFinance(
  orders: Order[],
  expenses: Expense[],
  opts?: { todayOnly?: boolean }
): FinanceSnapshot {
  const sales = sumSales(orders, opts);
  const manualExpenses = sumManualExpenses(expenses, opts);
  const cogs = sumEstimatedCogs(orders, {
    todayOnly: opts?.todayOnly,
    deliveredOnly: true,
  });
  const totalExpenses = Math.round((manualExpenses + cogs) * 100) / 100;
  return {
    sales: Math.round(sales * 100) / 100,
    manualExpenses: Math.round(manualExpenses * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    expenses: totalExpenses,
    profit: Math.round((sales - totalExpenses) * 100) / 100,
  };
}

export interface SalesExpensePoint {
  day: string;
  sales: number;
  expenses: number;
}

export function salesVsExpensesOverTime(
  orders: Order[],
  expenses: Expense[],
  days = 7
): SalesExpensePoint[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const points: SalesExpensePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(new Date(now));
    day.setDate(now.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);

    const dayOrders = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return (
        t >= day.getTime() && t < next.getTime() && isCountedSale(o.status)
      );
    });
    const dayManual = expenses.filter((e) => {
      const t = new Date(e.incurred_at).getTime();
      return t >= day.getTime() && t < next.getTime();
    });
    const sales = dayOrders.reduce((s, o) => s + o.total, 0);
    const cogs = dayOrders
      .filter((o) => isDelivered(o.status))
      .reduce((s, o) => s + estimateOrderCogs(o), 0);
    const manual = dayManual.reduce((s, e) => s + e.amount, 0);

    points.push({
      day: labels[day.getDay()],
      sales: Math.round(sales * 100) / 100,
      expenses: Math.round((manual + cogs) * 100) / 100,
    });
  }

  return points;
}

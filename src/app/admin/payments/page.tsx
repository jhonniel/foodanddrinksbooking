"use client";

import { useMemo } from "react";
import { CreditCard } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  formatCurrency,
  formatDateTime,
  relativeTime,
} from "@/lib/utils/format";

export default function AdminPaymentsPage() {
  const orders = useAppStore((s) => s.orders);

  const transactions = useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .map((order) => ({
          id: order.id,
          orderNumber: order.order_number,
          customer: order.customer?.full_name ?? "Guest",
          method: order.payment_method,
          status: order.payment_status,
          amount: order.total,
          date: order.created_at,
        })),
    [orders]
  );

  const totals = useMemo(() => {
    const paid = transactions.filter((t) => t.status === "PAID");
    return {
      count: paid.length,
      revenue: paid.reduce((sum, t) => sum + t.amount, 0),
      pending: transactions.filter((t) => t.status === "PENDING").length,
    };
  }, [transactions]);

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Payment transactions from orders
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="mt-1 text-2xl font-bold text-green">
            {formatCurrency(totals.revenue)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Paid Transactions</p>
          <p className="mt-1 text-2xl font-bold text-navy">{totals.count}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-bold text-warning">{totals.pending}</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No transactions"
          description="Payment records will appear when orders are placed."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface text-left text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="px-5 py-3 font-medium text-navy">
                      #{tx.orderNumber}
                    </td>
                    <td className="px-5 py-3">{tx.customer}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-light-blue px-2 py-0.5 text-xs font-medium text-sky">
                        {tx.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span title={formatDateTime(tx.date)}>
                        {relativeTime(tx.date)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Wallet, TrendingUp, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

const EARNINGS = {
  today: 1240,
  deliveries: 8,
  tips: 180,
  weekly: 6840,
  breakdown: [
    { label: "Delivery fees", amount: 392 },
    { label: "Base pay", amount: 668 },
    { label: "Tips", amount: 180 },
  ],
};

export default function DriverEarningsPage() {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Your delivery income summary
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-gradient-to-br from-green to-fresh p-6 text-white shadow-soft">
        <div className="flex items-center gap-2 text-white/80">
          <Wallet className="h-5 w-5" />
          <span className="text-sm">Today&apos;s Earnings</span>
        </div>
        <p className="mt-2 text-4xl font-bold">
          {formatCurrency(EARNINGS.today)}
        </p>
        <div className="mt-4 flex gap-6 text-sm">
          <span>{EARNINGS.deliveries} deliveries</span>
          <span>{formatCurrency(EARNINGS.tips)} tips</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span className="text-xs">Deliveries</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-navy">
            {EARNINGS.deliveries}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">This Week</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green">
            {formatCurrency(EARNINGS.weekly)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-4 font-semibold text-navy">Today&apos;s Breakdown</h2>
        <ul className="space-y-3">
          {EARNINGS.breakdown.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium text-navy">
                {formatCurrency(item.amount)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between border-t pt-3 font-bold text-navy">
            <span>Total</span>
            <span>{formatCurrency(EARNINGS.today)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Wallet, TrendingUp, Package, History } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { filterDeliveriesForDriver } from "@/services/deliveryService";
import { formatCurrency, relativeTime } from "@/lib/utils/format";
import { Stagger, StaggerItem, Reveal } from "@/components/motion";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d = new Date()): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

/**
 * Driver wallet / earnings — only DELIVERED jobs count.
 * Assigned / accepted / in-transit orders do not add balance.
 */
export default function DriverEarningsPage() {
  const user = useAuthStore((s) => s.user);
  const deliveries = useAppStore((s) => s.deliveries);
  const orders = useAppStore((s) => s.orders);
  const drivers = useDataStore((s) => s.drivers);

  const driverRecord =
    drivers.find((d) => d.profile_id === user?.id || d.id === user?.id) ??
    null;

  const summary = useMemo(() => {
    const mine = filterDeliveriesForDriver({
      deliveries,
      orders,
      user,
      driverRecord,
    });

    const completed = mine.filter((d) => d.status === "DELIVERED");
    const inProgress = mine.filter(
      (d) => !["DELIVERED", "CANCELLED"].includes(d.status)
    );

    const dayStart = startOfLocalDay().getTime();
    const weekStart = startOfWeekMonday().getTime();

    const feeOf = (d: (typeof completed)[0]) => Number(d.delivery_fee ?? 0);
    const completedAt = (d: (typeof completed)[0]) =>
      new Date(d.delivered_at ?? d.updated_at).getTime();

    const todayCompleted = completed.filter(
      (d) => completedAt(d) >= dayStart
    );
    const weekCompleted = completed.filter(
      (d) => completedAt(d) >= weekStart
    );

    const today = todayCompleted.reduce((sum, d) => sum + feeOf(d), 0);
    const weekly = weekCompleted.reduce((sum, d) => sum + feeOf(d), 0);
    const lifetime = completed.reduce((sum, d) => sum + feeOf(d), 0);

    const transactions = [...completed]
      .sort((a, b) => completedAt(b) - completedAt(a))
      .map((d) => {
        const order =
          d.order ?? orders.find((o) => o.id === d.order_id) ?? null;
        return {
          id: d.id,
          orderNumber: order?.order_number ?? "—",
          amount: feeOf(d),
          at: d.delivered_at ?? d.updated_at,
        };
      });

    return {
      today,
      weekly,
      lifetime,
      todayCount: todayCompleted.length,
      inProgressCount: inProgress.length,
      transactions,
    };
  }, [deliveries, orders, user, driverRecord]);

  return (
    <div className="p-4">
      <Reveal className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Earnings after you complete a delivery
        </p>
      </Reveal>

      <Reveal className="mb-6 rounded-2xl bg-gradient-to-br from-green to-fresh p-6 text-white shadow-soft">
        <div className="flex items-center gap-2 text-white/80">
          <Wallet className="h-5 w-5" />
          <span className="text-sm">Available balance</span>
        </div>
        <p className="mt-2 text-4xl font-bold">
          <AnimatedNumber
            value={summary.lifetime}
            format={(n) => formatCurrency(Math.round(n))}
          />
        </p>
        <p className="mt-2 text-sm text-white/80">
          Only completed (delivered) jobs are counted
        </p>
      </Reveal>

      <Stagger className="mb-6 grid grid-cols-2 gap-3" fast>
        <StaggerItem>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-xs">Today</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-navy">
              {formatCurrency(summary.today)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.todayCount} completed
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">This week</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-green">
              {formatCurrency(summary.weekly)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.inProgressCount > 0
                ? `${summary.inProgressCount} in progress (not earned yet)`
                : "No active jobs"}
            </p>
          </div>
        </StaggerItem>
      </Stagger>

      <Reveal className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-sky" />
          <h2 className="font-semibold text-navy">Transactions</h2>
        </div>

        {summary.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions yet. Accept and complete a delivery to earn the
            delivery fee here.
          </p>
        ) : (
          <Stagger className="space-y-3" fast>
            {summary.transactions.map((tx) => (
              <StaggerItem key={tx.id}>
                <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-navy">
                      Delivery #{tx.orderNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(tx.at)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green">
                    +{formatCurrency(tx.amount)}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Reveal>
    </div>
  );
}

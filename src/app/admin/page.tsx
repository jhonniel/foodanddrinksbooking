"use client";

import {
  DollarSign,
  ShoppingBag,
  Users,
  Truck,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";
import { formatCurrency, relativeTime } from "@/lib/utils/format";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types";

const CHART_COLORS = [
  "#1FA7E1",
  "#176B3A",
  "#0B2A4A",
  "#2E8B57",
  "#D97706",
  "#94A3B8",
];

function buildWeeklySales(orders: { created_at: string; total: number }[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const points = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return {
      key: d.toDateString(),
      day: days[d.getDay()],
      sales: 0,
    };
  });
  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const order of orders) {
    const key = new Date(order.created_at).toDateString();
    const bucket = byKey.get(key);
    if (bucket) bucket.sales += order.total;
  }
  return points.map(({ day, sales }) => ({ day, sales }));
}

function buildTopDrinks(
  orders: {
    items?: { product_name: string; quantity: number; total_price: number }[];
  }[]
) {
  const map = new Map<string, { name: string; sold: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const cur = map.get(item.product_name) ?? {
        name: item.product_name,
        sold: 0,
        revenue: 0,
      };
      cur.sold += item.quantity;
      cur.revenue += item.total_price;
      map.set(item.product_name, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.sold - a.sold).slice(0, 5);
}

export default function AdminDashboardPage() {
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const inventory = useDataStore((s) => s.inventory);
  const customers = useDataStore((s) => s.customers);

  const todayOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const todaysSales = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = todayOrders.length;
  const customerCount = customers.filter((c) => c.role === "CUSTOMER").length;
  const pendingDeliveries = deliveries.filter(
    (d) => !["DELIVERED", "CANCELLED"].includes(d.status)
  ).length;

  const weeklySales = buildWeeklySales(orders);
  const topDrinks = buildTopDrinks(orders);

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: ORDER_STATUS_LABELS[status as OrderStatus] || status,
    value: count,
  }));

  const lowStock = inventory.filter(
    (item) => item.current_quantity < item.minimum_stock
  );

  const recentOrders = [...orders]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 6);

  return (
    <div className="p-3 sm:p-4 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-navy sm:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of today&apos;s store performance
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatsCard
          title="Today's Sales"
          value={formatCurrency(todaysSales)}
          numericValue={todaysSales}
          formatNumber={(n) => formatCurrency(Math.round(n))}
          icon={DollarSign}
        />
        <StatsCard
          title="Orders"
          value={String(orderCount)}
          numericValue={orderCount}
          icon={ShoppingBag}
        />
        <StatsCard
          title="Customers"
          value={String(customerCount)}
          numericValue={customerCount}
          icon={Users}
        />
        <StatsCard
          title="Pending Deliveries"
          value={String(pendingDeliveries)}
          numericValue={pendingDeliveries}
          icon={Truck}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-navy sm:text-lg">
            Sales Overview
          </h2>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(v) =>
                    v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#1FA7E1"
                  strokeWidth={2.5}
                  dot={{ fill: "#1FA7E1", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-navy">Order Status</h2>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No orders yet
            </p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pieData.map((item, i) => (
                  <span
                    key={item.name}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    {item.name} ({item.value})
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white shadow-card lg:col-span-2">
          <div className="border-b px-4 py-4 sm:px-5">
            <h2 className="text-base font-semibold text-navy sm:text-lg">
              Recent Orders
            </h2>
          </div>

          {recentOrders.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Orders will show up here as customers place them.
            </p>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-border/70 bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">
                          #{order.order_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order.customer?.full_name ?? "Guest"}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-green">
                        {formatCurrency(order.total)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(order.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Order</th>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-5 py-3 font-medium text-navy">
                          #{order.order_number}
                        </td>
                        <td className="px-5 py-3">
                          {order.customer?.full_name ?? "Guest"}
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {relativeTime(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-navy">
              Top Selling Drinks
            </h2>
            {topDrinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales data yet</p>
            ) : (
              <ul className="space-y-3">
                {topDrinks.map((drink, i) => (
                  <li key={drink.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-light-blue text-xs font-bold text-sky">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">
                        {drink.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {drink.sold} sold · {formatCurrency(drink.revenue)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h2 className="text-lg font-semibold text-navy">Low Inventory</h2>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All stock levels OK</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-navy">{item.name}</span>
                    <span className="text-red-600">
                      {item.current_quantity} / {item.minimum_stock} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

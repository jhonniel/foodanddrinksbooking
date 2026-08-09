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
} from "recharts";
import { useAppStore } from "@/stores/app";
import { StatsCard } from "@/components/shared/StatsCard";
import {
  computeAnalytics,
  salesOverTime,
  topProducts,
  revenueByCategory,
} from "@/services/analyticsService";
import { formatCurrency } from "@/lib/utils/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  ShoppingBag,
  RotateCcw,
  Truck,
  Gift,
  Users,
} from "lucide-react";

const PIE_COLORS = ["#1FA7E1", "#176B3A", "#0B2A4A", "#2E8B57", "#94a3b8"];

export default function AdminReportsPage() {
  const orders = useAppStore((s) => s.orders);
  const [range, setRange] = useState("7d");

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const summary = useMemo(() => computeAnalytics(orders), [orders]);
  const sales = useMemo(() => salesOverTime(orders, Math.min(days, 14)), [orders, days]);
  const products = useMemo(() => topProducts(orders, 6), [orders]);
  const categories = useMemo(() => revenueByCategory(orders), [orders]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Sales, products, loyalty, and delivery performance
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
          value={formatCurrency(summary.totalSales)}
          icon={DollarSign}
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Sales Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#1FA7E1"
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

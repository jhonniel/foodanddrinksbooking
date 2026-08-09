import type { Order, OrderStatus } from "@/types";
import { useDataStore } from "@/stores/data";
import { formatCurrency } from "@/lib/utils/format";

export interface SalesPoint {
  label: string;
  sales: number;
  orders: number;
}

export interface ProductPerf {
  name: string;
  qty: number;
  revenue: number;
}

export interface CategoryRevenue {
  name: string;
  revenue: number;
}

export interface AnalyticsSummary {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pointsIssued: number;
  pointsRedeemed: number;
  repeatCustomers: number;
  deliveryCompletionRate: number;
}

function isDelivered(status: OrderStatus) {
  return status === "DELIVERED";
}

export function computeAnalytics(orders: Order[]): AnalyticsSummary {
  const delivered = orders.filter((o) => isDelivered(o.status));
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  const totalSales = delivered.reduce((s, o) => s + o.total, 0);
  const pointsIssued = delivered.reduce((s, o) => s + o.points_earned, 0);
  const pointsRedeemed = orders.reduce((s, o) => s + o.points_used, 0);

  const customerOrderCounts = new Map<string, number>();
  for (const o of orders) {
    customerOrderCounts.set(
      o.customer_id,
      (customerOrderCounts.get(o.customer_id) || 0) + 1
    );
  }
  const repeatCustomers = [...customerOrderCounts.values()].filter((c) => c > 1).length;

  const deliveryOrders = orders.filter((o) => o.order_type === "DELIVERY");
  const deliveryCompleted = deliveryOrders.filter((o) => isDelivered(o.status)).length;

  return {
    totalSales,
    totalOrders: orders.length,
    averageOrderValue:
      delivered.length > 0 ? Math.round(totalSales / delivered.length) : 0,
    deliveredOrders: delivered.length,
    cancelledOrders: cancelled.length,
    pointsIssued,
    pointsRedeemed,
    repeatCustomers,
    deliveryCompletionRate:
      deliveryOrders.length > 0
        ? Math.round((deliveryCompleted / deliveryOrders.length) * 100)
        : 0,
  };
}

export function salesOverTime(orders: Order[], days = 7): SalesPoint[] {
  const points: SalesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const dayOrders = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= day.getTime() && t < next.getTime() && o.status !== "CANCELLED";
    });

    points.push({
      label: day.toLocaleDateString("en-PH", { weekday: "short" }),
      sales: dayOrders.reduce((s, o) => s + o.total, 0),
      orders: dayOrders.length,
    });
  }
  return points;
}

export function topProducts(orders: Order[], limit = 5): ProductPerf[] {
  const map = new Map<string, ProductPerf>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items || []) {
      const existing = map.get(item.product_name) || {
        name: item.product_name,
        qty: 0,
        revenue: 0,
      };
      existing.qty += item.quantity;
      existing.revenue += item.total_price;
      map.set(item.product_name, existing);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function revenueByCategory(orders: Order[]): CategoryRevenue[] {
  const { products, categories } = useDataStore.getState();
  const map = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items || []) {
      const product = products.find((p) => p.id === item.product_id);
      const catName =
        categories.find((c) => c.id === product?.category_id)?.name || "Other";
      map.set(catName, (map.get(catName) || 0) + item.total_price);
    }
  }
  return [...map.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function formatMetric(value: number, type: "currency" | "number" | "percent" = "number") {
  if (type === "currency") return formatCurrency(value);
  if (type === "percent") return `${value}%`;
  return value.toLocaleString("en-PH");
}

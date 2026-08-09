import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import {
  computeAnalytics,
  salesOverTime,
  topProducts,
  revenueByCategory,
} from "@/services/analyticsService";
import type { Order } from "@/types";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`analytics:${ip}`, 30, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") || 7), 90);

  // Production: query Supabase orders with date filters + RLS.
  const orders: Order[] = [];
  const summary = computeAnalytics(orders);

  return NextResponse.json({
    summary,
    sales: salesOverTime(orders, days),
    topProducts: topProducts(orders),
    categories: revenueByCategory(orders),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import { checkoutSchema } from "@/schemas";
import { placeOrder } from "@/services/orderService";
import {
  getSessionProfileFromRequest,
  assertRole,
} from "@/lib/auth/server";
import { canAccessAdmin } from "@/lib/auth/config";
import {
  getOrdersSnapshot,
  nextOrderNumber,
  saveOrder,
} from "@/lib/orders/localFileStore";
import type { CartItem } from "@/types";

const orderApiSchema = checkoutSchema.and(
  z.object({
    customerId: z.string().min(1).optional(),
    customerName: z.string().min(1).optional(),
    items: z
      .array(
        z.object({
          id: z.string(),
          productId: z.string(),
          productName: z.string(),
          productImage: z.string().nullable(),
          basePrice: z.number().nonnegative(),
          quantity: z.number().int().positive(),
          options: z.array(
            z.object({
              optionId: z.string(),
              optionName: z.string(),
              valueId: z.string(),
              valueName: z.string(),
              priceAdjustment: z.number(),
            })
          ),
          addons: z.array(
            z.object({
              addonId: z.string(),
              name: z.string(),
              price: z.number(),
              quantity: z.number().int().positive(),
            })
          ),
          specialInstructions: z.string().optional(),
        })
      )
      .min(1, "Cart cannot be empty"),
    deliveryFee: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
    discount: z.number().nonnegative().default(0),
    pointsDiscount: z.number().nonnegative().default(0),
    pointsUsed: z.number().int().nonnegative().default(0),
    promoCode: z.string().nullable().optional(),
    idempotencyKey: z.string().min(8).optional(),
  })
);

export async function GET(request: NextRequest) {
  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orders, deliveries } = await getOrdersSnapshot();
  const isStaff = canAccessAdmin(profile.role);

  if (isStaff) {
    return NextResponse.json({ orders, deliveries });
  }

  return NextResponse.json({
    orders: orders.filter((o) => o.customer_id === profile.id),
    deliveries: deliveries.filter((d) =>
      orders.some(
        (o) => o.id === d.order_id && o.customer_id === profile.id
      )
    ),
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = rateLimit(`orders:${ip}`, 10, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many order attempts. Please wait a moment." },
      { status: 429 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = orderApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const orderNumber = await nextOrderNumber();

  const result = await placeOrder({
    customerId: profile.id,
    customerName: profile.full_name,
    customer: profile,
    items: data.items as CartItem[],
    orderType: data.orderType,
    paymentMethod: data.paymentMethod,
    address:
      data.orderType === "DELIVERY"
        ? {
            full_address: data.fullAddress || "Address on file",
            latitude: data.latitude,
            longitude: data.longitude,
            delivery_instructions: data.deliveryInstructions,
          }
        : null,
    deliveryInstructions: data.deliveryInstructions,
    deliveryFee: data.deliveryFee,
    subtotal: data.subtotal,
    discount: data.discount,
    pointsDiscount: data.pointsDiscount,
    pointsUsed: data.pointsUsed,
    promoCode: data.promoCode,
    idempotencyKey: data.idempotencyKey,
    orderNumber,
  });

  if (!result.success || !result.order) {
    return NextResponse.json(
      { error: result.error || "Failed to place order." },
      { status: 400 }
    );
  }

  const saved = await saveOrder(result.order);
  return NextResponse.json({ order: saved }, { status: 201 });
}

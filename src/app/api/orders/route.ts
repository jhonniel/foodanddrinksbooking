import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/security/rateLimit";
import { placeOrder } from "@/services/orderService";
import {
  getSessionProfileFromRequest,
  assertRole,
} from "@/lib/auth/server";
import { canAccessAdmin, isSupabaseConfigured } from "@/lib/auth/config";
import {
  getOrdersSnapshot,
  nextOrderNumber,
  saveOrder,
} from "@/lib/orders/localFileStore";
import {
  createOrderInSupabase,
  fetchOrdersFromSupabase,
} from "@/lib/supabase/orders";
import type { CartItem, PaymentMethod, OrderType } from "@/types";

const num = z.coerce.number().finite();
const nonNeg = num.refine((n) => n >= 0, "Must be >= 0");
const posInt = z.coerce.number().int().positive();

const cartOptionSchema = z
  .object({
    optionId: z.string().min(1),
    optionName: z.string().min(1),
    valueId: z.string().min(1),
    valueName: z.string().min(1),
    priceAdjustment: nonNeg.optional().default(0),
  })
  .passthrough();

const cartAddonSchema = z
  .object({
    addonId: z.string().min(1),
    name: z.string().min(1),
    price: nonNeg.optional().default(0),
    quantity: posInt.optional().default(1),
  })
  .passthrough();

const cartItemSchema = z
  .object({
    id: z.string().min(1),
    productId: z.string().min(1),
    productName: z.string().min(1),
    productImage: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (typeof v === "string" ? v : null)),
    basePrice: nonNeg,
    quantity: posInt,
    options: z.array(cartOptionSchema).optional().default([]),
    addons: z.array(cartAddonSchema).optional().default([]),
    specialInstructions: z.string().optional(),
  })
  .passthrough();

const orderApiSchema = z
  .object({
    orderType: z.enum(["DELIVERY", "PICKUP"]),
    paymentMethod: z.enum(["COD", "GCASH", "CARD", "ONLINE"]),
    addressId: z.string().optional(),
    fullAddress: z.string().optional().nullable(),
    deliveryInstructions: z.string().max(500).optional().nullable(),
    latitude: num.optional().nullable(),
    longitude: num.optional().nullable(),
    items: z.array(cartItemSchema).min(1, "Cart cannot be empty"),
    deliveryFee: nonNeg,
    subtotal: nonNeg,
    discount: nonNeg.optional().default(0),
    pointsDiscount: nonNeg.optional().default(0),
    pointsUsed: z.coerce.number().int().nonnegative().optional().default(0),
    promoCode: z.string().nullable().optional(),
    idempotencyKey: z.string().min(8).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.orderType === "DELIVERY" &&
      !data.addressId &&
      !data.fullAddress
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Please select or enter a delivery address",
        path: ["addressId"],
      });
    }
  });

function firstValidationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Validation failed.";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

function toCartItems(
  items: z.infer<typeof orderApiSchema>["items"]
): CartItem[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage,
    basePrice: item.basePrice,
    quantity: item.quantity,
    options: (item.options ?? []).map((o) => ({
      optionId: o.optionId,
      optionName: o.optionName,
      valueId: o.valueId,
      valueName: o.valueName,
      priceAdjustment: o.priceAdjustment ?? 0,
    })),
    addons: (item.addons ?? []).map((a) => ({
      addonId: a.addonId,
      name: a.name,
      price: a.price ?? 0,
      quantity: a.quantity ?? 1,
    })),
    specialInstructions: item.specialInstructions,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const profile = await getSessionProfileFromRequest(request);
    if (!assertRole(profile, "authenticated")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isStaff = canAccessAdmin(profile.role);

    if (isSupabaseConfigured()) {
      const snapshot = await fetchOrdersFromSupabase(
        isStaff ? undefined : { customerId: profile.id }
      );
      if (!snapshot) {
        return NextResponse.json(
          {
            error:
              "Could not load orders from Supabase. Check service role key and that bootstrap.sql was run.",
            orders: [],
            deliveries: [],
            autoCancelled: [],
          },
          { status: 502 }
        );
      }
      return NextResponse.json(snapshot);
    }

    const { orders, deliveries, autoCancelled } = await getOrdersSnapshot();

    if (isStaff) {
      return NextResponse.json({ orders, deliveries, autoCancelled });
    }

    return NextResponse.json({
      orders: orders.filter((o) => o.customer_id === profile.id),
      deliveries: deliveries.filter((d) =>
        orders.some(
          (o) => o.id === d.order_id && o.customer_id === profile.id
        )
      ),
      autoCancelled: autoCancelled.filter((o) => o.customer_id === profile.id),
    });
  } catch (err) {
    console.error("GET /api/orders failed:", err);
    return NextResponse.json(
      {
        error: "Failed to read orders store.",
        orders: [],
        deliveries: [],
        autoCancelled: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = rateLimit(`orders:${ip}`, 60, 60_000);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many order attempts. Please wait a moment." },
      { status: 429 }
    );
  }

  const profile = await getSessionProfileFromRequest(request);
  if (!assertRole(profile, "authenticated")) {
    return NextResponse.json(
      { error: "Please sign in to place an order." },
      { status: 401 }
    );
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
        error: firstValidationMessage(parsed.error),
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const items = toCartItems(data.items);
  const address =
    data.orderType === "DELIVERY"
      ? {
          full_address: data.fullAddress || "Address on file",
          latitude: data.latitude ?? undefined,
          longitude: data.longitude ?? undefined,
          delivery_instructions: data.deliveryInstructions || undefined,
        }
      : null;

  if (isSupabaseConfigured()) {
    const created = await createOrderInSupabase({
      customer: profile,
      items,
      orderType: data.orderType as OrderType,
      paymentMethod: data.paymentMethod as PaymentMethod,
      address,
      deliveryInstructions: data.deliveryInstructions || undefined,
      deliveryFee: data.deliveryFee,
      subtotal: data.subtotal,
      discount: data.discount,
      pointsDiscount: data.pointsDiscount,
      pointsUsed: data.pointsUsed,
      idempotencyKey: data.idempotencyKey,
    });

    if (!created.order) {
      return NextResponse.json(
        { error: created.error || "Failed to place order in Supabase." },
        { status: 400 }
      );
    }
    return NextResponse.json({ order: created.order }, { status: 201 });
  }

  const orderNumber = await nextOrderNumber();
  const result = await placeOrder({
    customerId: profile.id,
    customerName: profile.full_name,
    customer: profile,
    items,
    orderType: data.orderType as OrderType,
    paymentMethod: data.paymentMethod as PaymentMethod,
    address,
    deliveryInstructions: data.deliveryInstructions || undefined,
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

  try {
    const saved = await saveOrder(result.order);
    return NextResponse.json({ order: saved }, { status: 201 });
  } catch (err) {
    console.error("Failed to persist order; returning order anyway:", err);
    return NextResponse.json({ order: result.order }, { status: 201 });
  }
}

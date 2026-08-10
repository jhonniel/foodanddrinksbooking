import type {
  CartItem,
  Order,
  OrderItem,
  PaymentMethod,
  OrderType,
  AddressSnapshot,
  Profile,
} from "@/types";
import { getCartItemPrice } from "@/stores/cart";
import { processPayment } from "@/lib/payments/provider";
import { generateIdempotencyKey, generateDeliveryPin } from "@/lib/utils/format";
import { LOYALTY_SETTINGS } from "@/data/demo";

export interface PlaceOrderInput {
  customerId: string;
  customerName: string;
  customer?: Profile | null;
  items: CartItem[];
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  address?: AddressSnapshot | null;
  deliveryInstructions?: string;
  deliveryFee: number;
  subtotal: number;
  discount: number;
  pointsDiscount: number;
  pointsUsed: number;
  promoCode?: string | null;
  idempotencyKey?: string;
  /** When provided (server), use persisted sequence instead of in-memory counter. */
  orderNumber?: string;
}

export interface PlaceOrderResult {
  success: boolean;
  order?: Order;
  error?: string;
}

let orderSeq = 10255;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  try {
    if (!input.items.length) {
      return { success: false, error: "Your cart is empty." };
    }

    const idempotencyKey = input.idempotencyKey || generateIdempotencyKey();
    const total = Math.max(
      0,
      input.subtotal + input.deliveryFee - input.discount - input.pointsDiscount
    );

    const payment = await processPayment({
      orderId: "pending",
      amount: total,
      method: input.paymentMethod,
      customerId: input.customerId,
      idempotencyKey: `pay_${idempotencyKey}`,
    });

    if (!payment.success) {
      return { success: false, error: payment.message || "Payment failed." };
    }

    const orderId = `ord-${Date.now()}`;
    const orderNumber = input.orderNumber || `IC${orderSeq++}`;
    const now = new Date().toISOString();
    const pointsEarned = Math.floor(total * LOYALTY_SETTINGS.points_per_peso);

    const items: OrderItem[] = input.items.map((item, idx) => ({
      id: `${orderId}-item-${idx}`,
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      product_image_url: item.productImage,
      quantity: item.quantity,
      unit_price: getCartItemPrice(item) / item.quantity,
      total_price: getCartItemPrice(item),
      special_instructions: item.specialInstructions || null,
      options: item.options.map((o, oi) => ({
        id: `${orderId}-opt-${idx}-${oi}`,
        order_item_id: `${orderId}-item-${idx}`,
        option_name: o.optionName,
        value_name: o.valueName,
        price_adjustment: o.priceAdjustment,
      })),
      addons: item.addons.map((a, ai) => ({
        id: `${orderId}-addon-${idx}-${ai}`,
        order_item_id: `${orderId}-item-${idx}`,
        addon_name: a.name,
        price: a.price,
        quantity: a.quantity,
      })),
    }));

    const order: Order = {
      id: orderId,
      order_number: orderNumber,
      customer_id: input.customerId,
      status: "PENDING",
      order_type: input.orderType,
      subtotal: input.subtotal,
      delivery_fee: input.deliveryFee,
      discount: input.discount,
      points_discount: input.pointsDiscount,
      tax: 0,
      total,
      payment_status: payment.status,
      payment_method: input.paymentMethod,
      delivery_address_id: null,
      delivery_address_snapshot: input.address || null,
      delivery_instructions: input.deliveryInstructions || null,
      driver_id: null,
      promotion_id: null,
      points_earned: pointsEarned,
      points_used: input.pointsUsed,
      estimated_prep_minutes: 15,
      notes: null,
      cancelled_reason: null,
      confirmed_at: null,
      preparing_at: null,
      ready_at: null,
      delivered_at: null,
      cancelled_at: null,
      created_at: now,
      updated_at: now,
      items,
      customer:
        input.customer ||
        ({
          id: input.customerId,
          email: "",
          full_name: input.customerName,
          phone: null,
          avatar_url: null,
          role: "CUSTOMER",
          is_active: true,
          points_balance: 0,
          lifetime_points: 0,
          created_at: now,
          updated_at: now,
        } satisfies Profile),
    };

    // Attach delivery PIN for delivery orders (stored conceptually)
    if (input.orderType === "DELIVERY") {
      void generateDeliveryPin();
    }

    return { success: true, order };
  } catch {
    return { success: false, error: "Something went wrong placing your order. Please try again." };
  }
}

import type { PaymentMethod, PaymentStatus } from "@/types";

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  customerId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  provider: string;
  status: PaymentStatus;
  message?: string;
  redirectUrl?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<PaymentResult>;
  refundPayment(transactionId: string, amount?: number): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string): Promise<PaymentStatus>;
}

/** Cash on Delivery — marks as pending until delivered */
export class CodPaymentProvider implements PaymentProvider {
  readonly name = "cod";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: `cod_${input.idempotencyKey}`,
      provider: this.name,
      status: "PENDING",
      message: "Pay with cash upon delivery",
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      provider: this.name,
      status: "PAID",
    };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      provider: this.name,
      status: "REFUNDED",
    };
  }

  async getPaymentStatus(): Promise<PaymentStatus> {
    return "PENDING";
  }
}

/** GCash stub — ready for real API integration */
export class GCashPaymentProvider implements PaymentProvider {
  readonly name = "gcash";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // In production: call GCash/PayMongo/Maya API
    await delay(800);
    return {
      success: true,
      transactionId: `gcash_${input.idempotencyKey}`,
      provider: this.name,
      status: "PAID",
      message: "GCash payment simulated successfully",
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      provider: this.name,
      status: "PAID",
    };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      provider: this.name,
      status: "REFUNDED",
    };
  }

  async getPaymentStatus(): Promise<PaymentStatus> {
    return "PAID";
  }
}

/** Card payment stub */
export class CardPaymentProvider implements PaymentProvider {
  readonly name = "card";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    await delay(1000);
    return {
      success: true,
      transactionId: `card_${input.idempotencyKey}`,
      provider: this.name,
      status: "PAID",
      message: "Card payment simulated successfully",
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return { success: true, transactionId, provider: this.name, status: "PAID" };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    return { success: true, transactionId, provider: this.name, status: "REFUNDED" };
  }

  async getPaymentStatus(): Promise<PaymentStatus> {
    return "PAID";
  }
}

/** Online payment gateway stub */
export class OnlinePaymentProvider implements PaymentProvider {
  readonly name = "online";

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    await delay(900);
    return {
      success: true,
      transactionId: `online_${input.idempotencyKey}`,
      provider: this.name,
      status: "PAID",
      message: "Online payment simulated successfully",
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return { success: true, transactionId, provider: this.name, status: "PAID" };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    return { success: true, transactionId, provider: this.name, status: "REFUNDED" };
  }

  async getPaymentStatus(): Promise<PaymentStatus> {
    return "PAID";
  }
}

const providers: Record<PaymentMethod, PaymentProvider> = {
  COD: new CodPaymentProvider(),
  GCASH: new GCashPaymentProvider(),
  CARD: new CardPaymentProvider(),
  ONLINE: new OnlinePaymentProvider(),
};

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  return providers[method];
}

export async function processPayment(
  input: CreatePaymentInput
): Promise<PaymentResult> {
  const provider = getPaymentProvider(input.method);
  return provider.createPayment(input);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

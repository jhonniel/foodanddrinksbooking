"use client";

import Image from "next/image";
import { formatCurrency } from "@/lib/utils/format";

const QRPH_PAYMENT_QR_SRC = "/qrph-payment.jpg";

type QRPhPaymentPanelProps = {
  amount?: number;
  className?: string;
};

export function QRPhPaymentPanel({ amount, className }: QRPhPaymentPanelProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-white p-4 text-center shadow-card ${className ?? ""}`}
    >
      <div className="mx-auto w-fit overflow-hidden rounded-xl bg-white p-2">
        <Image
          src={QRPH_PAYMENT_QR_SRC}
          alt="QR Ph payment code"
          width={240}
          height={240}
          className="h-auto w-full max-w-[240px] rounded-lg"
          priority
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-navy">Scan to pay with QR Ph</p>
      {amount != null && (
        <p className="mt-1 text-lg font-bold text-green">{formatCurrency(amount)}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Open your bank or e-wallet app, scan this QR code, then confirm your
        payment.
      </p>
    </div>
  );
}

export { QRPH_PAYMENT_QR_SRC };

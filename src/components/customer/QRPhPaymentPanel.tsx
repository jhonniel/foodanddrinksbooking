"use client";

import { useRef } from "react";
import Image from "next/image";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const QRPH_PAYMENT_QR_SRC = "/qrph-payment.jpg";

type QRPhPaymentPanelProps = {
  amount?: number;
  className?: string;
  proofPreviewUrl?: string | null;
  onProofFileSelect?: (file: File) => void;
  uploadingProof?: boolean;
  readOnly?: boolean;
  /** When false, only show the QR code (e.g. payment method step). */
  showProofUpload?: boolean;
};

export function QRPhPaymentPanel({
  amount,
  className,
  proofPreviewUrl,
  onProofFileSelect,
  uploadingProof = false,
  readOnly = false,
  showProofUpload = true,
}: QRPhPaymentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        Open your bank or e-wallet app, scan this QR code, pay the exact amount
        {showProofUpload
          ? ", then upload your payment screenshot below."
          : ". You'll upload proof on the next step."}
      </p>

      {showProofUpload ? (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-left">
        <Label htmlFor="qrph-proof" className="text-sm font-semibold text-navy">
          Proof of payment *
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upload a screenshot of your successful QR Ph transfer.
        </p>

        {readOnly ? (
          proofPreviewUrl ? (
            <div className="mt-3 space-y-2">
              <div className="relative mx-auto max-h-48 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofPreviewUrl}
                  alt="Payment proof"
                  className="mx-auto max-h-48 w-full object-contain"
                />
              </div>
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-green">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Payment proof attached
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-destructive">
              Payment proof is required before placing the order.
            </p>
          )
        ) : (
          <div className="mt-3 space-y-2">
            <input
              ref={fileInputRef}
              id="qrph-proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploadingProof}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onProofFileSelect?.(file);
                e.target.value = "";
              }}
            />
            {proofPreviewUrl ? (
              <div className="relative mx-auto max-h-48 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofPreviewUrl}
                  alt="Payment proof preview"
                  className="mx-auto max-h-48 w-full object-contain"
                />
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              disabled={uploadingProof}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingProof ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : proofPreviewUrl ? (
                "Replace screenshot"
              ) : (
                <>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload screenshot
                </>
              )}
            </Button>
            {proofPreviewUrl ? (
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-green">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready — you can continue checkout
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Required to place your order
              </p>
            )}
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}

export { QRPH_PAYMENT_QR_SRC };

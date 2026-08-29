"use client";

import { Banknote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/format";

type CodCashPanelProps = {
  total: number;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  cashAmount?: number | null;
  className?: string;
};

export function parseCodCashInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function validateCodCashAmount(
  raw: string,
  total: number
): { ok: true; amount: number } | { ok: false; message: string } {
  const amount = parseCodCashInput(raw);
  if (amount == null) {
    return { ok: false, message: "Enter how much cash you'll pay with." };
  }
  if (amount < total) {
    return {
      ok: false,
      message: `Cash amount must be at least ${formatCurrency(total)}.`,
    };
  }
  return { ok: true, amount };
}

export function CodCashPanel({
  total,
  value,
  onChange,
  readOnly = false,
  cashAmount,
  className,
}: CodCashPanelProps) {
  const parsed = readOnly
    ? cashAmount ?? null
    : parseCodCashInput(value);
  const change =
    parsed != null && parsed >= total ? Math.round((parsed - total) * 100) / 100 : null;

  if (readOnly && parsed == null) return null;

  return (
    <div
      className={`rounded-2xl border border-border bg-white p-4 shadow-card ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 text-navy">
        <Banknote className="h-5 w-5 text-sky" />
        <h3 className="font-semibold">Cash payment</h3>
      </div>

      {readOnly ? (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order total</span>
            <span className="font-medium text-navy">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paying with</span>
            <span className="font-medium text-navy">
              {formatCurrency(parsed!)}
            </span>
          </div>
          {change != null && change > 0 && (
            <div className="flex justify-between rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-900">
              <span>Change to prepare</span>
              <span>{formatCurrency(change)}</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us how much cash you&apos;ll hand the driver so they can prepare
            your change.
          </p>
          <div className="mt-3">
            <Label htmlFor="cod-cash-amount">Amount you will pay with</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₱
              </span>
              <Input
                id="cod-cash-amount"
                type="number"
                inputMode="decimal"
                min={total}
                step="0.01"
                placeholder={String(Math.ceil(total))}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-12 pl-8 text-base"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Minimum: {formatCurrency(total)}
            </p>
          </div>
          {change != null && change > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Estimated change:{" "}
              <span className="font-semibold">{formatCurrency(change)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

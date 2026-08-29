"use client";

import { Store } from "lucide-react";
import { useStoreSettings } from "@/hooks/useStoreSettings";

type StoreClosedNoticeProps = {
  variant?: "banner" | "panel";
};

export function StoreClosedNotice({ variant = "banner" }: StoreClosedNoticeProps) {
  const { storeOpen, storeClosedMessage, loading, storeHours } =
    useStoreSettings();

  if (loading || storeOpen || !storeHours.enabled) return null;

  if (variant === "panel") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-navy/20 bg-navy/5 px-4 py-4"
      >
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
          <div>
            <p className="font-semibold text-navy">Store closed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {storeClosedMessage}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You can browse the menu now. Checkout opens during store hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-navy/15 bg-navy/5 px-4 py-3 text-sm text-navy"
    >
      <Store className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
      <p>{storeClosedMessage}</p>
    </div>
  );
}

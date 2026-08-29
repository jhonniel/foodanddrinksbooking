"use client";

import { Clock } from "lucide-react";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { PURCHASE_SOON_MESSAGE } from "@/lib/settings/types";

export function PurchaseSoonBanner() {
  const { purchaseSoon, loading } = useStoreSettings();

  if (loading || !purchaseSoon) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <p>{PURCHASE_SOON_MESSAGE}</p>
    </div>
  );
}

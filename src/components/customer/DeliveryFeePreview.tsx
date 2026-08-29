"use client";

import { useMemo } from "react";
import { Truck } from "lucide-react";
import {
  calculateDeliveryFee,
  formatDeliveryRateLabel,
  formatDistanceKm,
  type LatLng,
} from "@/lib/delivery/pricing";
import { isWithinSamalIsland, SAMAL_SERVICE_MESSAGE } from "@/lib/delivery/samal";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { formatCurrency } from "@/lib/utils/format";

type DeliveryFeePreviewProps = {
  pin: LatLng | null;
  subtotal?: number;
  className?: string;
};

export function DeliveryFeePreview({
  pin,
  subtotal = 0,
  className,
}: DeliveryFeePreviewProps) {
  const { store, delivery, loading } = useStoreSettings();

  const quote = useMemo(() => {
    if (!pin) return null;
    return calculateDeliveryFee(pin, subtotal, delivery, store);
  }, [pin, subtotal, delivery, store]);

  if (loading || !pin || !quote) return null;

  if (!isWithinSamalIsland(pin.lat, pin.lng) || !quote.withinRadius) {
    return (
      <div
        className={`rounded-xl border border-destructive/30 bg-red-50 px-3 py-2.5 text-sm text-destructive ${className ?? ""}`}
      >
        {SAMAL_SERVICE_MESSAGE}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-sky/20 bg-sky/5 px-3 py-2.5 text-sm ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 font-semibold text-navy">
        <Truck className="h-4 w-4 text-sky" />
        Delivery estimate
      </div>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <div className="flex justify-between">
          <span>Distance from store</span>
          <span className="font-medium text-navy">
            {formatDistanceKm(quote.distanceKm)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Delivery fee</span>
          <span className="font-semibold text-green">
            {quote.isFree ? "Free" : formatCurrency(quote.fee)}
          </span>
        </div>
        {quote.breakdown.succeedingKm > 0 && (
          <p className="text-xs">
            ₱{delivery.baseFee} first {delivery.baseKm} km + ₱
            {delivery.perKmFee}/km × {quote.breakdown.succeedingKm} km
          </p>
        )}
        <p className="text-[11px]">{formatDeliveryRateLabel(delivery)}</p>
      </div>
    </div>
  );
}

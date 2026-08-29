"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationPinMap } from "@/components/customer/LocationPinMap";
import { DeliveryFeePreview } from "@/components/customer/DeliveryFeePreview";
import { useCartStore } from "@/stores/cart";
import { useCartTotals } from "@/hooks/useCartTotals";
import type { LatLng } from "@/lib/delivery/pricing";
import {
  isWithinSamalIsland,
  SAMAL_MAP_CENTER,
  SAMAL_SERVICE_MESSAGE,
} from "@/lib/delivery/samal";

const SESSION_KEY = "island-coolers-delivery-location-asked";

export function DeliveryLocationGate() {
  const deliveryLocation = useCartStore((s) => s.deliveryLocation);
  const setDeliveryLocation = useCartStore((s) => s.setDeliveryLocation);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const { subtotal } = useCartTotals();

  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState<LatLng>(
    deliveryLocation ?? SAMAL_MAP_CENTER
  );

  useEffect(() => {
    try {
      const asked = sessionStorage.getItem(SESSION_KEY) === "1";
      const ok =
        deliveryLocation &&
        isWithinSamalIsland(deliveryLocation.lat, deliveryLocation.lng);
      if (!asked && !ok) {
        setOpen(true);
        setPin(deliveryLocation ?? SAMAL_MAP_CENTER);
      }
    } catch {
      setOpen(true);
    }
  }, [deliveryLocation]);

  const markAsked = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const confirmDeliveryPin = () => {
    if (!isWithinSamalIsland(pin.lat, pin.lng)) {
      toast.error(SAMAL_SERVICE_MESSAGE);
      return;
    }
    setDeliveryLocation(pin, "Pinned location");
    setOrderType("DELIVERY");
    markAsked();
    setOpen(false);
    toast.success("Delivery location set for Samal Island.");
  };

  const continuePickup = () => {
    setOrderType("PICKUP");
    markAsked();
    setOpen(false);
    toast.message("Pickup selected. You can set a delivery pin later.");
  };

  return (
    <Dialog open={open}>
      <DialogContent scrollable showCloseButton={false} className="sm:max-w-lg">
        <DialogStickyHeader>
          <DialogTitle className="flex items-center gap-2 text-navy">
            <MapPin className="h-5 w-5 text-sky" />
            Where should we deliver?
          </DialogTitle>
          <DialogDescription>
            We only deliver within Samal Island. Share your location or pin it
            on the map.
          </DialogDescription>
        </DialogStickyHeader>

        <DialogScrollBody className="space-y-4">
          <LocationPinMap
            value={pin}
            onChange={setPin}
            autoLocateOnMount
            heightClassName="h-56"
          />
          <DeliveryFeePreview pin={pin} subtotal={subtotal} />
        </DialogScrollBody>

        <DialogStickyFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={continuePickup}
          >
            I&apos;ll pick up instead
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-green hover:bg-green/90"
            onClick={confirmDeliveryPin}
            disabled={!isWithinSamalIsland(pin.lat, pin.lng)}
          >
            Confirm delivery pin
          </Button>
        </DialogStickyFooter>
      </DialogContent>
    </Dialog>
  );
}

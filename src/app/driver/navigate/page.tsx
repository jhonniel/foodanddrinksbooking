"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation, MapPin } from "lucide-react";
import { useAppStore } from "@/stores/app";
import { Button } from "@/components/ui/button";
import { getMapProvider, openExternalNavigation } from "@/lib/maps/provider";
import { STORE_LOCATION } from "@/data/demo";
import { EmptyState } from "@/components/shared/EmptyState";

function NavigateContent() {
  const searchParams = useSearchParams();
  const deliveryId = searchParams.get("id");
  const deliveries = useAppStore((s) => s.deliveries);
  const updateDeliveryStatus = useAppStore((s) => s.updateDeliveryStatus);

  const delivery = deliveryId
    ? deliveries.find((d) => d.id === deliveryId)
    : deliveries.find(
        (d) => !["DELIVERED", "CANCELLED"].includes(d.status)
      );

  if (!delivery) {
    return (
      <EmptyState
        icon={MapPin}
        title="No delivery selected"
        description="Select an active delivery to navigate."
      />
    );
  }

  const mapProvider = getMapProvider();
  const center = {
    lat: delivery.customer_latitude ?? STORE_LOCATION.lat,
    lng: delivery.customer_longitude ?? STORE_LOCATION.lng,
  };

  const handleNavigate = () => {
    openExternalNavigation(center);
    if (delivery.status === "PICKED_UP") {
      updateDeliveryStatus(delivery.id, "IN_TRANSIT");
    }
  };

  const handleArrived = () => {
    updateDeliveryStatus(delivery.id, "ARRIVED");
  };

  return (
    <div className="flex flex-col">
      <div className="relative aspect-[4/3] w-full bg-light-blue">
        <iframe
          title="Navigation map"
          src={mapProvider.getEmbedUrl(center, 15)}
          className="h-full w-full border-0"
          allowFullScreen
        />
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Distance: {delivery.distance_km} km · Fee: ₱{delivery.delivery_fee}
        </p>
        <Button
          size="lg"
          className="h-14 w-full bg-sky text-base hover:bg-sky/90"
          onClick={handleNavigate}
        >
          <Navigation className="mr-2 h-5 w-5" />
          Navigate
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 w-full text-base"
          onClick={handleArrived}
          disabled={delivery.status === "ARRIVED" || delivery.status === "DELIVERED"}
        >
          <MapPin className="mr-2 h-5 w-5" />
          Mark Arrived
        </Button>
      </div>
    </div>
  );
}

export default function DriverNavigatePage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading map...</div>}>
      <NavigateContent />
    </Suspense>
  );
}

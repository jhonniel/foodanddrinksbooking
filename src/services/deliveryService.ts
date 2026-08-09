import type { DeliveryOrder, Driver } from "@/types";
import { useDataStore } from "@/stores/data";
import { STORE_LOCATION } from "@/data/demo";
import { distanceKmBetween } from "@/lib/delivery/pricing";
import { openExternalNavigation, type LatLng } from "@/lib/maps/provider";

export function getDriverActiveDelivery(
  deliveries: DeliveryOrder[],
  driverId: string
): DeliveryOrder | undefined {
  return deliveries.find(
    (d) =>
      (d.driver_id === driverId ||
        d.driver?.id === driverId ||
        d.driver?.profile_id === driverId) &&
      !["DELIVERED", "CANCELLED"].includes(d.status)
  );
}

/** Online, not suspended, and not on an active delivery. */
export function getAssignableDrivers(
  deliveries: DeliveryOrder[],
  drivers?: Driver[]
): Driver[] {
  const list = drivers ?? useDataStore.getState().drivers;
  return list.filter(
    (d) =>
      d.status === "ONLINE" &&
      d.is_active &&
      !getDriverActiveDelivery(deliveries, d.id)
  );
}

export function distanceToStoreKm(driver: Driver): number | null {
  const loc = driver.current_location;
  if (!loc) return null;
  return distanceKmBetween(
    { lat: STORE_LOCATION.lat, lng: STORE_LOCATION.lng },
    { lat: loc.latitude, lng: loc.longitude }
  );
}

export type NearestDriverResult = {
  driver: Driver;
  distanceKm: number | null;
  usedLocation: boolean;
};

/**
 * Prefer the ONLINE idle driver closest to the store.
 * Falls back to any assignable driver when none have GPS.
 */
export function pickNearestOnlineDriver(
  deliveries: DeliveryOrder[],
  drivers?: Driver[]
): NearestDriverResult | null {
  const assignable = getAssignableDrivers(deliveries, drivers);
  if (assignable.length === 0) return null;

  const withLocation = assignable
    .map((driver) => ({
      driver,
      distanceKm: distanceToStoreKm(driver),
    }))
    .filter(
      (row): row is { driver: Driver; distanceKm: number } =>
        row.distanceKm != null
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (withLocation.length > 0) {
    const best = withLocation[0];
    return {
      driver: best.driver,
      distanceKm: best.distanceKm,
      usedLocation: true,
    };
  }

  return {
    driver: assignable[0],
    distanceKm: null,
    usedLocation: false,
  };
}

export async function getAvailableDrivers(): Promise<Driver[]> {
  const drivers = useDataStore.getState().drivers;
  return drivers.filter((d) => d.status === "ONLINE" && d.is_active);
}

export function navigateToCustomer(delivery: DeliveryOrder): void {
  if (delivery.customer_latitude && delivery.customer_longitude) {
    openExternalNavigation({
      lat: delivery.customer_latitude,
      lng: delivery.customer_longitude,
    });
  }
}

export function navigateToStore(delivery: DeliveryOrder): void {
  const dest: LatLng = {
    lat: delivery.store_latitude ?? 10.3157,
    lng: delivery.store_longitude ?? 123.8854,
  };
  openExternalNavigation(dest, "Island Coolers");
}

export function verifyDeliveryPin(
  delivery: DeliveryOrder,
  pin: string
): boolean {
  if (!delivery.delivery_pin) return true;
  return delivery.delivery_pin === pin.trim();
}

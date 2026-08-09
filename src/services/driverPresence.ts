import type { Driver, DriverLocation } from "@/types";
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";
import { getDriverActiveDelivery } from "@/services/deliveryService";

export function findDriverForProfile(
  profileId: string | undefined | null
): Driver | null {
  if (!profileId) return null;
  return (
    useDataStore
      .getState()
      .drivers.find(
        (d) =>
          d.profile_id === profileId ||
          d.id === profileId ||
          d.profile?.id === profileId
      ) ?? null
  );
}

export function isDriverAvailableStatus(status: Driver["status"]): boolean {
  return status === "ONLINE" || status === "BUSY";
}

function readGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

function buildLocation(
  driverId: string,
  coords: { lat: number; lng: number }
): DriverLocation {
  return {
    id: `loc-${driverId}-${Date.now()}`,
    driver_id: driverId,
    latitude: coords.lat,
    longitude: coords.lng,
    heading: null,
    speed: null,
    recorded_at: new Date().toISOString(),
  };
}

/** Sync Driver.status + optional GPS, and mirror app.driverOnline. */
export async function setDriverOnlineStatus(
  profileId: string,
  online: boolean
): Promise<Driver | null> {
  const driver = findDriverForProfile(profileId);
  if (!driver) {
    useAppStore.getState().setDriverOnline(online);
    return null;
  }

  const updateDriver = useDataStore.getState().updateDriver;

  if (!online) {
    updateDriver(driver.id, { status: "OFFLINE" });
    useAppStore.getState().setDriverOnline(false);
    return { ...driver, status: "OFFLINE" };
  }

  const coords = await readGeolocation();
  const location = coords
    ? buildLocation(driver.id, coords)
    : driver.current_location;

  const deliveries = useAppStore.getState().deliveries;
  const hasActive = !!getDriverActiveDelivery(deliveries, driver.id);
  const nextStatus = hasActive ? ("BUSY" as const) : ("ONLINE" as const);

  updateDriver(driver.id, {
    status: nextStatus,
    ...(location ? { current_location: location } : {}),
  });
  useAppStore.getState().setDriverOnline(true);

  return {
    ...driver,
    status: nextStatus,
    current_location: location,
  };
}

/** Refresh GPS while the driver remains online. */
export async function refreshDriverLocation(
  profileId: string
): Promise<DriverLocation | null> {
  const driver = findDriverForProfile(profileId);
  if (!driver || !isDriverAvailableStatus(driver.status)) return null;

  const coords = await readGeolocation();
  if (!coords) return null;

  const location = buildLocation(driver.id, coords);
  useDataStore.getState().updateDriver(driver.id, {
    current_location: location,
  });
  return location;
}

/** Prefer Driver.status over the legacy global flag. */
export function resolveDriverOnline(
  driver: Driver | null,
  fallbackOnline: boolean
): boolean {
  if (driver) return isDriverAvailableStatus(driver.status);
  return fallbackOnline;
}

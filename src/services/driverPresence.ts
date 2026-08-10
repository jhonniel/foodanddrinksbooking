import type { Driver } from "@/types";
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

function upsertLocalDriver(driver: Driver) {
  const store = useDataStore.getState();
  const others = store.drivers.filter(
    (d) => d.id !== driver.id && d.profile_id !== driver.profile_id
  );
  store.setDrivers([driver, ...others]);
}

/** Prefer PATCH (ensures + updates). Fall back to GET+PATCH only if needed. */
export async function fetchDriversFromApi(): Promise<Driver[]> {
  const res = await fetch("/api/drivers", {
    cache: "no-store",
    credentials: "include",
  });
  const data = (await res.json().catch(() => null)) as {
    drivers?: Driver[];
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error || "Could not load drivers.");
  }
  const drivers = data?.drivers ?? [];
  useDataStore.getState().setDrivers(drivers);
  return drivers;
}

export async function setDriverActiveApi(
  driverId: string,
  active: boolean
): Promise<Driver> {
  const res = await fetch(`/api/drivers/${driverId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
  const data = (await res.json().catch(() => null)) as {
    driver?: Driver;
    error?: string;
  } | null;
  if (!res.ok || !data?.driver) {
    throw new Error(data?.error || "Could not update driver.");
  }
  const store = useDataStore.getState();
  store.setDrivers(
    store.drivers.map((d) => (d.id === driverId ? data.driver! : d))
  );
  return data.driver;
}

/** Load / create the Supabase drivers row for the signed-in driver. */
export async function syncMyDriverProfile(): Promise<Driver> {
  const res = await fetch("/api/drivers/me", {
    cache: "no-store",
    credentials: "include",
  });
  const data = (await res.json().catch(() => null)) as {
    driver?: Driver;
    error?: string;
  } | null;
  if (!res.ok || !data?.driver) {
    throw new Error(
      data?.error ||
        "Could not load driver profile from Supabase. Try signing out and back in."
    );
  }
  upsertLocalDriver(data.driver);
  useAppStore
    .getState()
    .setDriverOnline(isDriverAvailableStatus(data.driver.status));
  return data.driver;
}

/**
 * Toggle online in Supabase. Always hits the API (does not rely on local
 * driver cache, which can be empty after storage rehydrate).
 */
export async function setDriverOnlineStatus(
  _profileId: string,
  online: boolean
): Promise<Driver> {
  const coords = online ? await readGeolocation() : null;

  // Prefer PATCH (ensures + updates). Fall back to GET+PATCH only if needed.
  let res = await fetch("/api/drivers/me", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      online,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    }),
  });

  let data = (await res.json().catch(() => null)) as {
    driver?: Driver;
    error?: string;
  } | null;

  // Session / cold start: ensure row exists, then retry once.
  if ((!res.ok || !data?.driver) && res.status !== 403) {
    try {
      await syncMyDriverProfile();
    } catch {
      /* PATCH error below is enough */
    }
    res = await fetch("/api/drivers/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        online,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      }),
    });
    data = (await res.json().catch(() => null)) as {
      driver?: Driver;
      error?: string;
    } | null;
  }

  if (!res.ok || !data?.driver) {
    throw new Error(
      data?.error ||
        "Could not update online status. Make sure this account is a DRIVER in Supabase."
    );
  }

  const deliveries = useAppStore.getState().deliveries;
  const hasActive = !!getDriverActiveDelivery(deliveries, data.driver.id);
  const next =
    online && hasActive
      ? { ...data.driver, status: "BUSY" as const }
      : data.driver;

  upsertLocalDriver(next);
  useAppStore.getState().setDriverOnline(online);
  return next;
}

/** Refresh GPS while the driver remains online. */
export async function refreshDriverLocation(
  profileId: string
): Promise<null> {
  const driver = findDriverForProfile(profileId);
  if (!driver || !isDriverAvailableStatus(driver.status)) return null;

  const coords = await readGeolocation();
  if (!coords) return null;

  await fetch("/api/drivers/me", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      online: true,
      latitude: coords.lat,
      longitude: coords.lng,
    }),
  }).catch(() => {
    /* best-effort */
  });
  return null;
}

/** Prefer Driver.status over the legacy global flag. */
export function resolveDriverOnline(
  driver: Driver | null,
  fallbackOnline: boolean
): boolean {
  if (driver) return isDriverAvailableStatus(driver.status);
  return fallbackOnline;
}

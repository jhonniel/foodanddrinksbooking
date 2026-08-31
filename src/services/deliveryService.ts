import type { DeliveryOrder, Driver, Order, Profile } from "@/types";
import { useDataStore } from "@/stores/data";
import { STORE_LOCATION } from "@/data/demo";
import { distanceKmBetween } from "@/lib/delivery/pricing";
import { openExternalNavigation, type LatLng } from "@/lib/maps/provider";

/** IDs that identify the signed-in driver (profile id and/or drivers row id). */
export function collectDriverMatchIds(
  userId: string | undefined | null,
  driverRecord?: Driver | null
): Set<string> {
  return new Set(
    [userId, driverRecord?.id, driverRecord?.profile_id, driverRecord?.profile?.id]
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

/**
 * Whether a delivery belongs to this driver.
 * Matches delivery_orders.driver_id (drivers.id) and orders.driver_id (profiles.id).
 */
export function isDeliveryOwnedByDriver(
  delivery: DeliveryOrder,
  ids: Set<string>,
  order?: Order | null
): boolean {
  if (ids.size === 0) return false;
  if (delivery.driver_id && ids.has(delivery.driver_id)) return true;
  if (delivery.driver?.id && ids.has(delivery.driver.id)) return true;
  if (delivery.driver?.profile_id && ids.has(delivery.driver.profile_id)) {
    return true;
  }
  if (order?.driver_id && ids.has(order.driver_id)) return true;
  return false;
}

/**
 * Filter deliveries for the driver UI.
 * Pure DRIVER accounts trust /api/orders (already scoped to them).
 */
export function filterDeliveriesForDriver(input: {
  deliveries: DeliveryOrder[];
  orders: Order[];
  user: Profile | null | undefined;
  driverRecord?: Driver | null;
}): DeliveryOrder[] {
  const { deliveries, orders, user, driverRecord } = input;
  if (!user) return [];

  // API already returns only this driver's assignments
  if (user.role === "DRIVER") {
    return deliveries;
  }

  const ids = collectDriverMatchIds(user.id, driverRecord);
  return deliveries.filter((d) => {
    const order = orders.find((o) => o.id === d.order_id);
    return isDeliveryOwnedByDriver(d, ids, order);
  });
}

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

/** Online DRIVER accounts only — staff/admin driver rows are excluded.
 *  Idle ONLINE drivers are preferred; BUSY drivers stay hidden from new assigns
 *  (reassign UI already excludes the current driver and lists other ONLINE ones).
 */
export function getAssignableDrivers(
  deliveries: DeliveryOrder[],
  drivers?: Driver[]
): Driver[] {
  const list = drivers ?? useDataStore.getState().drivers;
  return list.filter((d) => {
    if (d.profile?.role !== "DRIVER") return false;
    if (!d.is_active || d.profile?.is_active === false) return false;
    if (d.status !== "ONLINE") return false;
    // Allow assign if their only "active" delivery is already completed/cancelled
    return !getDriverActiveDelivery(deliveries, d.id);
  });
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
  return drivers.filter(
    (d) =>
      d.profile?.role === "DRIVER" &&
      d.status === "ONLINE" &&
      d.is_active &&
      d.profile?.is_active !== false
  );
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

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d = new Date()): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

export type DriverEarningsSummary = {
  today: number;
  weekly: number;
  lifetime: number;
  todayCount: number;
  completedCount: number;
  inProgressCount: number;
  transactions: Array<{
    id: string;
    orderNumber: string;
    amount: number;
    at: string;
  }>;
};

const EMPTY_EARNINGS: DriverEarningsSummary = {
  today: 0,
  weekly: 0,
  lifetime: 0,
  todayCount: 0,
  completedCount: 0,
  inProgressCount: 0,
  transactions: [],
};

/** Deliveries assigned to a specific driver row (admin + wallet views). */
export function filterDeliveriesForDriverRecord(
  deliveries: DeliveryOrder[],
  orders: Order[],
  driver: Driver
): DeliveryOrder[] {
  const ids = collectDriverMatchIds(driver.profile_id, driver);
  return deliveries.filter((d) => {
    const order = orders.find((o) => o.id === d.order_id);
    return isDeliveryOwnedByDriver(d, ids, order);
  });
}

/**
 * Driver wallet totals — only DELIVERED jobs count toward earnings.
 */
export function computeDriverEarningsSummary(input: {
  deliveries: DeliveryOrder[];
  orders: Order[];
  driver: Driver;
}): DriverEarningsSummary {
  const mine = filterDeliveriesForDriverRecord(
    input.deliveries,
    input.orders,
    input.driver
  );

  const completed = mine.filter((d) => d.status === "DELIVERED");
  const inProgress = mine.filter(
    (d) => !["DELIVERED", "CANCELLED"].includes(d.status)
  );

  const dayStart = startOfLocalDay().getTime();
  const weekStart = startOfWeekMonday().getTime();

  const feeOf = (d: DeliveryOrder) => Number(d.delivery_fee ?? 0);
  const completedAt = (d: DeliveryOrder) =>
    new Date(d.delivered_at ?? d.updated_at).getTime();

  const todayCompleted = completed.filter((d) => completedAt(d) >= dayStart);
  const weekCompleted = completed.filter((d) => completedAt(d) >= weekStart);

  const transactions = [...completed]
    .sort((a, b) => completedAt(b) - completedAt(a))
    .map((d) => {
      const order =
        d.order ?? input.orders.find((o) => o.id === d.order_id) ?? null;
      return {
        id: d.id,
        orderNumber: order?.order_number ?? "—",
        amount: feeOf(d),
        at: d.delivered_at ?? d.updated_at,
      };
    });

  return {
    today: todayCompleted.reduce((sum, d) => sum + feeOf(d), 0),
    weekly: weekCompleted.reduce((sum, d) => sum + feeOf(d), 0),
    lifetime: completed.reduce((sum, d) => sum + feeOf(d), 0),
    todayCount: todayCompleted.length,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    transactions,
  };
}

export function emptyDriverEarningsSummary(): DriverEarningsSummary {
  return { ...EMPTY_EARNINGS, transactions: [] };
}

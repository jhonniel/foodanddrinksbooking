import { DELIVERY_CONFIG, STORE_LOCATION } from "@/data/demo";
import type { DeliverySettings } from "@/lib/settings/types";
import { isWithinSamalIsland } from "@/lib/delivery/samal";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DeliveryQuote {
  distanceKm: number;
  fee: number;
  isFree: boolean;
  withinRadius: boolean;
  estimatedMinutes: number;
  breakdown: {
    baseFee: number;
    distanceFee: number;
    succeedingKm: number;
  };
}

/** Haversine distance in kilometers */
export function distanceKmBetween(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceFromStore(
  destination: LatLng,
  store = STORE_LOCATION
): number {
  return distanceKmBetween(
    { lat: store.lat, lng: store.lng },
    destination
  );
}

/**
 * ₱10 for the first 1 km, then ₱2 per succeeding km (rounded up).
 * Free when subtotal >= freeAbove.
 * Delivery only inside Samal Island.
 */
export function calculateDeliveryFee(
  destination: LatLng | null | undefined,
  subtotal = 0,
  config: Pick<
    DeliverySettings,
    | "baseFee"
    | "baseKm"
    | "perKmFee"
    | "freeAbove"
    | "baseMinutes"
    | "minutesPerKm"
    | "estimatedMinutes"
  > = DELIVERY_CONFIG,
  store = STORE_LOCATION
): DeliveryQuote {
  const { baseFee, baseKm, perKmFee, freeAbove, baseMinutes, minutesPerKm, estimatedMinutes } =
    config;

  if (!destination || destination.lat == null || destination.lng == null) {
    return {
      distanceKm: 0,
      fee: baseFee,
      isFree: false,
      withinRadius: false,
      estimatedMinutes,
      breakdown: {
        baseFee,
        distanceFee: 0,
        succeedingKm: 0,
      },
    };
  }

  const withinRadius = isWithinSamalIsland(destination.lat, destination.lng);
  const rawKm = distanceFromStore(destination, store);
  const distanceKm = Math.round(rawKm * 10) / 10;
  const succeedingKm = Math.max(0, Math.ceil(distanceKm - baseKm));
  const distanceFee = succeedingKm * perKmFee;
  const calculatedFee = baseFee + distanceFee;

  const isFree = withinRadius && subtotal >= freeAbove;
  const fee = !withinRadius ? 0 : isFree ? 0 : calculatedFee;

  const etaMinutes = Math.max(
    15,
    Math.round(baseMinutes + distanceKm * minutesPerKm)
  );

  return {
    distanceKm,
    fee,
    isFree,
    withinRadius,
    estimatedMinutes: etaMinutes,
    breakdown: {
      baseFee,
      distanceFee,
      succeedingKm,
    },
  };
}

export function formatDeliveryRateLabel(
  config: Pick<DeliverySettings, "baseFee" | "baseKm" | "perKmFee"> = DELIVERY_CONFIG
): string {
  return `₱${config.baseFee} first ${config.baseKm} km · ₱${config.perKmFee}/km after · Samal Island only`;
}

export function formatDistanceKm(km: number): string {
  if (km < 0.1) return "< 0.1 km";
  return `${km.toFixed(1)} km`;
}

import { STORE_LOCATION, DELIVERY_CONFIG } from "@/data/demo";

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

export function distanceFromStore(destination: LatLng): number {
  return distanceKmBetween(
    { lat: STORE_LOCATION.lat, lng: STORE_LOCATION.lng },
    destination
  );
}

/**
 * ₱10 for the first 1 km, then ₱2 per succeeding km (rounded up).
 * Free when subtotal >= freeAbove.
 */
export function calculateDeliveryFee(
  destination: LatLng | null | undefined,
  subtotal = 0
): DeliveryQuote {
  const { baseFee, baseKm, perKmFee } = DELIVERY_CONFIG;

  if (!destination || destination.lat == null || destination.lng == null) {
    return {
      distanceKm: 0,
      fee: baseFee,
      isFree: false,
      withinRadius: true,
      estimatedMinutes: DELIVERY_CONFIG.estimatedMinutes,
      breakdown: {
        baseFee,
        distanceFee: 0,
        succeedingKm: 0,
      },
    };
  }

  const rawKm = distanceFromStore(destination);
  const distanceKm = Math.round(rawKm * 10) / 10; // 1 decimal
  // Succeeding km after the included baseKm, rounded up to whole km
  const succeedingKm = Math.max(0, Math.ceil(distanceKm - baseKm));
  const distanceFee = succeedingKm * perKmFee;
  const calculatedFee = baseFee + distanceFee;

  const withinRadius = distanceKm <= DELIVERY_CONFIG.radiusKm;
  const isFree = subtotal >= DELIVERY_CONFIG.freeAbove;
  const fee = isFree ? 0 : calculatedFee;

  const estimatedMinutes = Math.max(
    15,
    Math.round(
      DELIVERY_CONFIG.baseMinutes +
        distanceKm * DELIVERY_CONFIG.minutesPerKm
    )
  );

  return {
    distanceKm,
    fee,
    isFree,
    withinRadius,
    estimatedMinutes,
    breakdown: {
      baseFee,
      distanceFee,
      succeedingKm,
    },
  };
}

export function formatDistanceKm(km: number): string {
  if (km < 0.1) return "< 0.1 km";
  return `${km.toFixed(1)} km`;
}

export function formatDeliveryRateLabel(): string {
  return `₱${DELIVERY_CONFIG.baseFee} first ${DELIVERY_CONFIG.baseKm} km · ₱${DELIVERY_CONFIG.perKmFee}/km after`;
}

import type { LatLng } from "@/lib/delivery/pricing";

/**
 * Approximate shoreline polygon for Island Garden City of Samal (Samal Island).
 * Delivery is only supported for pins inside this area.
 */
export const SAMAL_ISLAND_POLYGON: LatLng[] = [
  { lat: 7.205, lng: 125.655 },
  { lat: 7.210, lng: 125.725 },
  { lat: 7.165, lng: 125.780 },
  { lat: 7.105, lng: 125.812 },
  { lat: 7.035, lng: 125.815 },
  { lat: 6.965, lng: 125.790 },
  { lat: 6.915, lng: 125.745 },
  { lat: 6.905, lng: 125.695 },
  { lat: 6.945, lng: 125.655 },
  { lat: 7.015, lng: 125.635 },
  { lat: 7.085, lng: 125.628 },
  { lat: 7.145, lng: 125.635 },
];

/** Default map center (Peñaplata / Babak area) */
export const SAMAL_MAP_CENTER: LatLng = { lat: 7.0745, lng: 125.708 };

export const SAMAL_SERVICE_MESSAGE =
  "Delivery is only available within Samal Island (Island Garden City of Samal).";

/** Ray-casting point-in-polygon */
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  const { lat, lng } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat;
    const xi = polygon[i].lng;
    const yj = polygon[j].lat;
    const xj = polygon[j].lng;
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isWithinSamalIsland(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return false;
  }
  return isPointInPolygon({ lat, lng }, SAMAL_ISLAND_POLYGON);
}

export function assertDeliveryWithinSamal(
  lat: number | null | undefined,
  lng: number | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (lat == null || lng == null) {
    return {
      ok: false,
      error:
        "Please pin your delivery location on Samal Island before placing the order.",
    };
  }
  if (!isWithinSamalIsland(lat, lng)) {
    return { ok: false, error: SAMAL_SERVICE_MESSAGE };
  }
  return { ok: true };
}

/** Leaflet-ready bounds [[south, west], [north, east]] with optional padding. */
export function getSamalMapBounds(pad = 0.02): [[number, number], [number, number]] {
  const lats = SAMAL_ISLAND_POLYGON.map((p) => p.lat);
  const lngs = SAMAL_ISLAND_POLYGON.map((p) => p.lng);
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

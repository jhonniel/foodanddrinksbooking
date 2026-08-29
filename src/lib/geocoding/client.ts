import type { GeocodedAddress, GeocodeSearchResult } from "@/lib/geocoding/types";
import type { LatLng } from "@/lib/delivery/pricing";

export async function reverseGeocodeClient(
  coords: LatLng
): Promise<GeocodedAddress | null> {
  const params = new URLSearchParams({
    lat: String(coords.lat),
    lng: String(coords.lng),
  });
  const res = await fetch(`/api/geocode/reverse?${params.toString()}`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    address?: GeocodedAddress;
  } | null;
  if (!res.ok || !data?.address) return null;
  return data.address;
}

export async function searchAddressClient(
  query: string,
  bias?: LatLng
): Promise<GeocodeSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lng", String(bias.lng));
  }
  const res = await fetch(`/api/geocode/search?${params.toString()}`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    results?: GeocodeSearchResult[];
  } | null;
  if (!res.ok) return [];
  return data?.results ?? [];
}

export function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => reject(new Error("Could not get your location.")),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

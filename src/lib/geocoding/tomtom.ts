import type { GeocodedAddress, GeocodeSearchResult } from "@/lib/geocoding/types";

const SAMAL_CITY_ALIASES = new Set([
  "samal city",
  "island garden city of samal",
  "igacos",
]);

function getTomTomKey(): string {
  return process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim() || "";
}

function normalizeCity(name: string | undefined): string | null {
  if (!name?.trim()) return null;
  const lower = name.trim().toLowerCase();
  if (SAMAL_CITY_ALIASES.has(lower) || lower.includes("samal")) {
    return "Island Garden City of Samal";
  }
  return name.trim();
}

function parseTomTomAddress(
  address: Record<string, unknown>,
  lat: number,
  lng: number
): GeocodedAddress {
  const street = String(address.street ?? address.streetName ?? "").trim();
  const subdivision = String(address.municipalitySubdivision ?? "").trim();
  const municipality = normalizeCity(
    String(address.municipality ?? address.localName ?? "")
  );
  const province = String(
    address.countrySecondarySubdivision ?? address.countrySubdivision ?? ""
  ).trim();
  const postalCode = String(address.postalCode ?? "").trim();
  const freeform = String(address.freeformAddress ?? "").trim();

  const parts = [street, subdivision, municipality, province].filter(Boolean);
  const fullAddress = freeform || parts.join(", ");

  return {
    fullAddress,
    barangay: subdivision || null,
    city: municipality,
    province: province || null,
    postalCode: postalCode || null,
    latitude: lat,
    longitude: lng,
  };
}

export async function reverseGeocodeTomTom(
  lat: number,
  lng: number
): Promise<GeocodedAddress | null> {
  const key = getTomTomKey();
  if (!key) return null;

  const url = new URL(
    `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json`
  );
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    addresses?: Array<{ address?: Record<string, unknown> }>;
  };
  const entry = data.addresses?.[0]?.address;
  if (!entry) return null;

  return parseTomTomAddress(entry, lat, lng);
}

export async function searchGeocodeTomTom(
  query: string,
  bias?: { lat: number; lng: number; radiusMeters?: number }
): Promise<GeocodeSearchResult[]> {
  const key = getTomTomKey();
  const trimmed = query.trim();
  if (!key || trimmed.length < 3) return [];

  const url = new URL(
    `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(trimmed)}.json`
  );
  url.searchParams.set("key", key);
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrySet", "PH");
  if (bias) {
    url.searchParams.set("lat", String(bias.lat));
    url.searchParams.set("lon", String(bias.lng));
    url.searchParams.set("radius", String(bias.radiusMeters ?? 30000));
  }

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      id?: string;
      position?: { lat?: number; lon?: number };
      address?: Record<string, unknown>;
    }>;
  };

  return (data.results ?? [])
    .map((row, index) => {
      const lat = row.position?.lat;
      const lng = row.position?.lon;
      if (lat == null || lng == null || !row.address) return null;
      const parsed = parseTomTomAddress(row.address, lat, lng);
      return {
        ...parsed,
        id: row.id ?? `result-${index}`,
      };
    })
    .filter((row): row is GeocodeSearchResult => row != null);
}

import type { LatLng } from "@/lib/delivery/pricing";

export type GeocodedAddress = {
  fullAddress: string;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
};

export type GeocodeSearchResult = GeocodedAddress & {
  id: string;
};

export type ReverseGeocodeInput = LatLng;

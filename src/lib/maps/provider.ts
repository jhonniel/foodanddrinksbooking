export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  position: LatLng;
  label?: string;
  type?: "store" | "customer" | "driver" | "default";
}

export interface MapRoute {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
}

export interface MapProvider {
  readonly name: string;
  getEmbedUrl(center: LatLng, zoom?: number): string;
  getDirectionsUrl(route: MapRoute): string;
  getStaticMapUrl(
    center: LatLng,
    markers?: MapMarker[],
    zoom?: number,
    size?: string
  ): string;
  openNavigation(destination: LatLng, label?: string): void;
}

export class MapboxProvider implements MapProvider {
  readonly name = "mapbox";
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  }

  getEmbedUrl(center: LatLng, zoom = 14): string {
    if (!this.token) {
      return this.fallbackEmbed(center, zoom);
    }
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.lng},${center.lat},${zoom},0/600x400?access_token=${this.token}`;
  }

  getDirectionsUrl(route: MapRoute): string {
    return `https://www.google.com/maps/dir/?api=1&origin=${route.origin.lat},${route.origin.lng}&destination=${route.destination.lat},${route.destination.lng}&travelmode=driving`;
  }

  getStaticMapUrl(
    center: LatLng,
    markers: MapMarker[] = [],
    zoom = 14,
    size = "600x400"
  ): string {
    if (!this.token) return this.fallbackEmbed(center, zoom);
    const markerStr = markers
      .map((m) => `pin-s+1FA7E1(${m.position.lng},${m.position.lat})`)
      .join(",");
    const overlay = markerStr ? `${markerStr}/` : "";
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}${center.lng},${center.lat},${zoom},0/${size}?access_token=${this.token}`;
  }

  openNavigation(destination: LatLng, label?: string): void {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}${label ? `&destination_place_id=${encodeURIComponent(label)}` : ""}&travelmode=driving`;
    if (typeof window !== "undefined") window.open(url, "_blank");
  }

  private fallbackEmbed(center: LatLng, zoom: number): string {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.02}%2C${center.lat - 0.02}%2C${center.lng + 0.02}%2C${center.lat + 0.02}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;
  }
}

export class GoogleMapsProvider implements MapProvider {
  readonly name = "google";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
  }

  getEmbedUrl(center: LatLng, zoom = 14): string {
    if (!this.apiKey) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.02}%2C${center.lat - 0.02}%2C${center.lng + 0.02}%2C${center.lat + 0.02}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;
    }
    return `https://www.google.com/maps/embed/v1/view?key=${this.apiKey}&center=${center.lat},${center.lng}&zoom=${zoom}`;
  }

  getDirectionsUrl(route: MapRoute): string {
    return `https://www.google.com/maps/dir/?api=1&origin=${route.origin.lat},${route.origin.lng}&destination=${route.destination.lat},${route.destination.lng}&travelmode=driving`;
  }

  getStaticMapUrl(
    center: LatLng,
    markers: MapMarker[] = [],
    zoom = 14,
    size = "600x400"
  ): string {
    if (!this.apiKey) {
      return `https://placehold.co/${size}/EAF8FC/0B2A4A?text=Map`;
    }
    const markerParams = markers
      .map((m) => `markers=color:blue%7C${m.position.lat},${m.position.lng}`)
      .join("&");
    return `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}&zoom=${zoom}&size=${size}&${markerParams}&key=${this.apiKey}`;
  }

  openNavigation(destination: LatLng): void {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    if (typeof window !== "undefined") window.open(url, "_blank");
  }
}

export function getMapProvider(): MapProvider {
  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER || "mapbox";
  if (provider === "google") return new GoogleMapsProvider();
  return new MapboxProvider();
}

export function openExternalNavigation(
  destination: LatLng,
  label?: string
): void {
  getMapProvider().openNavigation(destination, label);
}

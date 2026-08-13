export type MapTileConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
};

const TOMTOM_LAYER = "basic";
const TOMTOM_STYLE = "main";

export function getTomTomApiKey(): string {
  return process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim() || "";
}

export function getMapProviderName(): string {
  return process.env.NEXT_PUBLIC_MAP_PROVIDER?.trim().toLowerCase() || "tomtom";
}

function osmFallback(): MapTileConfig {
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  };
}

/** Leaflet tile layer config for the configured map provider. */
export function getMapTileConfig(): MapTileConfig {
  const provider = getMapProviderName();

  if (provider === "tomtom") {
    const key = getTomTomApiKey();
    if (!key) return osmFallback();
    return {
      url: `https://api.tomtom.com/map/1/tile/${TOMTOM_LAYER}/${TOMTOM_STYLE}/{z}/{x}/{y}.png?key=${key}`,
      attribution: "&copy; TomTom",
      maxZoom: 22,
    };
  }

  if (provider === "mapbox") {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
    if (!token) return osmFallback();
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`,
      attribution: "&copy; Mapbox &copy; OpenStreetMap",
      maxZoom: 22,
    };
  }

  return osmFallback();
}

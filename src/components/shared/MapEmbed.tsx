"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getMapTileConfig } from "@/lib/maps/tiles";
import type { LatLng } from "@/lib/maps/provider";

type Props = {
  center: LatLng;
  zoom?: number;
  className?: string;
};

/** Read-only map preview (delivery tracking, driver navigate). */
export function MapEmbed({ center, zoom = 14, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const tiles = getMapTileConfig();
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: false,
        dragging: true,
        zoomControl: true,
      });

      L.tileLayer(tiles.url, {
        attribution: tiles.attribution,
        maxZoom: tiles.maxZoom,
      }).addTo(map);

      const marker = L.marker([center.lat, center.lng]).addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      setReady(true);
      requestAnimationFrame(() => map.invalidateSize());
      window.setTimeout(() => map.invalidateSize(), 250);
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.setView([center.lat, center.lng], zoom);
    markerRef.current.setLatLng([center.lat, center.lng]);
  }, [center.lat, center.lng, zoom]);

  return (
    <div className={cn("relative h-full w-full bg-muted", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
    </div>
  );
}

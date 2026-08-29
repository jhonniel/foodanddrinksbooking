"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMapTileConfig } from "@/lib/maps/tiles";
import type { LatLng } from "@/lib/delivery/pricing";
import {
  isWithinSamalIsland,
  SAMAL_MAP_CENTER,
  SAMAL_SERVICE_MESSAGE,
} from "@/lib/delivery/samal";

type Props = {
  value: LatLng | null;
  onChange: (next: LatLng) => void;
  className?: string;
  heightClassName?: string;
  /** Request GPS once when the map is ready. */
  autoLocateOnMount?: boolean;
};

export function LocationPinMap({
  value,
  onChange,
  className,
  heightClassName = "h-64",
  autoLocateOnMount = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const autoLocateDoneRef = useRef(false);

  const pin = value ?? SAMAL_MAP_CENTER;
  const inside = isWithinSamalIsland(pin.lat, pin.lng);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Location is not supported on this device.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onChange(next);
        mapRef.current?.setView([next.lat, next.lng], 14);
        markerRef.current?.setLatLng([next.lat, next.lng]);
        setGeoLoading(false);
        if (!isWithinSamalIsland(next.lat, next.lng)) {
          setGeoError(SAMAL_SERVICE_MESSAGE);
        }
      },
      () => {
        setGeoLoading(false);
        setGeoError("Could not get your location. Pin it on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [onChange]);

  useEffect(() => {
    if (!autoLocateOnMount || !ready || autoLocateDoneRef.current) return;
    autoLocateDoneRef.current = true;
    useMyLocation();
  }, [autoLocateOnMount, ready, useMyLocation]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current || mapRef.current) return;

      // Fix default marker icons in bundlers
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
        center: [pin.lat, pin.lng],
        zoom: 12,
        scrollWheelZoom: true,
      });

      L.tileLayer(tiles.url, {
        attribution: tiles.attribution,
        maxZoom: tiles.maxZoom,
      }).addTo(map);

      const marker = L.marker([pin.lat, pin.lng], { draggable: true }).addTo(
        map
      );

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChange({ lat: pos.lat, lng: pos.lng });
      });

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const next = { lat: e.latlng.lat, lng: e.latlng.lng };
        marker.setLatLng([next.lat, next.lng]);
        onChange(next);
      });

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
    // Mount once; pin sync handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([pin.lat, pin.lng]);
  }, [pin.lat, pin.lng]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tap the map or drag the pin to set your delivery location.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-lg"
          onClick={useMyLocation}
          disabled={geoLoading}
        >
          {geoLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Use my location</span>
        </Button>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-muted",
          heightClassName
        )}
      >
        <div ref={containerRef} className="h-full w-full" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
      </div>

      {!inside ? (
        <p className="text-xs font-medium text-destructive">
          {SAMAL_SERVICE_MESSAGE}
        </p>
      ) : null}
      {geoError && !inside ? (
        <p className="text-xs text-destructive">{geoError}</p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
      </p>
    </div>
  );
}

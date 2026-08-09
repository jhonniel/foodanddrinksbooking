"use client";

import { useEffect, useMemo, useState } from "react";
import { Navigation, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { canAssignDrivers } from "@/lib/auth/config";
import {
  distanceToStoreKm,
  getAssignableDrivers,
  pickNearestOnlineDriver,
} from "@/services/deliveryService";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type AssignDriverControlsProps = {
  orderId: string;
  className?: string;
  compact?: boolean;
  onAssigned?: () => void;
};

export function AssignDriverControls({
  orderId,
  className,
  compact = false,
  onAssigned,
}: AssignDriverControlsProps) {
  const role = useAuthStore((s) => s.user?.role);
  const deliveries = useAppStore((s) => s.deliveries);
  const assignDriver = useAppStore((s) => s.assignDriver);
  const drivers = useDataStore((s) => s.drivers);

  const assignable = useMemo(
    () => getAssignableDrivers(deliveries, drivers),
    [deliveries, drivers]
  );

  const [selectedDriver, setSelectedDriver] = useState("");

  useEffect(() => {
    if (
      selectedDriver &&
      !assignable.some((d) => d.id === selectedDriver)
    ) {
      setSelectedDriver("");
    }
    if (!selectedDriver && assignable[0]) {
      setSelectedDriver(assignable[0].id);
    }
  }, [assignable, selectedDriver]);

  if (!canAssignDrivers(role)) return null;

  const handleManual = () => {
    const driverId = selectedDriver || assignable[0]?.id;
    if (!driverId) {
      toast.error("No online drivers available to assign.");
      return;
    }
    assignDriver(orderId, driverId);
    toast.success("Driver assigned.");
    onAssigned?.();
  };

  const handleAuto = () => {
    const result = pickNearestOnlineDriver(deliveries, drivers);
    if (!result) {
      toast.error("No online drivers available nearby.");
      return;
    }
    assignDriver(orderId, result.driver.id);
    const name =
      result.driver.profile?.full_name ??
      result.driver.vehicle_number ??
      "Driver";
    if (result.usedLocation && result.distanceKm != null) {
      toast.success(
        `Auto-assigned ${name} (${result.distanceKm.toFixed(1)} km from store)`
      );
    } else {
      toast.success(
        `Auto-assigned ${name} (no GPS — first available online driver)`
      );
    }
    onAssigned?.();
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        compact && "w-full flex-col sm:flex-row",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Select
        value={selectedDriver || assignable[0]?.id || ""}
        onValueChange={(v) => v && setSelectedDriver(v)}
      >
        <SelectTrigger className={cn(compact ? "w-full sm:w-44" : "w-44")}>
          <SelectValue placeholder="Select driver" />
        </SelectTrigger>
        <SelectContent>
          {assignable.map((d) => {
            const km = distanceToStoreKm(d);
            const label = d.profile?.full_name ?? d.vehicle_number ?? d.id;
            return (
              <SelectItem key={d.id} value={d.id}>
                {km != null
                  ? `${label} · ${km.toFixed(1)} km`
                  : `${label} · no GPS`}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="bg-green hover:bg-green/90"
        onClick={handleManual}
        disabled={assignable.length === 0}
      >
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
        Assign
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-sky text-sky hover:bg-sky/10"
        onClick={handleAuto}
        disabled={assignable.length === 0}
      >
        <Navigation className="mr-1.5 h-3.5 w-3.5" />
        Auto nearest
      </Button>
    </div>
  );
}

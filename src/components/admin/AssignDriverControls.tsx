"use client";

import { useEffect, useMemo, useState } from "react";
import { Navigation, UserPlus, RefreshCw } from "lucide-react";
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

/** Orders that can still get a (re)assigned driver. */
export function canAssignOrReassignOrderStatus(status: string): boolean {
  return status === "READY" || status === "ASSIGNED";
}

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
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const assignDriver = useAppStore((s) => s.assignDriver);
  const drivers = useDataStore((s) => s.drivers);
  const [busy, setBusy] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const delivery = deliveries.find((d) => d.order_id === orderId);
  const currentDriverId = delivery?.driver_id ?? order?.driver_id ?? null;
  const isReassign = Boolean(currentDriverId);
  const currentDriver = drivers.find(
    (d) =>
      d.id === currentDriverId ||
      d.profile_id === currentDriverId ||
      d.profile?.id === currentDriverId
  );

  const assignable = useMemo(
    () =>
      getAssignableDrivers(deliveries, drivers).filter(
        (d) => d.id !== currentDriverId && d.profile_id !== currentDriverId
      ),
    [deliveries, drivers, currentDriverId]
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

  const runAssign = async (driverId: string, successMessage: string) => {
    setBusy(true);
    try {
      await assignDriver(orderId, driverId);
      toast.success(successMessage);
      onAssigned?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not assign driver. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleManual = () => {
    const driverId = selectedDriver || assignable[0]?.id;
    if (!driverId) {
      toast.error("No online drivers available to assign.");
      return;
    }
    const name =
      drivers.find((d) => d.id === driverId)?.profile?.full_name ?? "Driver";
    void runAssign(
      driverId,
      isReassign ? `Reassigned to ${name}.` : `Assigned to ${name}.`
    );
  };

  const handleAuto = () => {
    const result = pickNearestOnlineDriver(
      deliveries,
      drivers.filter(
        (d) => d.id !== currentDriverId && d.profile_id !== currentDriverId
      )
    );
    if (!result) {
      toast.error("No online drivers available nearby.");
      return;
    }
    const name =
      result.driver.profile?.full_name ??
      result.driver.vehicle_number ??
      "Driver";
    const detail =
      result.usedLocation && result.distanceKm != null
        ? `${name} (${result.distanceKm.toFixed(1)} km from store)`
        : `${name} (first available online driver)`;
    void runAssign(
      result.driver.id,
      `${isReassign ? "Reassigned" : "Assigned"} ${detail}`
    );
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
      {isReassign && (
        <p className="w-full text-xs text-muted-foreground">
          Current:{" "}
          {currentDriver?.profile?.full_name ??
            currentDriver?.profile?.email ??
            "Assigned driver"}
          {currentDriver?.profile?.email
            ? ` (${currentDriver.profile.email})`
            : ""}{" "}
          — pick another online driver to reassign
        </p>
      )}
      {assignable.length === 0 && (
        <p className="w-full text-xs text-amber-700">
          No online idle drivers. The driver must tap Go Online on their app
          first (and finish or be reassigned off any busy job).
        </p>
      )}
      <Select
        value={selectedDriver || assignable[0]?.id || ""}
        onValueChange={(v) => v && setSelectedDriver(v)}
        disabled={busy}
      >
        <SelectTrigger className={cn(compact ? "w-full sm:w-44" : "w-44")}>
          <SelectValue placeholder="Select driver" />
        </SelectTrigger>
        <SelectContent>
          {assignable.map((d) => {
            const km = distanceToStoreKm(d);
            const label =
              d.profile?.full_name ?? d.vehicle_number ?? d.id;
            const email = d.profile?.email;
            return (
              <SelectItem key={d.id} value={d.id}>
                {km != null
                  ? `${label}${email ? ` (${email})` : ""} · ${km.toFixed(1)} km`
                  : `${label}${email ? ` (${email})` : ""} · no GPS`}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="bg-green hover:bg-green/90"
        onClick={handleManual}
        disabled={assignable.length === 0 || busy}
      >
        {isReassign ? (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        ) : (
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
        )}
        {busy ? "Saving…" : isReassign ? "Reassign" : "Assign"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-sky text-sky hover:bg-sky/10"
        onClick={handleAuto}
        disabled={assignable.length === 0 || busy}
      >
        <Navigation className="mr-1.5 h-3.5 w-3.5" />
        Auto nearest
      </Button>
    </div>
  );
}

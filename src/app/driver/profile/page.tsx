"use client";

import { useState } from "react";
import Link from "next/link";
import { Bike, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  resolveDriverOnline,
  setDriverOnlineStatus,
} from "@/services/driverPresence";

export default function DriverProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const driverOnlineFlag = useAppStore((s) => s.driverOnline);
  const drivers = useDataStore((s) => s.drivers);
  const [toggling, setToggling] = useState(false);

  const profile = user;
  const driver =
    drivers.find((d) => d.profile_id === user?.id || d.id === user?.id) ??
    null;
  const driverOnline = resolveDriverOnline(driver, driverOnlineFlag);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const handleOnlineChange = async (next: boolean) => {
    if (!user?.id) return;
    setToggling(true);
    try {
      await setDriverOnlineStatus(user.id, next);
      toast.success(next ? "You're online" : "You're offline");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not update online status. Try signing out and back in."
      );
    } finally {
      setToggling(false);
    }
  };

  if (!profile) {
    return (
      <div className="p-4 py-16 text-center">
        <p className="font-semibold text-navy">Not signed in</p>
        <Link href="/login" className="mt-3 inline-block text-sm text-green">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your driver account details
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-light-blue">
            <User className="h-8 w-8 text-sky" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy">{profile.full_name}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-sm text-muted-foreground">{profile.phone}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center gap-3">
            <Bike className="h-5 w-5 text-sky" />
            <div className="flex-1">
              <p className="font-medium text-navy">Vehicle</p>
              <p className="text-sm text-muted-foreground">
                {driver
                  ? `${driver.vehicle_type} · ${driver.vehicle_number}`
                  : "Not assigned yet"}
              </p>
              {driver?.license_number && (
                <p className="text-xs text-muted-foreground">
                  License: {driver.license_number}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card">
          <div>
            <Label htmlFor="online-status">Online Status</Label>
            <p className="text-xs text-muted-foreground">
              {driverOnline ? "Available for deliveries" : "Offline"}
            </p>
          </div>
          <Switch
            id="online-status"
            checked={driverOnline}
            disabled={toggling || !driver}
            onCheckedChange={(v) => void handleOnlineChange(v)}
          />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rating</span>
            <span className="font-semibold text-navy">
              {driver?.rating ?? "—"} ★
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Total Deliveries
            </span>
            <span className="font-semibold text-navy">
              {driver?.total_deliveries ?? 0}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                driver?.status === "BUSY"
                  ? "bg-amber-100 text-amber-800"
                  : driverOnline
                    ? "bg-green/10 text-green"
                    : "bg-slate-100 text-muted-foreground"
              )}
            >
              {driver?.status ?? (driverOnline ? "ONLINE" : "OFFLINE")}
            </span>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="mt-6 h-12 w-full text-red-600 hover:bg-red-50 hover:text-red-600"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Log Out
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Bike, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { createStaffAccount } from "@/services/authService";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DriverStatus } from "@/types";

const VEHICLE_TYPES = ["Motorcycle", "Bicycle", "Car", "Scooter"] as const;

const statusStyles: Record<DriverStatus, string> = {
  ONLINE: "bg-green/10 text-green",
  OFFLINE: "bg-slate-100 text-muted-foreground",
  BUSY: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-red-50 text-red-600",
};

export default function AdminDriversPage() {
  const drivers = useDataStore((s) => s.drivers);
  const addDriver = useDataStore((s) => s.addDriver);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("Motorcycle");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setVehicleType("Motorcycle");
    setVehicleNumber("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleAddDriver = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      toast.error("Full name is required.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!trimmedPhone) {
      toast.error("Phone number is required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (!vehicleType) {
      toast.error("Vehicle type is required.");
      return;
    }

    setSaving(true);
    const account = await createStaffAccount({
      email: trimmedEmail,
      password,
      fullName: trimmedName,
      phone: trimmedPhone,
      role: "DRIVER",
    });
    setSaving(false);

    if (!account.success || !account.profile) {
      toast.error(account.error ?? "Could not create driver account.");
      return;
    }

    addDriver({
      fullName: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      vehicleType,
      vehicleNumber: vehicleNumber.trim() || undefined,
      profileId: account.profile.id,
    });

    toast.success(
      `Driver "${trimmedName}" created. They can sign in with their email.`
    );
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Drivers</h1>
          <p className="text-sm text-muted-foreground">
            Monitor rider availability and performance
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Driver
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="driver-name">Full Name *</Label>
                <Input
                  id="driver-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <Label htmlFor="driver-email">Email *</Label>
                <Input
                  id="driver-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@islandcoolers.com"
                />
              </div>
              <div>
                <Label htmlFor="driver-phone">Phone *</Label>
                <Input
                  id="driver-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 917 555 0101"
                />
              </div>
              <div>
                <Label htmlFor="driver-password">Login password *</Label>
                <Input
                  id="driver-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <Label>Vehicle Type *</Label>
                <Select
                  value={vehicleType}
                  onValueChange={(v) => v && setVehicleType(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="driver-vehicle-no">Vehicle Number</Label>
                <Input
                  id="driver-vehicle-no"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="ABC-1234"
                />
              </div>
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={handleAddDriver}
                disabled={saving}
              >
                {saving ? "Creating account..." : "Create driver account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
          <div
            key={driver.id}
            className="rounded-2xl bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-light-blue">
                <Bike className="h-6 w-6 text-sky" />
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  statusStyles[driver.status]
                )}
              >
                {driver.status}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-navy">
              {driver.profile?.full_name ?? "Driver"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {driver.profile?.email}
            </p>
            <p className="text-sm text-muted-foreground">
              {driver.profile?.phone}
            </p>
            <div className="mt-3 space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Vehicle:</span>{" "}
                {driver.vehicle_type}
                {driver.vehicle_number ? ` · ${driver.vehicle_number}` : ""}
              </p>
              <p className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {driver.rating} · {driver.total_deliveries} deliveries
              </p>
            </div>
            <div className="mt-3">
              <Badge variant={driver.is_active ? "default" : "secondary"}>
                {driver.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

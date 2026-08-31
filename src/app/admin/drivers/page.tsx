"use client";

import { useEffect, useMemo, useState } from "react";
import { Bike, Pencil, Plus, Star, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { createStaffAccount } from "@/services/authService";
import {
  fetchDriversFromApi,
  setDriverActiveApi,
  updateDriverApi,
  deleteDriverApi,
} from "@/services/driverPresence";
import { computeDriverEarningsSummary } from "@/services/deliveryService";
import { canAccessAdmin } from "@/lib/auth/config";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
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
import { EmptyState } from "@/components/shared/EmptyState";
import type { DeliveryOrder, Driver, DriverStatus, Order } from "@/types";

const VEHICLE_TYPES = ["Motorcycle", "Bicycle", "Car", "Scooter"] as const;

const statusStyles: Record<DriverStatus, string> = {
  ONLINE: "bg-green/10 text-green",
  OFFLINE: "bg-slate-100 text-muted-foreground",
  BUSY: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-red-50 text-red-600",
};

export default function AdminDriversPage() {
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const drivers = useDataStore((s) => s.drivers);
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const setOrders = useAppStore((s) => s.setOrders);
  const setDeliveries = useAppStore((s) => s.setDeliveries);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("Motorcycle");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("Motorcycle");
  const [editVehicleNumber, setEditVehicleNumber] = useState("");
  const [editLicenseNumber, setEditLicenseNumber] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchDriversFromApi();
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Could not load drivers."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authInitializing || !user || !canAccessAdmin(user.role)) return;

    const refresh = async () => {
      try {
        const res = await fetch("/api/orders", {
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await res.json().catch(() => null)) as {
          orders?: Order[];
          deliveries?: DeliveryOrder[];
        } | null;
        if (!res.ok) return;
        if (Array.isArray(payload?.orders)) setOrders(payload.orders);
        if (Array.isArray(payload?.deliveries)) {
          setDeliveries(payload.deliveries);
        }
      } catch {
        /* ignore background poll errors */
      }
    };

    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [authInitializing, user, setOrders, setDeliveries]);

  const earningsByDriver = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof computeDriverEarningsSummary>
    >();
    for (const driver of drivers) {
      map.set(
        driver.id,
        computeDriverEarningsSummary({ deliveries, orders, driver })
      );
    }
    return map;
  }, [drivers, deliveries, orders]);

  const fleetEarnings = useMemo(() => {
    let lifetime = 0;
    let today = 0;
    let weekly = 0;
    for (const summary of earningsByDriver.values()) {
      lifetime += summary.lifetime;
      today += summary.today;
      weekly += summary.weekly;
    }
    return { lifetime, today, weekly };
  }, [earningsByDriver]);

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

    if (!account.success || !account.profile) {
      setSaving(false);
      toast.error(account.error ?? "Could not create driver account.");
      return;
    }

    try {
      await fetchDriversFromApi();
    } catch {
      /* list refresh best-effort */
    }
    setSaving(false);

    toast.success(
      `Driver "${trimmedName}" created. They can sign in with their email.`
    );
    setDialogOpen(false);
    resetForm();
  };

  const handleToggleActive = async (driverId: string, nextActive: boolean) => {
    setTogglingId(driverId);
    try {
      await setDriverActiveApi(driverId, nextActive);
      toast.success(
        nextActive ? "Driver account activated." : "Driver account deactivated."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update driver."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const openEditDialog = (driver: Driver) => {
    setEditingDriver(driver);
    setEditFullName(driver.profile?.full_name ?? "");
    setEditPhone(driver.profile?.phone ?? "");
    setEditVehicleType(driver.vehicle_type || "Motorcycle");
    setEditVehicleNumber(driver.vehicle_number ?? "");
    setEditLicenseNumber(driver.license_number ?? "");
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    if (savingEdit) return;
    setEditOpen(false);
    setEditingDriver(null);
  };

  const handleSaveEdit = async () => {
    if (!editingDriver) return;
    const trimmedName = editFullName.trim();
    const trimmedPhone = editPhone.trim();

    if (!trimmedName) {
      toast.error("Full name is required.");
      return;
    }
    if (!trimmedPhone) {
      toast.error("Phone number is required.");
      return;
    }
    if (!editVehicleType) {
      toast.error("Vehicle type is required.");
      return;
    }

    setSavingEdit(true);
    try {
      await updateDriverApi(editingDriver.id, {
        fullName: trimmedName,
        phone: trimmedPhone,
        vehicleType: editVehicleType,
        vehicleNumber: editVehicleNumber.trim() || null,
        licenseNumber: editLicenseNumber.trim() || null,
      });
      toast.success("Driver updated.");
      setEditOpen(false);
      setEditingDriver(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update driver."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDriverApi(deleteTarget.id);
      toast.success(
        `Driver "${deleteTarget.profile?.full_name ?? "Driver"}" removed.`
      );
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete driver."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Drivers</h1>
          <p className="text-sm text-muted-foreground">
            Monitor rider availability, earnings, and performance
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Driver
          </DialogTrigger>
          <DialogContent scrollable className="sm:max-w-md">
            <DialogStickyHeader>
              <DialogTitle>Add Driver</DialogTitle>
            </DialogStickyHeader>
            <DialogScrollBody>
            <div className="space-y-4">
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
                  <SelectTrigger className="w-full">
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
            </div>
            </DialogScrollBody>
            <DialogStickyFooter>
              <Button
                className="w-full bg-green hover:bg-green/90 sm:w-auto sm:min-w-[160px]"
                onClick={() => void handleAddDriver()}
                disabled={saving}
              >
                {saving ? "Creating account..." : "Create driver account"}
              </Button>
            </DialogStickyFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent scrollable className="sm:max-w-md">
          <DialogStickyHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogStickyHeader>
          <DialogScrollBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-driver-name">Full Name *</Label>
                <Input
                  id="edit-driver-name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-driver-email">Email</Label>
                <Input
                  id="edit-driver-email"
                  value={editingDriver?.profile?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Email cannot be changed here.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-driver-phone">Phone *</Label>
                <Input
                  id="edit-driver-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div>
                <Label>Vehicle Type *</Label>
                <Select
                  value={editVehicleType}
                  onValueChange={(v) => v && setEditVehicleType(v)}
                >
                  <SelectTrigger className="w-full">
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
                <Label htmlFor="edit-driver-vehicle-no">Vehicle Number</Label>
                <Input
                  id="edit-driver-vehicle-no"
                  value={editVehicleNumber}
                  onChange={(e) => setEditVehicleNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-driver-license">License Number</Label>
                <Input
                  id="edit-driver-license"
                  value={editLicenseNumber}
                  onChange={(e) => setEditLicenseNumber(e.target.value)}
                />
              </div>
            </div>
          </DialogScrollBody>
          <DialogStickyFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              className="bg-green hover:bg-green/90"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit}
            >
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogStickyFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Delete driver?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This permanently removes{" "}
            <span className="font-medium text-navy">
              {deleteTarget?.profile?.full_name ?? "this driver"}
            </span>
            , their login, and driver profile. Past delivery history stays on
            orders but will no longer be linked to this account.
          </p>
          {(earningsByDriver.get(deleteTarget?.id ?? "")?.inProgressCount ??
            0) > 0 && (
            <p className="text-sm text-destructive">
              This driver has active deliveries — complete or reassign them
              first.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={
                deleting ||
                (earningsByDriver.get(deleteTarget?.id ?? "")?.inProgressCount ??
                  0) > 0
              }
            >
              {deleting ? "Deleting…" : "Delete driver"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!loading && drivers.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">
              Fleet earnings (all time)
            </p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {formatCurrency(fleetEarnings.lifetime)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              From completed deliveries only
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">Today</p>
            <p className="mt-1 text-2xl font-bold text-green">
              {formatCurrency(fleetEarnings.today)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">
              This week
            </p>
            <p className="mt-1 text-2xl font-bold text-sky">
              {formatCurrency(fleetEarnings.weekly)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading drivers…</p>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="No drivers yet"
          description="Add a driver account to see them here and assign deliveries."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const earnings = earningsByDriver.get(driver.id);
            return (
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
              <div className="mt-3 rounded-xl border border-green/20 bg-green/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5 text-green" />
                  Earnings (delivered)
                </div>
                <p className="mt-1 text-xl font-bold text-green">
                  {formatCurrency(earnings?.lifetime ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Today {formatCurrency(earnings?.today ?? 0)} · Week{" "}
                  {formatCurrency(earnings?.weekly ?? 0)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {earnings?.completedCount ?? 0} completed
                  {(earnings?.inProgressCount ?? 0) > 0
                    ? ` · ${earnings?.inProgressCount} in progress`
                    : ""}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                <div>
                  <Badge variant={driver.is_active ? "default" : "secondary"}>
                    {driver.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {driver.is_active
                      ? "Can sign in and take deliveries"
                      : "Cannot sign in until reactivated"}
                  </p>
                </div>
                <Switch
                  checked={driver.is_active}
                  disabled={togglingId === driver.id}
                  onCheckedChange={(v) =>
                    void handleToggleActive(driver.id, v === true)
                  }
                  aria-label={
                    driver.is_active ? "Deactivate driver" : "Activate driver"
                  }
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={() => openEditDialog(driver)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(driver)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

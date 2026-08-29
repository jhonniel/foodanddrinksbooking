"use client";

import { useEffect, useState } from "react";
import { Construction, Clock, CalendarDays, Database, Gift, ShieldCheck, Store } from "lucide-react";
import {
  STORE_LOCATION,
  LOYALTY_SETTINGS,
  DELIVERY_CONFIG,
} from "@/data/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  DEFAULT_STORE_HOURS,
  WEEKDAYS,
  formatWeeklySchedule,
  parseStoreHours,
} from "@/lib/storeHours";
import type { AppSettings, StoreHoursSettings } from "@/lib/settings/types";
import {
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_INFO,
} from "@/lib/settings/storeConfig";

export default function AdminSettingsPage() {
  const [storeName, setStoreName] = useState(STORE_LOCATION.name);
  const [storeAddress, setStoreAddress] = useState(STORE_LOCATION.address);
  const [storePhone, setStorePhone] = useState(STORE_LOCATION.phone);
  const [pointsPerPeso, setPointsPerPeso] = useState(
    String(LOYALTY_SETTINGS.points_per_peso)
  );
  const [minRedemption, setMinRedemption] = useState(
    String(LOYALTY_SETTINGS.min_redemption_points)
  );
  const [loyaltyActive, setLoyaltyActive] = useState(LOYALTY_SETTINGS.is_active);
  const [requirePin, setRequirePin] = useState(true);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [baseFee, setBaseFee] = useState(String(DELIVERY_CONFIG.baseFee));
  const [baseKm, setBaseKm] = useState(String(DELIVERY_CONFIG.baseKm));
  const [perKmFee, setPerKmFee] = useState(String(DELIVERY_CONFIG.perKmFee));
  const [radiusKm, setRadiusKm] = useState(String(DELIVERY_CONFIG.radiusKm));
  const [freeAbove, setFreeAbove] = useState(String(DELIVERY_CONFIG.freeAbove));
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [purchaseSoonMode, setPurchaseSoonMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [purchaseSoonSaving, setPurchaseSoonSaving] = useState(false);
  const [storeHoursSettings, setStoreHoursSettings] =
    useState<StoreHoursSettings>(DEFAULT_STORE_HOURS);
  const [storeHoursSaving, setStoreHoursSaving] = useState(false);
  const [storeLat, setStoreLat] = useState(DEFAULT_STORE_INFO.lat);
  const [storeLng, setStoreLng] = useState(DEFAULT_STORE_INFO.lng);
  const [storeInfoSaving, setStoreInfoSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    configured: boolean;
    auth: boolean;
    database: boolean;
    storage: boolean;
    missing: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch("/api/settings", { credentials: "include", cache: "no-store" }),
          fetch("/api/supabase/status", { credentials: "include", cache: "no-store" }),
        ]);
        const json = (await settingsRes.json()) as {
          settings?: AppSettings;
        };
        const status = (await statusRes.json()) as {
          configured: boolean;
          auth: boolean;
          database: boolean;
          storage: boolean;
          missing: string[];
        };
        if (!cancelled) {
          if (!settingsRes.ok) {
            toast.error("Could not load saved settings.");
          }
          setMaintenanceMode(Boolean(json.settings?.maintenance_mode));
          setPurchaseSoonMode(Boolean(json.settings?.purchase_soon_mode));
          setStoreHoursSettings(
            parseStoreHours(json.settings?.store_hours ?? DEFAULT_STORE_HOURS)
          );
          if (json.settings?.store) {
            setStoreName(json.settings.store.name);
            setStoreAddress(json.settings.store.address);
            setStorePhone(json.settings.store.phone);
            setStoreLat(json.settings.store.lat);
            setStoreLng(json.settings.store.lng);
          }
          if (json.settings?.delivery) {
            setBaseFee(String(json.settings.delivery.baseFee));
            setBaseKm(String(json.settings.delivery.baseKm));
            setPerKmFee(String(json.settings.delivery.perKmFee));
            setRadiusKm(String(json.settings.delivery.radiusKm));
            setFreeAbove(String(json.settings.delivery.freeAbove));
          }
          setSupabaseStatus(status);
          setSettingsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load saved settings.");
          setSettingsLoaded(true);
        }
      } finally {
        if (!cancelled) setMaintenanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMaintenanceToggle = async (enabled: boolean) => {
    setMaintenanceSaving(true);
    const previous = maintenanceMode;
    setMaintenanceMode(enabled);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance_mode: enabled }),
      });
      const json = (await res.json()) as {
        error?: string;
        settings?: {
          maintenance_mode?: boolean;
          purchase_soon_mode?: boolean;
        };
      };
      if (!res.ok) {
        setMaintenanceMode(previous);
        toast.error(json.error ?? "Could not update maintenance mode.");
        return;
      }
      setMaintenanceMode(Boolean(json.settings?.maintenance_mode));
      toast.success(
        enabled
          ? "Maintenance mode on — customers see Coming Soon"
          : "Maintenance mode off — storefront is live"
      );
    } catch {
      setMaintenanceMode(previous);
      toast.error("Could not update maintenance mode.");
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handlePurchaseSoonToggle = async (enabled: boolean) => {
    setPurchaseSoonSaving(true);
    const previous = purchaseSoonMode;
    setPurchaseSoonMode(enabled);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_soon_mode: enabled }),
      });
      const json = (await res.json()) as {
        error?: string;
        settings?: {
          maintenance_mode?: boolean;
          purchase_soon_mode?: boolean;
        };
      };
      if (!res.ok) {
        setPurchaseSoonMode(previous);
        toast.error(json.error ?? "Could not update purchase soon mode.");
        return;
      }
      setPurchaseSoonMode(Boolean(json.settings?.purchase_soon_mode));
      toast.success(
        enabled
          ? "Purchase soon on — customers can browse but not checkout"
          : "Purchase soon off — checkout is open"
      );
    } catch {
      setPurchaseSoonMode(previous);
      toast.error("Could not update purchase soon mode.");
    } finally {
      setPurchaseSoonSaving(false);
    }
  };

  const updateDaySchedule = (
    dayKey: number,
    patch: Partial<StoreHoursSettings["schedule"][string]>
  ) => {
    const key = String(dayKey);
    setStoreHoursSettings((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [key]: {
          ...prev.schedule[key],
          ...patch,
        },
      },
    }));
  };

  const handleSaveStoreHours = async () => {
    setStoreHoursSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_hours: storeHoursSettings }),
      });
      const json = (await res.json()) as {
        error?: string;
        settings?: { store_hours?: StoreHoursSettings };
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not save store hours.");
        return;
      }
      const saved = parseStoreHours(json.settings?.store_hours);
      setStoreHoursSettings(saved);
      toast.success("Store hours saved");
    } catch {
      toast.error("Could not save store hours.");
    } finally {
      setStoreHoursSaving(false);
    }
  };

  const handleSaveStoreInfo = async () => {
    const trimmedName = storeName.trim();
    const trimmedAddress = storeAddress.trim();
    const trimmedPhone = storePhone.trim();

    if (!trimmedName || !trimmedAddress || !trimmedPhone) {
      toast.error("Store name, address, and phone are required.");
      return;
    }

    const baseFeeNum = Number(baseFee);
    const baseKmNum = Number(baseKm);
    const perKmFeeNum = Number(perKmFee);
    const radiusKmNum = Number(radiusKm);
    const freeAboveNum = Number(freeAbove);

    if (
      [baseFeeNum, baseKmNum, perKmFeeNum, radiusKmNum, freeAboveNum].some(
        (n) => !Number.isFinite(n) || n < 0
      ) ||
      baseKmNum <= 0 ||
      radiusKmNum <= 0
    ) {
      toast.error("Check delivery fee fields — numbers must be valid.");
      return;
    }

    setStoreInfoSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: {
            name: trimmedName,
            address: trimmedAddress,
            phone: trimmedPhone,
            lat: storeLat,
            lng: storeLng,
            hours: formatWeeklySchedule(storeHoursSettings),
          },
          delivery: {
            ...DEFAULT_DELIVERY_SETTINGS,
            baseFee: baseFeeNum,
            baseKm: baseKmNum,
            perKmFee: perKmFeeNum,
            radiusKm: radiusKmNum,
            freeAbove: freeAboveNum,
          },
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        settings?: AppSettings;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not save store info.");
        return;
      }
      if (json.settings?.store) {
        setStoreName(json.settings.store.name);
        setStoreAddress(json.settings.store.address);
        setStorePhone(json.settings.store.phone);
        setStoreLat(json.settings.store.lat);
        setStoreLng(json.settings.store.lng);
      }
      if (json.settings?.delivery) {
        setBaseFee(String(json.settings.delivery.baseFee));
        setBaseKm(String(json.settings.delivery.baseKm));
        setPerKmFee(String(json.settings.delivery.perKmFee));
        setRadiusKm(String(json.settings.delivery.radiusKm));
        setFreeAbove(String(json.settings.delivery.freeAbove));
      }
      toast.success("Store info saved");
    } catch {
      toast.error("Could not save store info.");
    } finally {
      setStoreInfoSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Store configuration and system preferences
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-green" />
            <h2 className="text-lg font-semibold text-navy">Supabase</h2>
          </div>
          {!supabaseStatus ? (
            <p className="text-sm text-muted-foreground">Checking connection…</p>
          ) : (
            <div className="space-y-3">
              <ul className="space-y-2 text-sm">
                {(
                  [
                    ["Auth / login", supabaseStatus.configured && supabaseStatus.auth],
                    ["Database / catalog", supabaseStatus.configured && supabaseStatus.database],
                    ["Storage / S3 images", supabaseStatus.storage],
                  ] as const
                ).map(([label, ok]) => (
                  <li
                    key={label}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <span>{label}</span>
                    <span
                      className={
                        ok
                          ? "font-medium text-green"
                          : "font-medium text-amber-700"
                      }
                    >
                      {ok ? "Connected" : "Not ready"}
                    </span>
                  </li>
                ))}
              </ul>
              {supabaseStatus.missing.length > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p className="font-medium">Still needed:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {supabaseStatus.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {supabaseStatus.configured &&
                supabaseStatus.auth &&
                supabaseStatus.database &&
                supabaseStatus.storage && (
                  <p className="text-xs text-muted-foreground">
                    Login, catalog, and S3 image uploads use this project.
                  </p>
                )}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Construction className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-navy">
              Maintenance / Coming Soon
            </h2>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="maintenance-mode">Enable maintenance mode</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Shows the Coming Soon page to customers. Staff and drivers can
                still sign in and use Admin / Driver apps.
              </p>
            </div>
            <Switch
              id="maintenance-mode"
              checked={maintenanceMode}
              disabled={maintenanceLoading || maintenanceSaving}
              onCheckedChange={(v) => void handleMaintenanceToggle(v)}
            />
          </div>
          {maintenanceMode && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Live now — public visitors are redirected to{" "}
              <span className="font-semibold">/maintenance</span>.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-sky" />
            <h2 className="text-lg font-semibold text-navy">Purchase Soon</h2>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="purchase-soon-mode">Pause checkout for all menu items</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Customers can still browse the menu and add items to cart, but
                checkout and placing orders are disabled until you turn this off.
              </p>
            </div>
            <Switch
              id="purchase-soon-mode"
              checked={purchaseSoonMode}
              disabled={maintenanceLoading || purchaseSoonSaving}
              onCheckedChange={(v) => void handlePurchaseSoonToggle(v)}
            />
          </div>
          {purchaseSoonMode && (
            <p className="mt-3 rounded-lg bg-sky/10 px-3 py-2 text-xs text-navy">
              Live now — the menu stays visible and checkout is blocked for
              customers.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-green" />
            <h2 className="text-lg font-semibold text-navy">Store Hours</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="store-hours-enabled">Enforce opening schedule</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  When on, customers can browse anytime but checkout is only
                  available during the hours you set below.
                </p>
              </div>
              <Switch
                id="store-hours-enabled"
                checked={storeHoursSettings.enabled}
                disabled={maintenanceLoading || storeHoursSaving}
                onCheckedChange={(enabled) =>
                  setStoreHoursSettings((prev) => ({ ...prev, enabled }))
                }
              />
            </div>

            <div className="space-y-2">
              {WEEKDAYS.map((day) => {
                const key = String(day.key);
                const daySchedule = storeHoursSettings.schedule[key];
                return (
                  <div
                    key={day.key}
                    className="grid gap-3 rounded-xl border border-border/60 px-3 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                  >
                    <div className="flex items-center justify-between gap-3 sm:justify-start">
                      <span className="text-sm font-medium text-navy">
                        {day.label}
                      </span>
                      <Switch
                        checked={daySchedule.enabled}
                        disabled={maintenanceLoading || storeHoursSaving}
                        onCheckedChange={(enabled) =>
                          updateDaySchedule(day.key, { enabled })
                        }
                        aria-label={`${day.label} open`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`open-${day.key}`} className="sr-only">
                        {day.label} open
                      </Label>
                      <Input
                        id={`open-${day.key}`}
                        type="time"
                        value={daySchedule.open}
                        disabled={
                          !daySchedule.enabled ||
                          maintenanceLoading ||
                          storeHoursSaving
                        }
                        onChange={(e) =>
                          updateDaySchedule(day.key, { open: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`close-${day.key}`} className="sr-only">
                        {day.label} close
                      </Label>
                      <Input
                        id={`close-${day.key}`}
                        type="time"
                        value={daySchedule.close}
                        disabled={
                          !daySchedule.enabled ||
                          maintenanceLoading ||
                          storeHoursSaving
                        }
                        onChange={(e) =>
                          updateDaySchedule(day.key, { close: e.target.value })
                        }
                      />
                    </div>
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {daySchedule.enabled ? "Open" : "Closed"}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Schedule preview: {formatWeeklySchedule(storeHoursSettings)} (
              {storeHoursSettings.timezone})
            </p>

            <Button
              className="w-full bg-green hover:bg-green/90"
              disabled={maintenanceLoading || storeHoursSaving}
              onClick={() => void handleSaveStoreHours()}
            >
              {storeHoursSaving ? "Saving hours..." : "Save Store Hours"}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Store className="h-5 w-5 text-sky" />
            <h2 className="text-lg font-semibold text-navy">Store Info</h2>
          </div>
          <div className="space-y-4">
            {!settingsLoaded ? (
              <p className="text-sm text-muted-foreground">Loading saved store info…</p>
            ) : null}
            <div>
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                value={storeName}
                disabled={!settingsLoaded || storeInfoSaving}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="store-address">Address</Label>
              <Input
                id="store-address"
                value={storeAddress}
                disabled={!settingsLoaded || storeInfoSaving}
                onChange={(e) => setStoreAddress(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="store-phone">Phone</Label>
                <Input
                  id="store-phone"
                  value={storePhone}
                  disabled={!settingsLoaded || storeInfoSaving}
                  onChange={(e) => setStorePhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="base-fee">First-km fee (₱)</Label>
                <Input
                  id="base-fee"
                  type="number"
                  value={baseFee}
                  disabled={!settingsLoaded || storeInfoSaving}
                  onChange={(e) => setBaseFee(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="base-km">Included km</Label>
                <Input
                  id="base-km"
                  type="number"
                  value={baseKm}
                  disabled={!settingsLoaded || storeInfoSaving}
                  onChange={(e) => setBaseKm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="per-km">Succeeding km (₱)</Label>
                <Input
                  id="per-km"
                  type="number"
                  value={perKmFee}
                  disabled={!settingsLoaded || storeInfoSaving}
                  onChange={(e) => setPerKmFee(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="radius-km">Max radius (km)</Label>
                <Input
                  id="radius-km"
                  type="number"
                  value={radiusKm}
                  disabled={!settingsLoaded || storeInfoSaving}
                  onChange={(e) => setRadiusKm(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="free-above">Free delivery above (₱)</Label>
                <Input
                  id="free-above"
                  type="number"
                  value={freeAbove}
                  disabled={!settingsLoaded || storeInfoSaving}
                  onChange={(e) => setFreeAbove(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ₱{baseFee} for the first {baseKm} km, then ₱{perKmFee} per
              succeeding km (rounded up). Opening hours come from the Store
              Hours section above.
            </p>
            <Button
              className="w-full bg-green hover:bg-green/90"
              disabled={!settingsLoaded || maintenanceLoading || storeInfoSaving}
              onClick={() => void handleSaveStoreInfo()}
            >
              {storeInfoSaving ? "Saving store info..." : "Save Store Info"}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-green" />
            <h2 className="text-lg font-semibold text-navy">Loyalty Program</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="loyalty-active">Program Active</Label>
              <Switch
                id="loyalty-active"
                checked={loyaltyActive}
                onCheckedChange={setLoyaltyActive}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="points-per-peso">Points per ₱1 spent</Label>
                <Input
                  id="points-per-peso"
                  type="number"
                  value={pointsPerPeso}
                  onChange={(e) => setPointsPerPeso(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="min-redemption">Min redemption (pts)</Label>
                <Input
                  id="min-redemption"
                  type="number"
                  value={minRedemption}
                  onChange={(e) => setMinRedemption(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky" />
            <h2 className="text-lg font-semibold text-navy">Proof of Delivery</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="require-pin">Require delivery PIN</Label>
                <p className="text-xs text-muted-foreground">
                  Driver must enter customer PIN before completing delivery
                </p>
              </div>
              <Switch
                id="require-pin"
                checked={requirePin}
                onCheckedChange={setRequirePin}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="require-photo">Require photo proof</Label>
                <p className="text-xs text-muted-foreground">
                  Driver must capture a photo at delivery location
                </p>
              </div>
              <Switch
                id="require-photo"
                checked={requirePhoto}
                onCheckedChange={setRequirePhoto}
              />
            </div>
          </div>
        </section>

        <Button
          className="w-full bg-green hover:bg-green/90"
          size="lg"
          disabled={!settingsLoaded || storeInfoSaving}
          onClick={() => void handleSaveStoreInfo()}
        >
          {storeInfoSaving ? "Saving..." : "Save Store Info"}
        </Button>
      </div>
    </div>
  );
}

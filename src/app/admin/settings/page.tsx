"use client";

import { useEffect, useState } from "react";
import { Construction, Database, Gift, ShieldCheck, Store } from "lucide-react";
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

export default function AdminSettingsPage() {
  const [storeName, setStoreName] = useState(STORE_LOCATION.name);
  const [storeAddress, setStoreAddress] = useState(STORE_LOCATION.address);
  const [storePhone, setStorePhone] = useState(STORE_LOCATION.phone);
  const [storeHours, setStoreHours] = useState(STORE_LOCATION.hours);
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
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
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
          fetch("/api/settings", { credentials: "include" }),
          fetch("/api/supabase/status", { credentials: "include" }),
        ]);
        const json = (await settingsRes.json()) as {
          settings?: { maintenance_mode?: boolean };
        };
        const status = (await statusRes.json()) as {
          configured: boolean;
          auth: boolean;
          database: boolean;
          storage: boolean;
          missing: string[];
        };
        if (!cancelled) {
          setMaintenanceMode(Boolean(json.settings?.maintenance_mode));
          setSupabaseStatus(status);
        }
      } catch {
        /* ignore */
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
        settings?: { maintenance_mode?: boolean };
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

  const handleSave = () => {
    toast.success("Settings saved");
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
            <Store className="h-5 w-5 text-sky" />
            <h2 className="text-lg font-semibold text-navy">Store Info</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="store-address">Address</Label>
              <Input
                id="store-address"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="store-phone">Phone</Label>
                <Input
                  id="store-phone"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="store-hours">Hours</Label>
                <Input
                  id="store-hours"
                  value={storeHours}
                  onChange={(e) => setStoreHours(e.target.value)}
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
                  onChange={(e) => setBaseFee(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="base-km">Included km</Label>
                <Input
                  id="base-km"
                  type="number"
                  value={baseKm}
                  onChange={(e) => setBaseKm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="per-km">Succeeding km (₱)</Label>
                <Input
                  id="per-km"
                  type="number"
                  value={perKmFee}
                  onChange={(e) => setPerKmFee(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="radius-km">Max radius (km)</Label>
                <Input
                  id="radius-km"
                  type="number"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="free-above">Free delivery above (₱)</Label>
                <Input
                  id="free-above"
                  type="number"
                  value={freeAbove}
                  onChange={(e) => setFreeAbove(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ₱{baseFee} for the first {baseKm} km, then ₱{perKmFee} per
              succeeding km (rounded up).
            </p>
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
          onClick={handleSave}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}

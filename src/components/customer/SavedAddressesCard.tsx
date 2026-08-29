"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Plus, Trash2, Loader2, Star, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationPinMap } from "@/components/customer/LocationPinMap";
import {
  reverseGeocodeClient,
  searchAddressClient,
} from "@/lib/geocoding/client";
import type { GeocodeSearchResult } from "@/lib/geocoding/types";
import type { LatLng } from "@/lib/delivery/pricing";
import {
  isWithinSamalIsland,
  SAMAL_MAP_CENTER,
  SAMAL_SERVICE_MESSAGE,
} from "@/lib/delivery/samal";
import type { Address } from "@/types";

const MAX_ADDRESSES = 3;

type FormState = {
  label: string;
  fullAddress: string;
  barangay: string;
  city: string;
  deliveryInstructions: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
};

const emptyForm = (): FormState => ({
  label: "Home",
  fullAddress: "",
  barangay: "",
  city: "Island Garden City of Samal",
  deliveryInstructions: "",
  isDefault: false,
  latitude: SAMAL_MAP_CENTER.lat,
  longitude: SAMAL_MAP_CENTER.lng,
});

function toForm(addr: Address): FormState {
  return {
    label: addr.label,
    fullAddress: addr.full_address,
    barangay: addr.barangay ?? "",
    city: addr.city ?? "Island Garden City of Samal",
    deliveryInstructions: addr.delivery_instructions ?? "",
    isDefault: addr.is_default,
    latitude: addr.latitude ?? SAMAL_MAP_CENTER.lat,
    longitude: addr.longitude ?? SAMAL_MAP_CENTER.lng,
  };
}

export function SavedAddressesCard() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipReverseRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/addresses", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        addresses?: Address[];
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not load addresses.");
        setAddresses([]);
        return;
      }
      setAddresses(data?.addresses ?? []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyGeocodedAddress = useCallback(
    (result: {
      fullAddress: string;
      barangay: string | null;
      city: string | null;
      latitude: number;
      longitude: number;
    }) => {
      skipReverseRef.current = true;
      setForm((f) => ({
        ...f,
        fullAddress: result.fullAddress || f.fullAddress,
        barangay: result.barangay ?? f.barangay,
        city: result.city ?? f.city ?? "Island Garden City of Samal",
        latitude: result.latitude,
        longitude: result.longitude,
      }));
      window.setTimeout(() => {
        skipReverseRef.current = false;
      }, 0);
    },
    []
  );

  const reverseGeocodePin = useCallback(
    async (coords: LatLng) => {
      setGeocoding(true);
      try {
        const address = await reverseGeocodeClient(coords);
        if (address) {
          applyGeocodedAddress(address);
        }
      } finally {
        setGeocoding(false);
      }
    },
    [applyGeocodedAddress]
  );

  const handlePinChange = useCallback(
    (next: LatLng) => {
      setForm((f) => ({
        ...f,
        latitude: next.lat,
        longitude: next.lng,
      }));
      if (skipReverseRef.current) return;
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      reverseTimerRef.current = setTimeout(() => {
        void reverseGeocodePin(next);
      }, 450);
    },
    [reverseGeocodePin]
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const results = await searchAddressClient(value, {
            lat: form.latitude ?? SAMAL_MAP_CENTER.lat,
            lng: form.longitude ?? SAMAL_MAP_CENTER.lng,
          });
          setSearchResults(results);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 350);
  };

  const selectSearchResult = (result: GeocodeSearchResult) => {
    applyGeocodedAddress(result);
    setSearchQuery(result.fullAddress);
    setSearchResults([]);
  };

  useEffect(() => {
    return () => {
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const openAdd = () => {
    if (addresses.length >= MAX_ADDRESSES) {
      toast.error(`You can save up to ${MAX_ADDRESSES} addresses.`);
      return;
    }
    setEditing(null);
    setForm({
      ...emptyForm(),
      isDefault: addresses.length === 0,
      label: addresses.length === 0 ? "Home" : "Other",
    });
    setSearchQuery("");
    setSearchResults([]);
    setDialogOpen(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setForm(toForm(addr));
    setSearchQuery(addr.full_address);
    setSearchResults([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const label = form.label.trim();
    const fullAddress = form.fullAddress.trim();
    if (label.length < 1) {
      toast.error("Enter a label (e.g. Home, Office).");
      return;
    }
    if (fullAddress.length < 5) {
      toast.error("Enter a full delivery address.");
      return;
    }
    if (
      form.latitude == null ||
      form.longitude == null ||
      !isWithinSamalIsland(form.latitude, form.longitude)
    ) {
      toast.error(SAMAL_SERVICE_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      const body = {
        label,
        fullAddress,
        barangay: form.barangay.trim() || null,
        city: form.city.trim() || "Island Garden City of Samal",
        province: "Davao del Norte",
        deliveryInstructions: form.deliveryInstructions.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
        isDefault: form.isDefault,
      };

      const res = await fetch(
        editing ? `/api/me/addresses/${editing.id}` : "/api/me/addresses",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not save address.");
        return;
      }
      toast.success(editing ? "Address updated." : "Address saved.");
      setDialogOpen(false);
      await refresh();
    } catch {
      toast.error("Could not save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addr: Address) => {
    if (
      !window.confirm(
        `Remove “${addr.label}”? You can add it again later (max ${MAX_ADDRESSES}).`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/me/addresses/${addr.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not delete address.");
        return;
      }
      toast.success("Address removed.");
      await refresh();
    } catch {
      toast.error("Could not delete address.");
    }
  };

  const atLimit = addresses.length >= MAX_ADDRESSES;

  return (
    <>
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-navy">Saved Addresses</h2>
            <p className="text-xs text-muted-foreground">
              Up to {MAX_ADDRESSES} delivery addresses on Samal Island
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={atLimit || loading}
            onClick={openAdd}
            className="rounded-xl bg-green hover:bg-green/90 disabled:opacity-40"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : addresses.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl bg-surface px-3 py-4 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
            <span>
              No saved addresses yet. Add one for faster checkout.
            </span>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {addresses.map((addr) => (
              <li
                key={addr.id}
                className="rounded-xl border border-border/70 bg-surface/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy">{addr.label}</p>
                      {addr.is_default && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky">
                          <Star className="h-2.5 w-2.5" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {addr.full_address}
                    </p>
                    {(addr.barangay || addr.city) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[addr.barangay, addr.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {addr.latitude != null &&
                      addr.longitude != null &&
                      !isWithinSamalIsland(addr.latitude, addr.longitude) && (
                        <p className="mt-1 text-[11px] font-medium text-destructive">
                          Outside service area — edit pin
                        </p>
                      )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${addr.label}`}
                      onClick={() => openEdit(addr)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/70 hover:bg-white hover:text-navy"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${addr.label}`}
                      onClick={() => void handleDelete(addr)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/80 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {atLimit && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Maximum of {MAX_ADDRESSES} addresses reached. Edit or remove one to
            add another.
          </p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent scrollable className="sm:max-w-md">
          <DialogStickyHeader>
            <DialogTitle>
              {editing ? "Edit address" : "Add address"}
            </DialogTitle>
          </DialogStickyHeader>
          <DialogScrollBody>
          <div className="space-y-3">
            <div>
              <Label htmlFor="addr-label">Label</Label>
              <Input
                id="addr-label"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="Home, Office, Condo…"
                className="mt-1.5"
              />
            </div>
            <div className="relative">
              <Label htmlFor="addr-search">Search address</Label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="addr-search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Street, barangay, landmark on Samal…"
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {searchResults.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-card">
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => selectSearchResult(result)}
                      >
                        <span className="font-medium text-navy">
                          {result.fullAddress}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pick a result or use your location — the pin and address fill in
                automatically.
              </p>
            </div>
            <div>
              <Label htmlFor="addr-full">Full address</Label>
              <Textarea
                id="addr-full"
                value={form.fullAddress}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fullAddress: e.target.value }))
                }
                placeholder="Filled automatically from your pin or search"
                className="mt-1.5 min-h-[80px] rounded-xl"
              />
              {geocoding && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up address for this pin…
                </p>
              )}
            </div>
            <div>
              <Label>Delivery pin</Label>
              <div className="mt-1.5">
                <LocationPinMap
                  key={editing ? `edit-${editing.id}` : "add-address"}
                  value={
                    form.latitude != null && form.longitude != null
                      ? { lat: form.latitude, lng: form.longitude }
                      : SAMAL_MAP_CENTER
                  }
                  onChange={handlePinChange}
                  autoLocateOnMount={!editing}
                  heightClassName="h-52"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="addr-brgy">Barangay</Label>
                <Input
                  id="addr-brgy"
                  value={form.barangay}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, barangay: e.target.value }))
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="addr-city">City</Label>
                <Input
                  id="addr-city"
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="addr-notes">Delivery notes</Label>
              <Textarea
                id="addr-notes"
                value={form.deliveryInstructions}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryInstructions: e.target.value,
                  }))
                }
                placeholder="Gate code, floor, landmarks…"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isDefault: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border"
              />
              Set as default address
            </label>
          </div>
          </DialogScrollBody>
          <DialogStickyFooter>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="h-11 w-full rounded-xl bg-green hover:bg-green/90 sm:w-auto sm:min-w-[140px]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editing ? (
                "Save changes"
              ) : (
                "Save address"
              )}
            </Button>
          </DialogStickyFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

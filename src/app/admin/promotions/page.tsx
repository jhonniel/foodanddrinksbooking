"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Promotion, PromotionType } from "@/types";

function defaultEndsAtLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return defaultEndsAtLocal();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

export default function AdminPromotionsPage() {
  const addPromotion = useDataStore((s) => s.addPromotion);
  const updatePromotionLocal = useDataStore((s) => s.updatePromotion);
  const deletePromotionLocal = useDataStore((s) => s.deletePromotion);
  const togglePromotionActiveLocal = useDataStore(
    (s) => s.togglePromotionActive
  );

  const [vouchers, setVouchers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [type, setType] = useState<PromotionType>("FIXED");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/vouchers", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        vouchers?: Promotion[];
        error?: string;
      } | null;
      if (res.ok) {
        setVouchers(data?.vouchers ?? []);
      } else if (res.status === 503) {
        setVouchers(useDataStore.getState().promotions);
      } else {
        toast.error(data?.error || "Could not load promotions.");
        setVouchers([]);
      }
    } catch {
      setVouchers(useDataStore.getState().promotions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPromoCode("");
    setType("FIXED");
    setDiscountValue("");
    setMinOrderAmount("");
    setUsageLimit("");
    setEndsAt("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (promo: Promotion) => {
    setEditing(promo);
    setName(promo.name);
    setDescription(promo.description ?? "");
    setPromoCode(promo.promo_code ?? "");
    setType(promo.type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED");
    setDiscountValue(String(promo.discount_value));
    setMinOrderAmount(
      promo.min_order_amount ? String(promo.min_order_amount) : ""
    );
    setUsageLimit(
      promo.usage_limit != null ? String(promo.usage_limit) : ""
    );
    setEndsAt(promo.ends_at ? toLocalInput(promo.ends_at) : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const code = promoCode.trim().toUpperCase();
    const discount = parseFloat(discountValue);
    const minOrder = minOrderAmount ? parseFloat(minOrderAmount) : 0;
    const limitRaw = usageLimit.trim();
    let limit: number | null = null;
    if (limitRaw) {
      const parsed = parseInt(limitRaw, 10);
      if (isNaN(parsed) || parsed < 1) {
        toast.error("Enter a valid redeem limit (at least 1), or leave empty.");
        return;
      }
      limit = parsed;
    }

    if (!trimmedName) {
      toast.error("Promotion name is required.");
      return;
    }
    if (!code || code.length < 3) {
      toast.error("Enter a custom code (at least 3 characters).");
      return;
    }
    if (!discountValue || isNaN(discount) || discount <= 0) {
      toast.error("Enter a valid discount value greater than zero.");
      return;
    }
    if (type === "PERCENTAGE" && discount > 100) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }

    let endsIso: string | null = null;
    if (endsAt.trim()) {
      const ends = new Date(endsAt);
      if (!Number.isFinite(ends.getTime())) {
        toast.error("Invalid expiration date.");
        return;
      }
      if (!editing && ends <= new Date()) {
        toast.error("Expiration must be in the future.");
        return;
      }
      endsIso = ends.toISOString();
    }

    if (minOrderAmount && (isNaN(minOrder) || minOrder < 0)) {
      toast.error("Enter a valid minimum order amount.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        if (isUuid(editing.id)) {
          const res = await fetch(`/api/admin/vouchers/${editing.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: trimmedName,
              description: description.trim() || null,
              promoCode: code,
              type,
              discountValue: discount,
              minOrderAmount: minOrder || 0,
              usageLimit: limit,
              endsAt: endsIso,
            }),
          });
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (!res.ok) {
            toast.error(data?.error || "Could not update promotion.");
            return;
          }
          toast.success(`Voucher ${code} updated.`);
          setDialogOpen(false);
          resetForm();
          await refresh();
          return;
        }

        updatePromotionLocal(editing.id, {
          name: trimmedName,
          description: description.trim() || null,
          promo_code: code,
          type,
          discount_value: discount,
          min_order_amount: minOrder || 0,
          usage_limit: limit,
          ends_at: endsIso,
        });
        toast.success(`Voucher ${code} updated.`);
        setDialogOpen(false);
        resetForm();
        setVouchers(useDataStore.getState().promotions);
        return;
      }

      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          promoCode: code,
          type,
          discountValue: discount,
          minOrderAmount: minOrder || 0,
          usageLimit: limit,
          endsAt: endsIso,
          perCustomerLimit: 1,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        voucher?: Promotion;
        error?: string;
      } | null;

      if (res.ok && data?.voucher) {
        toast.success(`Voucher ${code} created.`);
        setDialogOpen(false);
        resetForm();
        await refresh();
        return;
      }

      if (res.status === 503) {
        addPromotion({
          name: trimmedName,
          description: description.trim() || undefined,
          promoCode: code,
          type,
          discountValue: discount,
          minOrderAmount: minOrder || 0,
          usageLimit: limit,
          endsAt: endsIso ?? undefined,
          perCustomerLimit: 1,
        });
        toast.success(
          `Voucher ${code} saved locally (configure Supabase for production).`
        );
        setDialogOpen(false);
        resetForm();
        setVouchers(useDataStore.getState().promotions);
        return;
      }

      toast.error(data?.error || "Could not create promotion.");
    } catch {
      toast.error("Could not save promotion.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo: Promotion) => {
    if (
      !window.confirm(
        `Delete voucher “${promo.promo_code ?? promo.name}”? This cannot be undone.`
      )
    ) {
      return;
    }

    if (!isUuid(promo.id)) {
      deletePromotionLocal(promo.id);
      setVouchers(useDataStore.getState().promotions);
      toast.success(`"${promo.name}" deleted.`);
      return;
    }

    try {
      const res = await fetch(`/api/admin/vouchers/${promo.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not delete promotion.");
        return;
      }
      toast.success(`"${promo.name}" deleted.`);
      await refresh();
    } catch {
      toast.error("Could not delete promotion.");
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    if (!isUuid(promo.id)) {
      togglePromotionActiveLocal(promo.id);
      setVouchers(useDataStore.getState().promotions);
      toast.success(
        `"${promo.name}" is now ${!promo.is_active ? "active" : "inactive"}.`
      );
      return;
    }

    try {
      const res = await fetch(`/api/admin/vouchers/${promo.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.is_active }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not update promotion.");
        return;
      }
      toast.success(
        `"${promo.name}" is now ${!promo.is_active ? "active" : "inactive"}.`
      );
      await refresh();
    } catch {
      toast.error("Could not update promotion.");
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Create, update, or delete vouchers. Customers claim them on Rewards.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <Button
            type="button"
            onClick={openCreate}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Create Voucher
          </Button>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Voucher" : "Create Voucher"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="promo-name">Name *</Label>
                <Input
                  id="promo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Weekend Cooler Deal"
                />
              </div>
              <div>
                <Label htmlFor="promo-desc">Description</Label>
                <Textarea
                  id="promo-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Claim on Rewards, then use in Cart"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="promo-code">Custom code *</Label>
                <Input
                  id="promo-code"
                  value={promoCode}
                  onChange={(e) =>
                    setPromoCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  placeholder="SAMAL50"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <Label>Discount type *</Label>
                <Select
                  value={type}
                  onValueChange={(v) => v && setType(v as PromotionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed amount (₱)</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="promo-discount">
                  Discount * ({type === "PERCENTAGE" ? "%" : "₱"})
                </Label>
                <Input
                  id="promo-discount"
                  type="number"
                  min="0"
                  step={type === "PERCENTAGE" ? "1" : "0.01"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={type === "PERCENTAGE" ? "10" : "50"}
                />
              </div>
              <div>
                <Label htmlFor="promo-limit">How many can redeem (optional)</Label>
                <Input
                  id="promo-limit"
                  type="number"
                  min="1"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  placeholder="Unlimited"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave empty for unlimited redemptions.
                </p>
              </div>
              <div>
                <Label htmlFor="promo-ends">Expiration (optional)</Label>
                <Input
                  id="promo-ends"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave empty if this voucher should never expire.
                </p>
                {endsAt && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-sky hover:underline"
                    onClick={() => setEndsAt("")}
                  >
                    Clear expiration
                  </button>
                )}
              </div>
              <div>
                <Label htmlFor="promo-min">Minimum order (₱)</Label>
                <Input
                  id="promo-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editing ? (
                  "Save Changes"
                ) : (
                  "Save Voucher"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : vouchers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-sky" />
          <p className="mt-3 font-semibold text-navy">No vouchers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a voucher with a custom code. Redeem limit and expiration are
            optional.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vouchers.map((promo) => {
            const expired =
              promo.ends_at != null && new Date(promo.ends_at) < new Date();
            const soldOut =
              promo.usage_limit != null &&
              promo.usage_count >= promo.usage_limit;
            return (
              <div
                key={promo.id}
                className="rounded-2xl bg-white p-5 shadow-card"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-light-blue">
                      <Megaphone className="h-6 w-6 text-sky" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-navy">
                          {promo.name}
                        </h3>
                        <Badge className="bg-green font-mono">
                          {promo.promo_code}
                        </Badge>
                        <Badge
                          variant={
                            promo.is_active && !expired && !soldOut
                              ? "default"
                              : "secondary"
                          }
                        >
                          {!promo.is_active
                            ? "Inactive"
                            : expired
                              ? "Expired"
                              : soldOut
                                ? "Fully claimed"
                                : "Active"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {promo.description || "Claimable voucher"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <span>
                          Discount:{" "}
                          {promo.type === "PERCENTAGE"
                            ? `${promo.discount_value}%`
                            : formatCurrency(promo.discount_value ?? 0)}
                        </span>
                        {promo.min_order_amount > 0 && (
                          <span>
                            Min order: {formatCurrency(promo.min_order_amount)}
                          </span>
                        )}
                        <span>
                          Claims: {promo.usage_count}
                          {promo.usage_limit != null
                            ? ` / ${promo.usage_limit}`
                            : " · unlimited"}
                        </span>
                        <span>
                          {promo.ends_at
                            ? `Expires: ${formatDate(promo.ends_at)}`
                            : "Never expires"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${promo.name}`}
                      onClick={() => openEdit(promo)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/70 hover:bg-muted hover:text-navy"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${promo.name}`}
                      onClick={() => void handleDelete(promo)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/80 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <Label htmlFor={`promo-${promo.id}`}>Enabled</Label>
                    <Switch
                      id={`promo-${promo.id}`}
                      checked={promo.is_active}
                      onCheckedChange={() => void handleToggleActive(promo)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

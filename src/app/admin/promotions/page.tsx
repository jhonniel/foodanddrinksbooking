"use client";

import { useState } from "react";
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
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PromoKind, Promotion, PromotionType, VoucherRedemptionMode } from "@/types";
import {
  promoKindHint,
  promoKindLabel,
} from "@/lib/vouchers/promoKind";
import {
  redemptionModeHint,
  redemptionModeLabel,
} from "@/lib/vouchers/redemptionMode";
import {
  requestServerDataSync,
  syncAllDataFromServer,
} from "@/services/dataSyncService";

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
  const vouchers = useDataStore((s) => s.promotions);
  const hydrated = useDataStore((s) => s.hydrated);
  const addPromotion = useDataStore((s) => s.addPromotion);
  const updatePromotionLocal = useDataStore((s) => s.updatePromotion);
  const deletePromotionLocal = useDataStore((s) => s.deletePromotion);
  const togglePromotionActiveLocal = useDataStore(
    (s) => s.togglePromotionActive
  );

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
  const [kind, setKind] = useState<PromoKind>("VOUCHER");
  const [redemptionMode, setRedemptionMode] =
    useState<VoucherRedemptionMode>("CLAIM");

  const pullPromotions = async () => {
    await syncAllDataFromServer();
    requestServerDataSync();
  };

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
    setKind("VOUCHER");
    setRedemptionMode("CLAIM");
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
    setKind(promo.kind ?? "VOUCHER");
    setRedemptionMode(promo.redemption_mode ?? "CLAIM");
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
      toast.error("Name is required.");
      return;
    }
    if (kind === "VOUCHER" && (!code || code.length < 3)) {
      toast.error("Vouchers require a custom code (at least 3 characters).");
      return;
    }
    if (kind === "PROMOTION" && code && code.length < 3) {
      toast.error("If you add a code, use at least 3 characters.");
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
              promoCode: code || null,
              type,
              discountValue: discount,
              minOrderAmount: minOrder || 0,
              usageLimit: limit,
              endsAt: endsIso,
              redemptionMode: kind === "VOUCHER" ? redemptionMode : "MANUAL",
              kind,
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
          await pullPromotions();
          return;
        }

        updatePromotionLocal(editing.id, {
          name: trimmedName,
          description: description.trim() || null,
          promo_code: code || null,
          type,
          discount_value: discount,
          min_order_amount: minOrder || 0,
          usage_limit: limit,
          ends_at: endsIso,
          redemption_mode: kind === "VOUCHER" ? redemptionMode : "MANUAL",
          kind,
        });
        toast.success(`Voucher ${code} updated.`);
        setDialogOpen(false);
        resetForm();
        requestServerDataSync();
        return;
      }

      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          promoCode: code || null,
          type,
          discountValue: discount,
          minOrderAmount: minOrder || 0,
          usageLimit: limit,
          endsAt: endsIso,
          perCustomerLimit: 1,
          redemptionMode: kind === "VOUCHER" ? redemptionMode : "MANUAL",
          kind,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        voucher?: Promotion;
        error?: string;
      } | null;

      if (res.ok && data?.voucher) {
        toast.success(
          `${kind === "PROMOTION" ? "Promotion" : "Voucher"} "${trimmedName}" created.`
        );
        setDialogOpen(false);
        resetForm();
        await pullPromotions();
        return;
      }

      if (res.status === 503) {
        addPromotion({
          name: trimmedName,
          description: description.trim() || undefined,
          promoCode: code || undefined,
          type,
          discountValue: discount,
          minOrderAmount: minOrder || 0,
          usageLimit: limit,
          endsAt: endsIso ?? undefined,
          perCustomerLimit: 1,
          redemptionMode: kind === "VOUCHER" ? redemptionMode : "MANUAL",
          kind,
        });
        toast.success(
          `${kind === "PROMOTION" ? "Promotion" : "Voucher"} saved locally (configure Supabase for production).`
        );
        setDialogOpen(false);
        resetForm();
        requestServerDataSync();
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
      requestServerDataSync();
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
      await pullPromotions();
    } catch {
      toast.error("Could not delete promotion.");
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    if (!isUuid(promo.id)) {
      togglePromotionActiveLocal(promo.id);
      requestServerDataSync();
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
      await pullPromotions();
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
            Create vouchers for Rewards redemption or promotions for the home
            page.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <Button
            type="button"
            onClick={openCreate}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
          <DialogContent scrollable className="sm:max-w-md">
            <DialogStickyHeader>
              <DialogTitle>
                {editing
                  ? kind === "PROMOTION"
                    ? "Edit Promotion"
                    : "Edit Voucher"
                  : kind === "PROMOTION"
                    ? "Create Promotion"
                    : "Create Voucher"}
              </DialogTitle>
            </DialogStickyHeader>
            <DialogScrollBody>
            <div className="space-y-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => v && setKind(v as PromoKind)}
                  disabled={Boolean(editing)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VOUCHER">Voucher</SelectItem>
                    <SelectItem value="PROMOTION">Promotion</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {promoKindHint(kind)}
                </p>
              </div>
              <div>
                <Label htmlFor="promo-name">Name *</Label>
                <Input
                  id="promo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    kind === "PROMOTION"
                      ? "Summer drink specials on the home page"
                      : "Weekend Cooler Deal"
                  }
                />
              </div>
              <div>
                <Label htmlFor="promo-desc">Description</Label>
                <Textarea
                  id="promo-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    kind === "PROMOTION"
                      ? "Shown to customers on the home page"
                      : "Optional details for customers"
                  }
                  rows={2}
                />
              </div>
              {kind === "VOUCHER" ? (
                <div>
                  <Label>How customers redeem *</Label>
                  <Select
                    value={redemptionMode}
                    onValueChange={(v) =>
                      v && setRedemptionMode(v as VoucherRedemptionMode)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLAIM">Claim on Rewards</SelectItem>
                      <SelectItem value="MANUAL">Redeem code on Rewards</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {redemptionModeHint(redemptionMode)}
                  </p>
                </div>
              ) : null}
              <div>
                <Label htmlFor="promo-code">
                  {kind === "VOUCHER" ? "Custom code *" : "Display code (optional)"}
                </Label>
                <Input
                  id="promo-code"
                  value={promoCode}
                  onChange={(e) =>
                    setPromoCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  placeholder={kind === "VOUCHER" ? "SAMAL50" : "SUMMER30"}
                  className="font-mono uppercase"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {kind === "VOUCHER"
                    ? redemptionMode === "MANUAL"
                      ? "Customers redeem this code on Rewards."
                      : "Used after claim; customers tap Claim on Rewards."
                    : "Optional code badge on the home page. Not redeemable."}
                </p>
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
            </div>
            </DialogScrollBody>
            <DialogStickyFooter>
              <Button
                className="w-full bg-green hover:bg-green/90 sm:w-auto sm:min-w-[140px]"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editing ? (
                  "Save Changes"
                ) : kind === "PROMOTION" ? (
                  "Save Promotion"
                ) : (
                  "Save Voucher"
                )}
              </Button>
            </DialogStickyFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 rounded-2xl border border-sky/20 bg-light-blue/50 px-4 py-3 text-sm text-navy/80">
        <p className="font-medium text-navy">Types</p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted-foreground">
          <li>
            <span className="text-navy/80">Voucher</span> — customers redeem on
            Rewards and use at checkout
          </li>
          <li>
            <span className="text-navy/80">Promotion</span> — marketing offer
            shown on the customer home page
          </li>
        </ul>
      </div>

      {!hydrated ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : vouchers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-sky" />
          <p className="mt-3 font-semibold text-navy">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a voucher for Rewards or a promotion for the home page.
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
                        <Badge variant="outline">
                          {promoKindLabel(promo.kind ?? "VOUCHER")}
                        </Badge>
                        {promo.promo_code ? (
                          <Badge className="bg-green font-mono">
                            {promo.promo_code}
                          </Badge>
                        ) : null}
                        {(promo.kind ?? "VOUCHER") === "VOUCHER" ? (
                          <Badge variant="outline">
                            {redemptionModeLabel(promo.redemption_mode ?? "CLAIM")}
                          </Badge>
                        ) : null}
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
                        {promo.description ||
                          ((promo.kind ?? "VOUCHER") === "PROMOTION"
                            ? "Home page promotion"
                            : promo.redemption_mode === "MANUAL"
                              ? "Code redeemed on Rewards"
                              : "Claimable voucher")}
                      </p>
                      {(promo.kind ?? "VOUCHER") === "VOUCHER" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {redemptionModeHint(promo.redemption_mode ?? "CLAIM")}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {promoKindHint("PROMOTION")}
                        </p>
                      )}
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
